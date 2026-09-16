import type { Db } from "@/lib/db/client";
import { normalizeTerm } from "@/lib/editorial-match";
import { CATEGORIES, type Category, type Season } from "@/lib/types";

/**
 * Promover una candidata al catálogo, y descartarla.
 *
 * Promover NO inventa histórico. La tendencia entra con su categoría y sus
 * keywords, sin una sola señal, y a partir de ese día el cron la consulta como
 * a cualquier otra. Hasta que junte MIN_REAL_DAYS días de señal real no tiene
 * score, ni ciclo de vida, ni momentum, ni predicción: derivarlos de tres días
 * daría un número con la misma pinta que el de una tendencia con noventa, y
 * esa es justo la confusión que no puede existir en una terminal de datos.
 */

/**
 * Temporada por el mes. De marzo a agosto se habla de primavera-verano; de
 * septiembre a febrero, de otoño-invierno.
 */
export function seasonFor(date: string): Season {
  const [year, month] = date.split("-").map(Number);
  const spring = month >= 3 && month <= 8;
  // De enero y febrero se habla como del invierno que empezó el año anterior.
  const label = spring ? year : month <= 2 ? year - 1 : year;
  return `${spring ? "SS" : "FW"}${String(label).slice(2)}` as Season;
}

/**
 * Keywords de una tendencia promovida: su propio nombre, normalizado.
 *
 * Es poco, y es lo honesto: es lo único que sabemos de ella. El conector de
 * Google usa `keywords[0]` y el de Mercado Libre los cruza contra los títulos,
 * así que con esto ya se puede consultar desde el primer día. Afinarlos es
 * trabajo de quien la promovió.
 */
export function keywordsFrom(nameEs: string): string[] {
  const normalized = normalizeTerm(nameEs);
  return normalized ? [normalized] : [];
}

export type PromoteResult =
  | { status: "ok"; trendId: string }
  | { status: "not-found" }
  | { status: "already"; trendId: string };

type CandidateRowForPromote = {
  slug: string;
  name_es: string;
  category: string | null;
  promoted_at: string | Date | null;
};

/**
 * Crea la tendencia y marca la candidata. Es idempotente: promover dos veces
 * la misma no duplica nada ni pisa lo que ya hubiera en el catálogo.
 */
export async function promoteCandidate(
  db: Db,
  slug: string,
  today: string,
): Promise<PromoteResult> {
  const rows = await db.query<CandidateRowForPromote>(
    `select slug, name_es, category, promoted_at
       from trend_candidates
      where slug = $1 and discarded_at is null`,
    [slug],
  );
  const candidate = rows[0];
  if (!candidate) return { status: "not-found" };
  if (candidate.promoted_at) return { status: "already", trendId: candidate.slug };

  const category: Category = CATEGORIES.includes(candidate.category as Category)
    ? (candidate.category as Category)
    : "prenda";

  /**
   * El nombre en inglés queda igual que el español porque es lo único que hay:
   * la candidata se extrajo en español. Poner una traducción inventada sería
   * peor que repetirlo, y se puede editar después.
   */
  await db.query(
    `insert into trends
       (id, name_es, name_en, category, season, summary_es, summary_en,
        score_year_ago, keywords, shopping, promoted_at)
     values ($1, $2, $2, $3, $4, $5, $6, 0, $7, '{}'::jsonb, now())
     on conflict (id) do nothing`,
    [
      candidate.slug,
      candidate.name_es,
      category,
      seasonFor(today),
      "Promovida desde el feed editorial. Acumulando señales; todavía sin histórico.",
      "Promoted from the editorial feed. Collecting signals; no history yet.",
      keywordsFrom(candidate.name_es),
    ],
  );

  await db.query(
    "update trend_candidates set promoted_at = now() where slug = $1",
    [slug],
  );

  return { status: "ok", trendId: candidate.slug };
}

/** La marca para que no vuelva a proponerse. La fila se queda. */
export async function discardCandidate(
  db: Db,
  slug: string,
): Promise<{ status: "ok" | "not-found" }> {
  const rows = await db.query<{ slug: string }>(
    `update trend_candidates
        set discarded_at = now()
      where slug = $1 and discarded_at is null and promoted_at is null
      returning slug`,
    [slug],
  );
  return rows.length ? { status: "ok" } : { status: "not-found" };
}
