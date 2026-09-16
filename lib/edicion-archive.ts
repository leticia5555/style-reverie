import type { Db } from "@/lib/db/client";
import { getPublishedEdicion, listPublishedDates } from "@/lib/db/ediciones";
import { listContent } from "@/lib/content";
import {
  currentEdicionDate,
  edicionDates,
  getEdicion,
  listEdiciones,
  type Edicion,
  type EdicionSummary,
} from "@/lib/edicion";
import type { Trend } from "@/lib/types";

const CONTENT_FOLDER = "ediciones";
const TZ = "America/Mexico_City";

/**
 * ¿Hoy es domingo en Ciudad de México? El cron corre a las 09:00 UTC, que son
 * las 03:00 en CDMX: preguntar por el día en UTC daría el domingo equivocado
 * para media jornada.
 */
export function isSundayInMexico(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(now);
  return weekday === "Sun";
}

/** Fecha de hoy en CDMX, en formato YYYY-MM-DD. */
export function todayInMexico(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * La edición de una fecha, con la prioridad que manda.
 *
 *   1. Si hay archivo curado en content/, gana siempre. Es lo que ella
 *      escribió a mano y no puede quedar tapado por un snapshot viejo.
 *   2. Si no, el snapshot congelado en la base, si existe.
 *   3. Si no, se calcula en vivo.
 *
 * Solo la edición en curso se calcula en vivo de forma habitual: las pasadas
 * son documentos con fecha y no deben cambiar porque hoy entren datos reales.
 */
export async function resolveEdicion(
  db: Db | null,
  date: string,
  trends: Trend[],
): Promise<{ edicion: Edicion; origin: "curada" | "congelada" | "en vivo" } | null> {
  const curated = listContent(CONTENT_FOLDER).includes(date);
  if (curated) {
    const edicion = getEdicion(date, trends);
    if (edicion) return { edicion, origin: "curada" };
  }

  if (db) {
    try {
      const stored = await getPublishedEdicion(db, date);
      if (stored) return { edicion: stored, origin: "congelada" };
    } catch {
      // Base caída: se calcula en vivo, que es peor pero no rompe la página.
    }
  }

  const edicion = getEdicion(date, trends);
  return edicion ? { edicion, origin: "en vivo" } : null;
}

export type ArchiveEntry = EdicionSummary & {
  frozen: boolean;
};

/**
 * El archivo: las fechas publicadas en la base más las que todavía se pueden
 * calcular del histórico, sin duplicar.
 */
export async function listArchive(
  db: Db | null,
  trends: Trend[],
): Promise<ArchiveEntry[]> {
  const computables = listEdiciones(trends);
  let published: string[] = [];

  if (db) {
    try {
      published = await listPublishedDates(db);
    } catch {
      published = [];
    }
  }

  const frozen = new Set(published);
  const known = new Set(computables.map((entry) => entry.date));

  const extras: ArchiveEntry[] = published
    .filter((date) => !known.has(date))
    .map((date) => ({
      date,
      curated: false,
      count: 0,
      names: [],
      frozen: true,
    }));

  return [...computables.map((entry) => ({ ...entry, frozen: frozen.has(entry.date) })), ...extras]
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Congela la edición del domingo. Idempotente por partida doble: solo corre en
 * domingo y publishEdicion() no pisa lo ya guardado.
 */
export async function freezeSundayEdicion(
  db: Db,
  trends: Trend[],
  now = new Date(),
): Promise<{ published: boolean; date: string | null; reason?: string }> {
  if (!isSundayInMexico(now)) {
    return { published: false, date: null, reason: "hoy no es domingo en CDMX" };
  }

  const dates = edicionDates(trends);
  if (!dates.length) {
    return { published: false, date: null, reason: "no hay ediciones que publicar" };
  }

  const date = currentEdicionDate(trends);
  const edicion = getEdicion(date, trends);
  if (!edicion) {
    return { published: false, date, reason: "no se pudo calcular la edición" };
  }

  const { publishEdicion } = await import("@/lib/db/ediciones");
  await publishEdicion(db, edicion);
  return { published: true, date };
}
