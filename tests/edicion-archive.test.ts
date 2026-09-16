import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { saveCatalogToDb } from "@/lib/db/catalog";
import { getPublishedEdicion } from "@/lib/db/ediciones";
import {
  freezeSundayEdicion,
  isSundayInMexico,
  listArchive,
  resolveEdicion,
  todayInMexico,
} from "@/lib/edicion-archive";
import { currentEdicionDate, getEdicion } from "@/lib/edicion";
import { getTrends, resetCatalogCache } from "@/lib/trends";

const trends = getTrends();

let pg: PGlite;
let db: Db;

before(async () => {
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  await migrate(db);
  setDb(db);
  resetCatalogCache();
  await saveCatalogToDb(db, trends, "mock");
});

after(async () => {
  setDb(null);
  resetCatalogCache();
  await pg.close();
});

/* ── el domingo es el de CDMX, no el de UTC ────────────────────────── */

test("a las 03:00 CDMX del domingo ya es domingo, aunque en UTC sea domingo 09:00", () => {
  // 2026-09-20 09:00 UTC = domingo 03:00 en CDMX.
  assert.equal(isSundayInMexico(new Date("2026-09-20T09:00:00Z")), true);
});

test("el lunes 03:00 UTC todavía es domingo en CDMX", () => {
  // 2026-09-21 03:00 UTC = domingo 21:00 en CDMX.
  assert.equal(isSundayInMexico(new Date("2026-09-21T03:00:00Z")), true);
  assert.equal(todayInMexico(new Date("2026-09-21T03:00:00Z")), "2026-09-20");
});

test("el domingo 03:00 UTC todavía es sábado en CDMX", () => {
  // 2026-09-20 03:00 UTC = sábado 21:00 en CDMX.
  assert.equal(isSundayInMexico(new Date("2026-09-20T03:00:00Z")), false);
});

test("un martes no es domingo en ninguna zona", () => {
  assert.equal(isSundayInMexico(new Date("2026-09-22T09:00:00Z")), false);
});

/* ── congelar ──────────────────────────────────────────────────────── */

test("entre semana no publica nada", async () => {
  const result = await freezeSundayEdicion(
    db,
    trends,
    new Date("2026-09-22T09:00:00Z"),
  );
  assert.equal(result.published, false);
  assert.match(result.reason!, /no es domingo/);
});

test("en domingo congela la edición en curso", async () => {
  const result = await freezeSundayEdicion(
    db,
    trends,
    new Date("2026-09-20T09:00:00Z"),
  );
  assert.equal(result.published, true);
  assert.equal(result.date, currentEdicionDate(trends));

  const stored = await getPublishedEdicion(db, result.date!);
  assert.ok(stored, "quedó guardada");
  assert.equal(stored.picks.length, 5);
});

test("congelar dos domingos seguidos no pisa lo guardado", async () => {
  const date = currentEdicionDate(trends);
  const antes = await getPublishedEdicion(db, date);

  await freezeSundayEdicion(db, trends, new Date("2026-09-20T09:00:00Z"));
  const despues = await getPublishedEdicion(db, date);

  assert.deepEqual(
    despues!.picks.map((pick) => pick.summary.id),
    antes!.picks.map((pick) => pick.summary.id),
  );
});

/* ── prioridad al resolver ─────────────────────────────────────────── */

test("una edición congelada se sirve de la base, no se recalcula", async () => {
  const date = currentEdicionDate(trends);
  const resolved = await resolveEdicion(db, date, trends);
  assert.equal(resolved!.origin, "congelada");
});

test("EL CURADO GANA: el archivo de content/ pisa al snapshot", async () => {
  // 2026-08-16 tiene archivo curado y además se publica aquí.
  const curada = "2026-08-16";
  const edicion = getEdicion(curada, trends)!;
  const { publishEdicion } = await import("@/lib/db/ediciones");
  await publishEdicion(db, { ...edicion, intro: { es: "vieja", en: "old" } });

  const resolved = await resolveEdicion(db, curada, trends);
  assert.equal(resolved!.origin, "curada");
  assert.notEqual(
    resolved!.edicion.intro.es,
    "vieja",
    "el snapshot viejo no puede tapar lo que ella escribió a mano",
  );
});

test("sin base, una edición pasada se calcula en vivo", async () => {
  const resolved = await resolveEdicion(null, "2026-09-06", trends);
  assert.equal(resolved!.origin, "en vivo");
});

test("una fecha que no es domingo del histórico no existe", async () => {
  assert.equal(await resolveEdicion(db, "2026-01-01", trends), null);
});

/* ── el archivo ────────────────────────────────────────────────────── */

test("el archivo marca cuáles están congeladas", async () => {
  const archive = await listArchive(db, trends);
  const actual = archive.find((entry) => entry.date === currentEdicionDate(trends));
  assert.equal(actual!.frozen, true);

  const vieja = archive.find((entry) => entry.date === "2026-07-19");
  assert.equal(vieja!.frozen, false);
});

test("el archivo sigue en orden descendente por fecha", async () => {
  const archive = await listArchive(db, trends);
  const fechas = archive.map((entry) => entry.date);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test("sin base el archivo sigue funcionando", async () => {
  const archive = await listArchive(null, trends);
  assert.ok(archive.length >= 9);
  assert.ok(archive.every((entry) => entry.frozen === false));
});
