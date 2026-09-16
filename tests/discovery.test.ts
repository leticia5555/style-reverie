import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import {
  isFashionHeadline,
  filterFashion,
  type Headline,
} from "@/lib/sources/fashion-filter";
import {
  discoverCandidates,
  isNew,
  listCandidates,
  saveCandidates,
  toSlug,
} from "@/lib/sources/discovery";
import { getTrends } from "@/lib/trends";

const trends = getTrends();

const titular = (title: string, snippet = ""): Headline => ({
  id: title,
  title,
  snippet,
  sourceName: "Vogue",
  link: `https://example.test/${encodeURIComponent(title)}`,
  publishedAt: "2026-09-16T10:00:00.000Z",
});

/* ── el filtro corre antes de gastar tokens ────────────────────────── */

test("deja pasar un titular de moda", () => {
  assert.equal(
    isFashionHeadline(titular("The Barrel Jeans Are Not Going Anywhere")),
    true,
  );
  assert.equal(
    isFashionHeadline(titular("El abrigo de borreguito domina la temporada")),
    true,
  );
});

test("descarta belleza", () => {
  assert.equal(
    isFashionHeadline(titular("The best serum for winter skincare")),
    false,
  );
  assert.equal(
    isFashionHeadline(
      titular("Her makeup and hairstyle at the red carpet arrival"),
    ),
    false,
  );
});

test("descarta celebridades", () => {
  assert.equal(
    isFashionHeadline(titular("Inside the engagement and wedding photos")),
    false,
  );
});

test("descarta negocio", () => {
  assert.equal(
    isFashionHeadline(titular("Kering reports quarterly earnings below forecast")),
    false,
  );
  assert.equal(
    isFashionHeadline(titular("The house appoints a new CEO after the merger")),
    false,
  );
});

test("un titular de moda en alfombra roja sí pasa", () => {
  assert.equal(
    isFashionHeadline(
      titular("The coat trend that ruled the red carpet arrival"),
    ),
    true,
    "predomina la moda sobre la mención de alfombra roja",
  );
});

test("un titular sin señales de ropa no pasa", () => {
  assert.equal(isFashionHeadline(titular("A weekend in Capri")), false);
});

test("filterFashion conserva el orden y solo quita lo que no es moda", () => {
  const lote = [
    titular("The Barrel Jeans Are Not Going Anywhere"),
    titular("The best serum for winter skincare"),
    titular("Cargo skirts move from niche to volume"),
  ];
  const resultado = filterFashion(lote);
  assert.equal(resultado.length, 2);
  assert.deepEqual(
    resultado.map((h) => h.title),
    [lote[0].title, lote[2].title],
  );
});

/* ── sin clave, el paso se salta sin llamar a nadie ────────────────── */

test("sin ANTHROPIC_API_KEY se salta y lo dice", async () => {
  const anterior = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const result = await discoverCandidates(
    [titular("The Barrel Jeans Are Not Going Anywhere")],
    trends,
  );
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /ANTHROPIC_API_KEY/);

  if (anterior) process.env.ANTHROPIC_API_KEY = anterior;
});

test("si nada pasa el filtro, no se llama a la API aunque haya clave", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-de-prueba";
  const result = await discoverCandidates(
    [titular("The best serum for winter skincare")],
    trends,
  );
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /filtro de moda/);
  delete process.env.ANTHROPIC_API_KEY;
});

/* ── lo que ya está en el catálogo no es un descubrimiento ─────────── */

test("una candidata que ya existe en el catálogo se descarta", () => {
  assert.equal(isNew("pantalón barril", trends), false);
  assert.equal(isNew("falda cargo", trends), false);
});

test("una candidata genuinamente nueva pasa", () => {
  assert.equal(isNew("chaqueta de motociclista", trends), true);
});

test("el slug es estable y normaliza acentos", () => {
  assert.equal(toSlug("Pantalón Barril"), "pantalon-barril");
  assert.equal(toSlug("  Verde   Matcha  "), "verde-matcha");
  assert.equal(toSlug("Cat-Eye"), "cat-eye");
});

/* ── acumulación en la base ────────────────────────────────────────── */

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
});

after(async () => {
  setDb(null);
  await pg.close();
});

const candidata = (nombre: string, evidencias: number) => ({
  slug: toSlug(nombre),
  nameEs: nombre,
  category: "prenda",
  evidence: Array.from({ length: evidencias }, (_, i) => ({
    title: `${nombre} ${i}`,
    source: "WWD",
    link: `https://example.test/${toSlug(nombre)}-${i}`,
  })),
});

test("guarda una candidata nueva con su conteo", async () => {
  await saveCandidates(db, [candidata("chaqueta de motociclista", 2)], "2026-09-16");
  const rows = await listCandidates(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mentions, 2);
  assert.equal(rows[0].first_seen, "2026-09-16");
});

test("LAS MENCIONES SE ACUMULAN entre días", async () => {
  await saveCandidates(db, [candidata("chaqueta de motociclista", 3)], "2026-09-17");
  const rows = await listCandidates(db);
  assert.equal(rows.length, 1, "sigue siendo la misma candidata");
  assert.equal(rows[0].mentions, 5, "2 + 3");
  assert.equal(rows[0].first_seen, "2026-09-16", "la primera vez no cambia");
  assert.equal(rows[0].last_seen, "2026-09-17");
});

test("se ordenan por menciones, la más repetida arriba", async () => {
  await saveCandidates(db, [candidata("gorro de pescador", 1)], "2026-09-17");
  const rows = await listCandidates(db);
  assert.equal(rows[0].slug, "chaqueta-de-motociclista");
  assert.equal(rows[1].slug, "gorro-de-pescador");
});

test("la evidencia se acumula pero no crece sin límite", async () => {
  for (let i = 0; i < 5; i += 1) {
    await saveCandidates(db, [candidata("chaqueta de motociclista", 4)], "2026-09-18");
  }
  const rows = await listCandidates(db);
  const row = rows.find((r) => r.slug === "chaqueta-de-motociclista")!;
  assert.ok(row.evidence.length <= 12, `evidencias: ${row.evidence.length}`);
});

test("una candidata promovida desaparece de la lista", async () => {
  await db.query(
    "update trend_candidates set promoted_at = now() where slug = 'gorro-de-pescador'",
  );
  const rows = await listCandidates(db);
  assert.ok(!rows.some((row) => row.slug === "gorro-de-pescador"));
});
