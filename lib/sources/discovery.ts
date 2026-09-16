import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { normalizeTerm } from "@/lib/editorial-match";
import {
  filterBreakdown,
  filterFashion,
  type FilterBreakdown,
  type Headline,
} from "@/lib/sources/fashion-filter";
import { CATEGORIES, type Trend } from "@/lib/types";

/**
 * Descubrimiento de tendencias desde el feed editorial.
 *
 * Manda los titulares de moda del día a Claude y extrae candidatas: cosas de
 * las que la prensa habla y que el catálogo todavía no tiene. No entran al
 * catálogo solas — se acumulan con su conteo de menciones y su evidencia, y
 * promoverlas es una decisión humana.
 */
/**
 * Generación actual de Sonnet: más capaz y más barato que el 4.6 que estaba
 * aquí antes ($2/$10 por millón contra $3/$15).
 */
export const DISCOVERY_MODEL = "claude-sonnet-5";

/**
 * El feed entero pasa por el modelo, no solo la primera tanda.
 *
 * El catálogo de muestra está desconectado de lo que la prensa escribe hoy:
 * de 130 titulares cruzaban dos. Mientras eso siga así, el descubrimiento no
 * es un extra, es la forma de poblar el catálogo, y quedarse con los primeros
 * 40 titulares tiraba el 70% de la materia prima.
 *
 * Se manda en tandas porque un lote de 130 en un solo mensaje da peores
 * extracciones —el modelo se queda con lo de arriba— y porque un fallo a mitad
 * no puede costar la corrida entera.
 */
const BATCH_SIZE = 40;
/** Tope de gasto: 7 fuentes × 20 titulares no llega ni a cinco tandas. */
const MAX_BATCHES = 6;

const EvidenceSchema = z.object({
  /** Índice del titular que la respalda. */
  titular: z.number(),
  /**
   * El fragmento LITERAL de ese titular donde aparece, en su idioma.
   *
   * Es lo que hace verificable la extracción: se comprueba que la cita esté
   * de verdad en el texto. Un titular sobre "wearable exoskeletons" producía
   * "vestido slip" y "pantalón plisado", que no salen por ninguna parte; con
   * una cita obligatoria, inventarla es lo único que queda y eso sí se puede
   * comprobar.
   */
  cita: z.string(),
});

const CandidateSchema = z.object({
  /** Nombre en español, como lo nombraría una editora de moda. */
  nombre: z.string(),
  categoria: z.enum(CATEGORIES),
  evidencia: z.array(EvidenceSchema),
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

/**
 * El desglose de una corrida. Existe porque el primer cron real terminó "ok"
 * con cero candidatas y no había forma de saber en qué punto se perdieron:
 * si no llegaron titulares, si el filtro se los comió, si el modelo no
 * devolvió nada o si los descartó alguno de los tres filtros de después.
 */
export type DiscoveryStats = {
  /** Titulares que traía el caché editorial. */
  received: number;
  /** Los que pasaron el filtro de moda, y por qué cayeron los demás. */
  filter: FilterBreakdown;
  /** Los que de verdad se mandaron, sumando todas las tandas. */
  sent: number;
  /** Cuántas tandas se mandaron y cuántas reventaron. */
  batches: number;
  failedBatches: number;
  /** Candidatas que devolvió el modelo, antes de los filtros de después. */
  returned: number;
  droppedShortName: number;
  /** Nombre que era una categoría de producto, sin calificativo. */
  droppedGeneric: number;
  droppedKnown: number;
  /** Citas que no aparecían en su titular: el modelo se las inventó. */
  droppedUngrounded: number;
  droppedNoEvidence: number;
  /** Las que sobrevivieron a los tres. */
  kept: number;
};

export type DiscoveryResult =
  | {
      status: "ok";
      candidates: Candidate[];
      sent: number;
      stats: DiscoveryStats;
      /** Presente solo si se paró antes de tiempo: qué tanda falló y por qué. */
      reason?: string;
    }
  | { status: "skipped"; reason: string; stats: DiscoveryStats }
  | { status: "error"; reason: string; stats: DiscoveryStats };

const emptyStats = (received = 0): DiscoveryStats => ({
  received,
  filter: { ok: 0, bloqueado: 0, "sin-moda": 0, "otro-tema": 0 },
  sent: 0,
  batches: 0,
  failedBatches: 0,
  returned: 0,
  droppedShortName: 0,
  droppedGeneric: 0,
  droppedKnown: 0,
  droppedUngrounded: 0,
  droppedNoEvidence: 0,
  kept: 0,
});

/** Una línea legible desde el celular, que es donde se leerá. */
export function describeStats(stats: DiscoveryStats): string {
  const { filter } = stats;
  return [
    `${stats.received} titulares`,
    `${filter.ok} pasaron el filtro (${filter.bloqueado} negocio, ` +
      `${filter["sin-moda"]} sin moda, ${filter["otro-tema"]} otro tema)`,
    `${stats.sent} al modelo en ${stats.batches} tanda${stats.batches === 1 ? "" : "s"}` +
      (stats.failedBatches ? ` (${stats.failedBatches} reventaron)` : ""),
    `${stats.returned} candidatas`,
    `descartadas ${stats.droppedShortName} por nombre corto, ` +
      `${stats.droppedGeneric} genéricas, ` +
      `${stats.droppedKnown} ya en catálogo, ` +
      `${stats.droppedNoEvidence} sin evidencia ` +
      `(${stats.droppedUngrounded} citas inventadas)`,
    `${stats.kept} nuevas`,
  ].join(" · ");
}

/**
 * Cuánta evidencia se guarda por candidata. Son los titulares que se enseñan
 * en /alerts para poder juzgarla sin salir de la página.
 */
const MAX_EVIDENCE = 20;
/** Desplaza la evidencia ya guardada para que la nueva gane el desempate. */
const EVIDENCE_OFFSET = 10_000;

/**
 * Quita el artículo con el que el modelo a veces arranca el nombre.
 *
 * El prompt lo pide sin él, pero cuando se cuela "el zueco" no es otra
 * tendencia que "zueco": sería otra fila, con sus menciones repartidas entre
 * las dos. El artículo se quita solo si deja algo detrás, para no convertir
 * "la" en cadena vacía.
 */
const ARTICLES = /^(el|la|los|las|un|una|unos|unas)\s+/i;

export function cleanCandidateName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const withoutArticle = trimmed.replace(ARTICLES, "");
  return withoutArticle.length >= 3 ? withoutArticle : trimmed;
}

/** Slug estable: dos extracciones del mismo nombre son la misma candidata. */
export function toSlug(name: string): string {
  return normalizeTerm(cleanCandidateName(name)).replace(/\s+/g, "-").slice(0, 60);
}

export const EXTRACTION_PROMPT = `Eres una analista de tendencias de moda para el mercado mexicano.

Te doy titulares de prensa de moda del día. Extrae las tendencias de MODA
concretas de las que hablan: prendas, colores, texturas, siluetas, accesorios
o estilos.

REGLA 1: saca la PRENDA, no el tema del artículo.

  "Los pantalones satinados de los 90 vuelven"  -> "pantalón satinado"
  "El regreso del zueco que arrasó en los 70"   -> "zueco"
  "Todo lo que se llevó en la alfombra roja"    -> nada, no nombra una prenda
  "La estética boho toma la primavera"          -> "estilo boho"

Una década, una estética de época, una ciudad, una casa de moda, una
temporada o un evento NO son tendencias: "años 90", "look retro",
"primavera 2027", "moda de París" se descartan.

REGLA 2: una tendencia lleva un CALIFICATIVO que la distingue. Sin él es una
categoría de producto, y una categoría de producto no es una tendencia: la
gente lleva leggings y collares desde hace décadas.

  "legging"            -> NO, categoría de producto
  "legging de cuero"   -> sí
  "collar"             -> NO
  "collar de eslabones"-> sí
  "zapato de tacón"    -> NO, es media tienda
  "tacón sensato"      -> sí
  "vestido"            -> NO
  "vestido de lentejuelas" -> sí

El calificativo puede ser material (satinado, de cuero, de encaje), color
(café, burdeos), forma (acampanado, de tiro alto, de cuña, oversize) o época
si va pegada a la prenda (pantalón de los 70 NO; pantalón de campana sí).

**Si el titular no da un calificativo, no hay candidata.** No lo inventes ni
lo deduzcas: si el titular dice solo "leggings are back", no saques nada.

REGLA 3: cada candidata va con una CITA LITERAL del titular que la respalda.
Copia el fragmento exacto, tal cual, en el idioma en que está escrito — no lo
traduzcas ni lo reformules. La cita se comprueba contra el texto: si no
aparece igual, la candidata se descarta.

  Titular: "Satin trousers are the sleeper hit of the season"
  Candidata: "pantalón satinado", cita: "Satin trousers"

  Titular: "Why wearable exoskeletons are coming for fashion"
  Candidatas: ninguna. No nombra ninguna prenda de vestir.

Si no puedes copiar una cita que contenga la tendencia, es que no está en el
titular: no la saques.

Cómo se escribe el nombre:
- En español, SIEMPRE EN SINGULAR: "bailarina café", no "bailarinas cafés".
- Como se pediría en una tienda: "sandalia de cuña", "pantalón satinado".
  Corto, sin adjetivos de crónica.
- Sin el nombre de la marca ni de la casa: "chaqueta de cuero", no
  "la chaqueta de cuero de Prada".
- Nada de copiar el titular entero ni frases ("lo que se lleva esta temporada").

Más reglas:
- Solo ropa y accesorios. Nada de belleza, maquillaje, pelo, celebridades,
  resultados de negocio ni nombramientos.
- Si ningún titular contiene una tendencia concreta, devuelve lista vacía.
  Una lista vacía es una respuesta correcta y es lo que se espera a menudo.

Devuelve para cada candidata su nombre, su categoría y, por cada titular que
la respalde, su índice y la cita literal.`;

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
 *
 * Recibe `keywords` y no `Trend` porque hay que pasarle también las promovidas
 * que siguen acumulando: están fuera de `trends`, y si no se miraran, el
 * descubrimiento volvería a proponer la semana que viene lo que se promovió
 * ayer.
 */
export function isNew(name: string, trends: Pick<Trend, "keywords">[]): boolean {
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

/** Corta la lista en tandas del tamaño que aguanta bien una extracción. */
export function batchHeadlines(
  headlines: Headline[],
  size = BATCH_SIZE,
  maxBatches = MAX_BATCHES,
): Headline[][] {
  const batches: Headline[][] = [];
  for (let i = 0; i < headlines.length && batches.length < maxBatches; i += size) {
    batches.push(headlines.slice(i, i + size));
  }
  return batches;
}

/**
 * Junta las candidatas de varias tandas. La misma tendencia sale en dos tandas
 * distintas cuando la prensa la repite, y ahí lo que suma es su evidencia: se
 * unen los titulares, deduplicados por enlace para no contar dos veces el
 * mismo.
 */
export function mergeCandidates(batches: Candidate[][]): Candidate[] {
  const merged = new Map<string, Candidate>();

  for (const batch of batches) {
    for (const candidate of batch) {
      const previous = merged.get(candidate.slug);
      if (!previous) {
        merged.set(candidate.slug, { ...candidate, evidence: [...candidate.evidence] });
        continue;
      }
      const links = new Set(previous.evidence.map((item) => item.link));
      for (const item of candidate.evidence) {
        if (links.has(item.link)) continue;
        links.add(item.link);
        previous.evidence.push(item);
      }
      previous.category ??= candidate.category;
    }
  }

  return [...merged.values()];
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return "rate limit de la API de Anthropic";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "ANTHROPIC_API_KEY inválida";
  }
  return error instanceof Error ? error.message : String(error);
}

/** Una tanda: la llamada al modelo y los tres filtros de después. */
async function extractBatch(
  client: Anthropic,
  batch: Headline[],
  trends: Pick<Trend, "keywords">[],
  stats: DiscoveryStats,
): Promise<Candidate[]> {
  const response = await client.messages.parse({
    model: DISCOVERY_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: EXTRACTION_PROMPT,
    messages: [{ role: "user", content: buildInput(batch) }],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("la respuesta no se pudo parsear");

  stats.returned += parsed.candidatas.length;

  return parsed.candidatas
    .filter((candidate) => {
      const named = candidate.nombre.trim().length > 2;
      if (!named) stats.droppedShortName += 1;
      return named;
    })
    .filter((candidate) => {
      const fresh = isNew(candidate.nombre, trends);
      if (!fresh) stats.droppedKnown += 1;
      return fresh;
    })
    .filter((candidate) => {
      const generic = isGeneric(candidate.nombre);
      if (generic) stats.droppedGeneric += 1;
      return !generic;
    })
    .map((candidate) => ({
      slug: toSlug(candidate.nombre),
      nameEs: cleanCandidateName(candidate.nombre),
      category: candidate.categoria as string | null,
      // Los índices son relativos a SU tanda: el modelo solo vio esa.
      evidence: candidate.evidencia
        .map((item) => ({ item, headline: batch[item.titular] }))
        .filter(({ item, headline }) => {
          if (!headline) return false;
          // La cita tiene que estar en el titular, o no hay de dónde salió.
          const grounded = quoteIsGrounded(item.cita, headline);
          if (!grounded) stats.droppedUngrounded += 1;
          return grounded;
        })
        .map(({ headline }) => ({
          title: headline.title,
          source: headline.sourceName,
          link: headline.link,
        })),
    }))
    // Sin evidencia no hay candidata: el modelo pudo alucinar un índice.
    .filter((candidate) => {
      const backed = candidate.evidence.length > 0;
      if (!backed) stats.droppedNoEvidence += 1;
      return backed;
    });
}

export async function discoverCandidates(
  headlines: Headline[],
  trends: Pick<Trend, "keywords">[],
): Promise<DiscoveryResult> {
  const stats = emptyStats(headlines.length);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "skipped", reason: "falta ANTHROPIC_API_KEY", stats };
  }

  // El filtro corre ANTES de gastar tokens.
  stats.filter = filterBreakdown(headlines);
  const fashion = filterFashion(headlines);
  if (!fashion.length) {
    return {
      status: "skipped",
      reason: `ninguno de los ${headlines.length} titulares pasó el filtro de moda`,
      stats,
    };
  }

  const client = new Anthropic();
  const found: Candidate[][] = [];
  let stopped: string | null = null;

  for (const batch of batchHeadlines(fashion)) {
    try {
      found.push(await extractBatch(client, batch, trends, stats));
      stats.batches += 1;
      stats.sent += batch.length;
    } catch (error) {
      // Una tanda que revienta no puede costar las que ya salieron bien: se
      // para ahí y se guarda lo encontrado, igual que hace Google con el 429.
      stats.failedBatches += 1;
      stopped = describeError(error);
      break;
    }
  }

  if (!stats.batches) {
    return { status: "error", reason: stopped ?? "ninguna tanda salió", stats };
  }

  const candidates = mergeCandidates(found);
  stats.kept = candidates.length;

  return {
    status: "ok",
    candidates,
    sent: stats.sent,
    stats,
    ...(stopped ? { reason: `se paró en la tanda ${stats.batches + 1}: ${stopped}` } : {}),
  };
}

/**
 * Acumula las candidatas. Las menciones se suman entre días: lo que la prensa
 * repite semana tras semana sube solo, y lo que salió una vez se queda abajo.
 *
 * Se cuentan titulares distintos, no apariciones. Un artículo se queda en el
 * feed varios días y el mismo enlace volvía a sumar en cada corrida: la lista
 * se ordena por menciones, así que inflarlas con repetidos era ordenarla por
 * "cuántos días lleva el feed sin cambiar". La evidencia se une deduplicada
 * por enlace, con lo nuevo delante, y las menciones suben solo por los enlaces
 * que no estaban.
 */
/**
 * Categorías de producto que por sí solas nunca son una tendencia.
 *
 * La gente lleva leggings y collares desde hace décadas: lo noticiable es el
 * calificativo —de cuero, de eslabones, satinado—, no la prenda. El prompt lo
 * pide, esto lo sujeta: un nombre que sea exactamente una de estas, sin nada
 * más, se cae.
 */
const PRODUCT_CATEGORIES = new Set([
  "legging", "leggings", "collar", "collares", "vestido", "vestidos",
  "pantalon", "pantalones", "falda", "faldas", "camisa", "camisas", "blusa",
  "blusas", "abrigo", "abrigos", "chaqueta", "chaquetas", "saco", "sacos",
  "zapato", "zapatos", "bota", "botas", "sandalia", "sandalias", "bolso",
  "bolsos", "bolsa", "bolsas", "cinturon", "cinturones", "jean", "jeans",
  "sueter", "sueteres", "chaleco", "chalecos", "falda larga", "traje",
  "trajes", "short", "shorts", "blazer", "blazers", "gorra", "gorras",
  "sombrero", "sombreros", "anillo", "anillos", "arete", "aretes", "bufanda",
  "bufandas", "guante", "guantes", "tacon", "tacones", "zapato de tacon",
  "zapatos de tacon", "bailarina", "bailarinas", "mocasin", "mocasines",
  "tenis", "playera", "playeras", "camiseta", "camisetas", "falda corta",
]);

/**
 * Una candidata es genérica si su nombre es, tal cual, una categoría de
 * producto. Con calificativo deja de serlo: "legging" no, "legging de cuero"
 * sí.
 */
export function isGeneric(name: string): boolean {
  return PRODUCT_CATEGORIES.has(normalizeTerm(cleanCandidateName(name)));
}

/**
 * ¿La cita está de verdad en el titular?
 *
 * Es la defensa contra la alucinación, y se hace sobre la cita y no sobre el
 * nombre a propósito: el nombre va en español y el titular puede estar en
 * inglés, así que buscar "vestido slip" dentro de "The slip dress is back"
 * fallaría con una extracción correcta. La cita, en cambio, viene copiada del
 * titular en su idioma, así que o está o el modelo se la inventó.
 */
export function quoteIsGrounded(quote: string, headline: Headline): boolean {
  const needle = normalizeTerm(quote);
  // Una cita de una o dos letras casa con cualquier cosa: no prueba nada.
  if (needle.length < 3) return false;
  return normalizeTerm(`${headline.title} ${headline.snippet}`).includes(needle);
}

/** Los medios distintos que aparecen en la evidencia de una candidata. */
export function outletsOf(candidate: Candidate): string[] {
  return [...new Set(candidate.evidence.map((item) => item.source))].sort();
}

export async function saveCandidates(
  db: Db,
  candidates: Candidate[],
  date: string,
): Promise<number> {
  for (const candidate of candidates) {
    await db.query(
      `insert into trend_candidates
         (slug, name_es, category, mentions, first_seen, last_seen, outlets, evidence)
       values ($1, $2, $3, $4, $5, $5, $6, $7)
       on conflict (slug) do update set
         -- Unión de medios: una vez que un medio la mencionó, cuenta para
         -- siempre, aunque su titular se caiga del recorte de evidencia.
         outlets = (
           select coalesce(array_agg(distinct medio), '{}')
             from unnest(trend_candidates.outlets || excluded.outlets) as medio
         ),
         mentions = trend_candidates.mentions + (
           -- Solo los titulares que no estaban ya.
           select count(*)
             from jsonb_array_elements(excluded.evidence) as nuevo
            where not exists (
              select 1 from jsonb_array_elements(trend_candidates.evidence) as viejo
               where viejo->>'link' = nuevo->>'link'
            )
         ),
         last_seen = excluded.last_seen,
         category = coalesce(trend_candidates.category, excluded.category),
         -- Unión deduplicada por enlace, lo nuevo primero, con tope.
         evidence = (
           select coalesce(jsonb_agg(item order by orden), '[]'::jsonb)
             from (
               select item, orden
                 from (
                   select distinct on (item->>'link') item, orden
                     from (
                       select item, ord::int as orden
                         from jsonb_array_elements(excluded.evidence)
                              with ordinality as entrante(item, ord)
                       union all
                       select item, (ord + ${EVIDENCE_OFFSET})::int
                         from jsonb_array_elements(trend_candidates.evidence)
                              with ordinality as guardada(item, ord)
                     ) as todos
                    order by item->>'link', orden
                 ) as unicos
                order by orden
                limit ${MAX_EVIDENCE}
             ) as recorte
         )`,
      [
        candidate.slug,
        candidate.nameEs,
        candidate.category,
        // Solo cuenta en el insert; al chocar, la base recuenta los nuevos.
        candidate.evidence.length,
        date,
        outletsOf(candidate),
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
  /** Titulares distintos que la mencionan. */
  mentions: number;
  /** Medios distintos que la mencionan: `outlets.length`, ya contado. */
  sources: number;
  outlets: string[];
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

/**
 * Mientras el catálogo siga desconectado de lo que la prensa escribe, esta
 * lista es la materia prima del catálogo, no una nota al pie: se enseñan
 * treinta, no doce.
 */
export async function listCandidates(
  db: Db,
  limit = 30,
): Promise<CandidateRow[]> {
  const rows = await db.query<
    Omit<CandidateRow, "first_seen" | "last_seen" | "sources"> & {
      first_seen: string | Date;
      last_seen: string | Date;
    }
  >(
    `select slug, name_es, category, mentions, outlets, first_seen, last_seen,
            evidence
       from trend_candidates
      -- Ni las promovidas ni las descartadas a mano: las dos ya se juzgaron.
      where promoted_at is null and discarded_at is null
      -- Medios distintos primero: cinco candidatas sacadas del mismo listicle
      -- no valen lo que una que citan cinco redacciones.
      order by cardinality(outlets) desc, mentions desc, last_seen desc
      limit $1`,
    [limit],
  );

  return rows.map((row) => {
    const outlets = row.outlets ?? [];
    return {
      ...row,
      outlets,
      mentions: Number(row.mentions),
      sources: outlets.length,
      first_seen: isoDate(row.first_seen),
      last_seen: isoDate(row.last_seen),
    };
  });
}
