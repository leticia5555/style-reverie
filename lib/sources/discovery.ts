import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { normalizeTerm } from "@/lib/editorial-match";
import { filterFashion, type Headline } from "@/lib/sources/fashion-filter";
import { CATEGORIES, type Trend } from "@/lib/types";

/**
 * Descubrimiento de tendencias desde el feed editorial.
 *
 * Manda los titulares de moda del día a Claude y extrae candidatas: cosas de
 * las que la prensa habla y que el catálogo todavía no tiene. No entran al
 * catálogo solas — se acumulan con su conteo de menciones y su evidencia, y
 * promoverlas es una decisión humana.
 */
export const DISCOVERY_MODEL = "claude-sonnet-4-6";
const MAX_HEADLINES = 40;

const CandidateSchema = z.object({
  /** Nombre en español, como lo nombraría una editora de moda. */
  nombre: z.string(),
  categoria: z.enum(CATEGORIES),
  /** Índices de los titulares que la respaldan. */
  evidencia: z.array(z.number()),
});

const ExtractionSchema = z.object({
  candidatas: z.array(CandidateSchema),
});

export type Candidate = {
  slug: string;
  nameEs: string;
  category: string | null;
  evidence: { title: string; source: string; link: string }[];
};

export type DiscoveryResult =
  | { status: "ok"; candidates: Candidate[]; sent: number }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/** Slug estable: dos extracciones del mismo nombre son la misma candidata. */
export function toSlug(name: string): string {
  return normalizeTerm(name).replace(/\s+/g, "-").slice(0, 60);
}

const PROMPT = `Eres una analista de tendencias de moda para el mercado mexicano.

Te doy titulares de prensa de moda del día. Extrae las tendencias de MODA
concretas de las que hablan: prendas, colores, texturas, siluetas, accesorios
o estilos.

Reglas:
- Solo tendencias de ropa y accesorios. Nada de belleza, maquillaje, pelo,
  celebridades, resultados de negocio ni nombramientos.
- El nombre va en español, corto y como lo escribiría una editora de moda
  ("pantalón barril", "verde matcha", "hombro estructurado"). No copies el
  titular entero.
- Una tendencia concreta, no un tema general. "Moda de otoño" no sirve;
  "abrigo de borreguito" sí.
- Solo si al menos un titular la respalda de verdad. No inventes ni infieras.
- Si ningún titular contiene una tendencia concreta, devuelve lista vacía.

Devuelve para cada candidata su nombre, su categoría y los índices de los
titulares que la respaldan.`;

function buildInput(headlines: Headline[]): string {
  return headlines
    .map(
      (headline, index) =>
        `[${index}] (${headline.sourceName}) ${headline.title}${
          headline.snippet ? ` — ${headline.snippet}` : ""
        }`,
    )
    .join("\n");
}

/**
 * Descarta lo que el catálogo ya tiene: una candidata que casa con los
 * keywords de una tendencia existente no es un descubrimiento.
 */
export function isNew(name: string, trends: Trend[]): boolean {
  const normalized = normalizeTerm(name);
  return !trends.some((trend) =>
    trend.keywords.some(
      (keyword) =>
        normalized === keyword ||
        normalized.includes(` ${keyword} `) ||
        normalized.startsWith(`${keyword} `) ||
        normalized.endsWith(` ${keyword}`),
    ),
  );
}

export async function discoverCandidates(
  headlines: Headline[],
  trends: Trend[],
): Promise<DiscoveryResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "skipped", reason: "falta ANTHROPIC_API_KEY" };
  }

  // El filtro corre ANTES de gastar tokens.
  const fashion = filterFashion(headlines).slice(0, MAX_HEADLINES);
  if (!fashion.length) {
    return {
      status: "skipped",
      reason: `ninguno de los ${headlines.length} titulares pasó el filtro de moda`,
    };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: DISCOVERY_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: PROMPT,
      messages: [{ role: "user", content: buildInput(fashion) }],
      output_config: { format: zodOutputFormat(ExtractionSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return { status: "error", reason: "la respuesta no se pudo parsear" };
    }

    const candidates: Candidate[] = parsed.candidatas
      .filter((candidate) => candidate.nombre.trim().length > 2)
      .filter((candidate) => isNew(candidate.nombre, trends))
      .map((candidate) => ({
        slug: toSlug(candidate.nombre),
        nameEs: candidate.nombre.trim(),
        category: candidate.categoria,
        evidence: candidate.evidencia
          .map((index) => fashion[index])
          .filter(Boolean)
          .map((headline) => ({
            title: headline.title,
            source: headline.sourceName,
            link: headline.link,
          })),
      }))
      // Sin evidencia no hay candidata: el modelo pudo alucinar un índice.
      .filter((candidate) => candidate.evidence.length > 0);

    return { status: "ok", candidates, sent: fashion.length };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { status: "error", reason: "rate limit de la API de Anthropic" };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return { status: "error", reason: "ANTHROPIC_API_KEY inválida" };
    }
    return {
      status: "error",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Acumula las candidatas. Las menciones se suman entre días: lo que la prensa
 * repite semana tras semana sube solo, y lo que salió una vez se queda abajo.
 */
export async function saveCandidates(
  db: Db,
  candidates: Candidate[],
  date: string,
): Promise<number> {
  for (const candidate of candidates) {
    await db.query(
      `insert into trend_candidates
         (slug, name_es, category, mentions, first_seen, last_seen, evidence)
       values ($1, $2, $3, $4, $5, $5, $6)
       on conflict (slug) do update set
         mentions = trend_candidates.mentions + excluded.mentions,
         last_seen = excluded.last_seen,
         category = coalesce(trend_candidates.category, excluded.category),
         -- Evidencia nueva primero, sin pasar de doce.
         evidence = (
           select jsonb_agg(item)
             from (
               select item from jsonb_array_elements(
                 excluded.evidence || trend_candidates.evidence
               ) as item limit 12
             ) as recorte
         )`,
      [
        candidate.slug,
        candidate.nameEs,
        candidate.category,
        candidate.evidence.length,
        date,
        JSON.stringify(candidate.evidence),
      ],
    );
  }
  return candidates.length;
}

export type CandidateRow = {
  slug: string;
  name_es: string;
  category: string | null;
  mentions: number;
  first_seen: string;
  last_seen: string;
  evidence: { title: string; source: string; link: string }[];
};

/**
 * Las columnas `date` vuelven como Date en unos drivers y como string en
 * otros. Se normalizan aquí para que el tipo no mienta y la UI pueda formatear
 * sin comprobar de qué forma vino.
 */
const isoDate = (value: string | Date): string =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);

export async function listCandidates(
  db: Db,
  limit = 12,
): Promise<CandidateRow[]> {
  const rows = await db.query<
    Omit<CandidateRow, "first_seen" | "last_seen"> & {
      first_seen: string | Date;
      last_seen: string | Date;
    }
  >(
    `select slug, name_es, category, mentions, first_seen, last_seen, evidence
       from trend_candidates
      where promoted_at is null
      order by mentions desc, last_seen desc
      limit $1`,
    [limit],
  );

  return rows.map((row) => ({
    ...row,
    mentions: Number(row.mentions),
    first_seen: isoDate(row.first_seen),
    last_seen: isoDate(row.last_seen),
  }));
}
