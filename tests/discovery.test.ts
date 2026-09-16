import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import {
  classifyHeadline,
  filterBreakdown,
  isFashionHeadline,
  filterFashion,
  type Headline,
} from "@/lib/sources/fashion-filter";
import {
  describeStats,
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

/* ── el filtro endurecido: lo que llegó en la primera corrida real ─── */

test("descarta un nombramiento aunque hable de colecciones", () => {
  // Esto es lo que pasaba antes: "collection" contaba como señal de moda y
  // una nota de sillas musicales llegaba al modelo.
  assert.equal(
    classifyHeadline(
      titular("Balenciaga appoints a new designer ahead of the spring collection"),
    ),
    "bloqueado",
  );
  assert.equal(
    classifyHeadline(titular("Gucci nombra nuevo director para su colección")),
    "bloqueado",
  );
});

test("descarta cadena de suministro aunque nombre prendas", () => {
  assert.equal(
    classifyHeadline(titular("Tariffs on denim imports squeeze the supply chain")),
    "bloqueado",
  );
  assert.equal(
    classifyHeadline(
      titular("Los aranceles encarecen el abrigo de lana importado"),
    ),
    "bloqueado",
  );
});

test("descarta exposiciones y efemérides de museo", () => {
  assert.equal(
    classifyHeadline(
      titular("The museum exhibition revisits half a century of tailoring"),
    ),
    "bloqueado",
  );
  assert.equal(
    classifyHeadline(titular("Una retrospectiva del vestido de alta costura")),
    "bloqueado",
  );
});

test("el veto busca palabra completa, no subcadena", () => {
  // "ceo" dentro de "océano" no puede tumbar un titular de moda.
  assert.equal(
    classifyHeadline(titular("El vestido color océano que domina la temporada")),
    "ok",
  );
});

test("una crónica de pasarela con prenda concreta sigue pasando", () => {
  assert.equal(
    classifyHeadline(
      titular("On the runway, barrel jeans and shearling coats led the collection"),
    ),
    "ok",
  );
});

test("el contexto solo no basta, pero dos señales de contexto sí", () => {
  // "collection" sola describe el marco, no una tendencia.
  assert.equal(classifyHeadline(titular("Inside the spring collection")), "sin-moda");
  assert.equal(
    classifyHeadline(titular("The quiet luxury look is the trend of the season")),
    "ok",
  );
});

test("cada descarte dice por qué, que es lo que se registra", () => {
  assert.equal(classifyHeadline(titular("A weekend in Capri")), "sin-moda");
  assert.equal(
    classifyHeadline(titular("Kering reports quarterly earnings")),
    "bloqueado",
  );
  // Nombra una prenda, pero el titular es de belleza: gana el otro tema.
  assert.equal(
    classifyHeadline(
      titular("Her dress, makeup, hairstyle and manicure at the red carpet arrival"),
    ),
    "otro-tema",
  );
});

test("el desglose suma exactamente los titulares recibidos", () => {
  const lote = [
    titular("The Barrel Jeans Are Not Going Anywhere"),
    titular("Kering reports quarterly earnings"),
    titular("A weekend in Capri"),
    titular("Her dress, makeup, hairstyle and manicure at the red carpet arrival"),
    titular("Cargo skirts move from niche to volume"),
  ];
  const desglose = filterBreakdown(lote);
  assert.deepEqual(desglose, {
    ok: 2,
    bloqueado: 1,
    "sin-moda": 1,
    "otro-tema": 1,
  });
  const total = Object.values(desglose).reduce((a, b) => a + b, 0);
  assert.equal(total, lote.length);
  assert.equal(desglose.ok, filterFashion(lote).length);
});

/* ── el desglose que se guarda en signal_runs ──────────────────────── */

test("saltarse el paso también deja el desglose, no solo el motivo", async () => {
  const anterior = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const result = await discoverCandidates(
      [titular("The Barrel Jeans Are Not Going Anywhere")],
      trends,
    );
    assert.equal(result.status, "skipped");
    assert.equal(result.stats.received, 1);
  } finally {
    if (anterior) process.env.ANTHROPIC_API_KEY = anterior;
  }
});

test("si el filtro se lo come todo, el desglose dice cuántos y por qué", async () => {
  const anterior = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-test-no-se-usa";
  try {
    const lote = [
      titular("Kering reports quarterly earnings"),
      titular("The house appoints a new designer"),
      titular("A weekend in Capri"),
    ];
    const result = await discoverCandidates(lote, trends);

    assert.equal(result.status, "skipped", "nadie pasó el filtro: no se llama a la API");
    assert.equal(result.stats.received, 3);
    assert.equal(result.stats.sent, 0);
    assert.equal(result.stats.filter.bloqueado, 2);
    assert.equal(result.stats["filter"]["sin-moda"], 1);
    assert.equal(result.stats.returned, 0);
  } finally {
    if (anterior) process.env.ANTHROPIC_API_KEY = anterior;
    else delete process.env.ANTHROPIC_API_KEY;
  }
});

test("la línea del desglose nombra los tres filtros de después", () => {
  const linea = describeStats({
    received: 120,
    filter: { ok: 14, bloqueado: 40, "sin-moda": 58, "otro-tema": 8 },
    sent: 14,
    returned: 6,
    droppedShortName: 1,
    droppedKnown: 2,
    droppedNoEvidence: 0,
    kept: 3,
  });

  assert.match(linea, /120 titulares/);
  assert.match(linea, /14 pasaron el filtro/);
  assert.match(linea, /40 negocio/);
  assert.match(linea, /58 sin moda/);
  assert.match(linea, /8 otro tema/);
  assert.match(linea, /6 candidatas/);
  assert.match(linea, /1 por nombre corto/);
  assert.match(linea, /2 ya en catálogo/);
  assert.match(linea, /0 sin evidencia/);
  assert.match(linea, /3 nuevas/);
});
