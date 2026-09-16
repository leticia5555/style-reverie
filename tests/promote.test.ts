import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { loadCatalogFromDb } from "@/lib/db/catalog";
import {
  discardCandidate,
  keywordsFrom,
  promoteCandidate,
  seasonFor,
} from "@/lib/promote";
import { isNew, listCandidates, saveCandidates } from "@/lib/sources/discovery";
import { runDaily } from "@/lib/cron";
import { resetCatalogCache } from "@/lib/trends";
import type { Connector } from "@/lib/sources/types";
import { MIN_REAL_DAYS } from "@/lib/types";

let pg: PGlite;
let db: Db;

const candidata = (slug: string, nombre: string, categoria = "prenda") => ({
  slug,
  nameEs: nombre,
  category: categoria,
  evidence: [
    { title: `${nombre} en portada`, source: "Vogue México", link: `https://x.test/${slug}` },
  ],
});

/** Señales reales de N días seguidos para una tendencia. */
async function señalesReales(trendId: string, days: number, origin = "real") {
  for (let i = 0; i < days; i += 1) {
    const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
    await db.query(
      `insert into signals (trend_id, source, date, value, origin)
       values ($1, 'google_trends', $2, 50, $3)
       on conflict (trend_id, source, date) do nothing`,
      [trendId, date, origin],
    );
  }
}

beforeEach(async () => {
  await pg.query("delete from signals");
  await pg.query("delete from trends");
  await pg.query("delete from trend_candidates");
});

before(async () => {
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  setDb(db);
  await migrate(db);
});

after(async () => {
  setDb(null);
  await pg.close();
});

/* ── temporada y keywords ──────────────────────────────────────────── */

test("la temporada sale del mes en que se promueve", () => {
  assert.equal(seasonFor("2026-09-16"), "FW26");
  assert.equal(seasonFor("2026-04-02"), "SS26");
  assert.equal(seasonFor("2026-12-20"), "FW26");
  // Enero y febrero son el invierno que empezó el año anterior.
  assert.equal(seasonFor("2027-01-15"), "FW26");
  assert.equal(seasonFor("2027-03-01"), "SS27");
});

test("las keywords salen del nombre, normalizadas", () => {
  assert.deepEqual(keywordsFrom("Pantalón satinado"), ["pantalon satinado"]);
  assert.deepEqual(keywordsFrom("   "), []);
});

/* ── promover ──────────────────────────────────────────────────────── */

test("promover crea la tendencia con su categoría y sin histórico", async () => {
  await saveCandidates(db, [candidata("pantalon-satinado", "pantalón satinado", "prenda")], "2026-09-16");
  const result = await promoteCandidate(db, "pantalon-satinado", "2026-09-16");
  assert.equal(result.status, "ok");

  const rows = await db.query<{ id: string; category: string; season: string; keywords: string[]; promoted_at: unknown }>(
    "select id, category, season, keywords, promoted_at from trends",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "pantalon-satinado");
  assert.equal(rows[0].category, "prenda");
  assert.equal(rows[0].season, "FW26");
  assert.deepEqual(rows[0].keywords, ["pantalon satinado"]);
  assert.ok(rows[0].promoted_at, "queda marcada como promovida");

  const señales = await db.query<{ n: string }>("select count(*)::text as n from signals");
  assert.equal(señales[0].n, "0", "no se inventa histórico");
});

test("una categoría rara cae en prenda en vez de romper el catálogo", async () => {
  await saveCandidates(db, [candidata("rara", "cosa rara", "inventada")], "2026-09-16");
  await promoteCandidate(db, "rara", "2026-09-16");
  const rows = await db.query<{ category: string }>("select category from trends");
  assert.equal(rows[0].category, "prenda");
});

test("promover dos veces no duplica ni pisa nada", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  assert.equal((await promoteCandidate(db, "zueco", "2026-09-16")).status, "ok");
  const segunda = await promoteCandidate(db, "zueco", "2026-09-17");
  assert.equal(segunda.status, "already");
  const rows = await db.query<{ n: string }>("select count(*)::text as n from trends");
  assert.equal(rows[0].n, "1");
});

test("una candidata que no existe no promueve nada", async () => {
  assert.equal((await promoteCandidate(db, "fantasma", "2026-09-16")).status, "not-found");
});

test("la promovida desaparece de la lista de candidatas", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");
  assert.equal((await listCandidates(db)).length, 0);
});

/* ── descartar ─────────────────────────────────────────────────────── */

test("descartar la saca de la lista y no vuelve", async () => {
  await saveCandidates(db, [candidata("mala", "candidata mala")], "2026-09-16");
  assert.equal((await discardCandidate(db, "mala")).status, "ok");
  assert.equal((await listCandidates(db)).length, 0);

  // Y aunque la prensa la vuelva a mencionar, sigue descartada.
  await saveCandidates(db, [candidata("mala", "candidata mala")], "2026-09-20");
  assert.equal((await listCandidates(db)).length, 0, "no resucita");
});

test("descartar dos veces no es un error nuevo, pero lo dice", async () => {
  await saveCandidates(db, [candidata("mala", "candidata mala")], "2026-09-16");
  assert.equal((await discardCandidate(db, "mala")).status, "ok");
  assert.equal((await discardCandidate(db, "mala")).status, "not-found");
});

test("una descartada no se puede promover", async () => {
  await saveCandidates(db, [candidata("mala", "candidata mala")], "2026-09-16");
  await discardCandidate(db, "mala");
  assert.equal((await promoteCandidate(db, "mala", "2026-09-16")).status, "not-found");
});

/* ── acumulando: sin derivados hasta los 14 días ───────────────────── */

test("recién promovida sale en accumulating, no en trends", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");

  const catalog = await loadCatalogFromDb(db);
  assert.ok(catalog);
  assert.equal(catalog.trends.length, 0, "no entra en la tabla derivada");
  assert.equal(catalog.accumulating.length, 1);
  assert.equal(catalog.accumulating[0].realDays, 0);
  assert.equal(catalog.accumulating[0].id, "zueco");
  assert.deepEqual(catalog.accumulating[0].sources, []);
});

test("con 13 días de señal real sigue acumulando", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");
  await señalesReales("zueco", MIN_REAL_DAYS - 1);

  const catalog = await loadCatalogFromDb(db);
  assert.equal(catalog!.trends.length, 0, "un día antes todavía no deriva nada");
  assert.equal(catalog!.accumulating[0].realDays, MIN_REAL_DAYS - 1);
  assert.deepEqual(catalog!.accumulating[0].sources, ["google_trends"]);
});

test("al llegar a 14 días se gradúa sola y entra en la tabla", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");
  await señalesReales("zueco", MIN_REAL_DAYS);

  const catalog = await loadCatalogFromDb(db);
  assert.equal(catalog!.accumulating.length, 0);
  assert.equal(catalog!.trends.length, 1, "ya se puede derivar");
  assert.equal(catalog!.trends[0].id, "zueco");
});

test("los días mock no cuentan para graduarse", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");
  await señalesReales("zueco", MIN_REAL_DAYS + 10, "mock");

  const catalog = await loadCatalogFromDb(db);
  assert.equal(catalog!.trends.length, 0, "el mock no gradúa a nadie");
  assert.equal(catalog!.accumulating[0].realDays, 0);
});

test("una tendencia del seed nunca cuenta como acumulando", async () => {
  await db.query(
    `insert into trends (id, name_es, name_en, category, season, summary_es,
                         summary_en, score_year_ago, keywords, shopping)
     values ('del-seed', 'del seed', 'from seed', 'prenda', 'FW26', 'x', 'x',
             50, '{"del seed"}', '{}'::jsonb)`,
  );
  await señalesReales("del-seed", 2, "mock");

  const catalog = await loadCatalogFromDb(db);
  assert.equal(catalog!.accumulating.length, 0);
  assert.equal(catalog!.trends.length, 1, "sin promoted_at se deriva como siempre");
});

/* ── el cron las consulta desde el primer día ──────────────────────── */

test("una promovida entra en las tendencias que consultan las fuentes", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");

  const vistas: string[] = [];
  const espia: Connector = {
    key: "espia",
    async collect({ trends }) {
      vistas.push(...trends.map((trend) => trend.id));
      return { status: "ok", readings: [] };
    },
  };

  resetCatalogCache();
  await runDaily([espia], "2026-09-17");

  assert.ok(
    vistas.includes("zueco"),
    "sin esto nunca juntaría los 14 días y se quedaría acumulando para siempre",
  );
});

test("la promovida llega a las fuentes con keywords utilizables", async () => {
  await saveCandidates(db, [candidata("satinado", "pantalón satinado")], "2026-09-16");
  await promoteCandidate(db, "satinado", "2026-09-16");

  let keywords: string[] = [];
  const espia: Connector = {
    key: "espia",
    async collect({ trends }) {
      keywords = trends.find((trend) => trend.id === "satinado")?.keywords ?? [];
      return { status: "ok", readings: [] };
    },
  };

  resetCatalogCache();
  await runDaily([espia], "2026-09-17");

  // El conector de Google consulta keywords[0]; sin uno, no habría qué pedir.
  assert.deepEqual(keywords, ["pantalon satinado"]);
});

test("lo que escribe el cron sobre una promovida la va graduando", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");

  const fuente: Connector = {
    key: "google_trends",
    async collect({ trends, date }) {
      return {
        status: "ok",
        readings: trends
          .filter((trend) => trend.id === "zueco")
          .map((trend) => ({ trendId: trend.id, source: "google_trends", date, value: 42 })),
      };
    },
  };

  for (let i = 0; i < MIN_REAL_DAYS; i += 1) {
    resetCatalogCache();
    await runDaily([fuente], new Date(Date.UTC(2026, 8, 17 + i)).toISOString().slice(0, 10));
  }

  resetCatalogCache();
  const catalog = await loadCatalogFromDb(db);
  assert.equal(catalog!.accumulating.length, 0, "se graduó sola");
  assert.equal(catalog!.trends[0].id, "zueco");
});

test("el descubrimiento no vuelve a proponer lo que ya se promovió", async () => {
  await saveCandidates(db, [candidata("zueco", "zueco de madera")], "2026-09-16");
  await promoteCandidate(db, "zueco", "2026-09-16");

  resetCatalogCache();
  const catalog = await loadCatalogFromDb(db);
  const conocidas = [...catalog!.trends, ...catalog!.accumulating];

  assert.equal(
    isNew("zueco de madera", conocidas),
    false,
    "está acumulando, fuera de trends, pero el catálogo ya la tiene",
  );
});
