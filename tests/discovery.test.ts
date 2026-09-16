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
  batchHeadlines,
  cleanCandidateName,
  describeStats,
  EXTRACTION_PROMPT,
  discoverCandidates,
  isNew,
  mergeCandidates,
  outletsOf,
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

test("LAS MENCIONES SE ACUMULAN entre días, contando titulares distintos", async () => {
  // Al día siguiente vuelven los dos titulares de ayer y aparece uno nuevo.
  await saveCandidates(db, [candidata("chaqueta de motociclista", 3)], "2026-09-17");
  const rows = await listCandidates(db);
  assert.equal(rows.length, 1, "sigue siendo la misma candidata");
  assert.equal(rows[0].mentions, 3, "2 de ayer + 1 nuevo, no 2 + 3");
  assert.equal(rows[0].evidence.length, 3, "la evidencia tampoco se duplica");
  assert.equal(rows[0].first_seen, "2026-09-16", "la primera vez no cambia");
  assert.equal(rows[0].last_seen, "2026-09-17");
});

test("un titular repetido no vuelve a sumar", async () => {
  // Un artículo se queda en el feed varios días. Si cada corrida volviera a
  // sumarlo, la lista quedaría ordenada por antigüedad del feed, no por
  // cuánto se habla de la tendencia.
  const antes = (await listCandidates(db)).find(
    (r) => r.slug === "chaqueta-de-motociclista",
  )!;
  await saveCandidates(db, [candidata("chaqueta de motociclista", 3)], "2026-09-18");
  const despues = (await listCandidates(db)).find(
    (r) => r.slug === "chaqueta-de-motociclista",
  )!;

  assert.equal(despues.mentions, antes.mentions, "mismos titulares, mismas menciones");
  assert.equal(despues.last_seen, "2026-09-18", "pero sí se actualiza cuándo se vio");
});

test("se ordenan por menciones, la más repetida arriba", async () => {
  await saveCandidates(db, [candidata("gorro de pescador", 1)], "2026-09-17");
  const rows = await listCandidates(db);
  assert.equal(rows[0].slug, "chaqueta-de-motociclista");
  assert.equal(rows[1].slug, "gorro-de-pescador");
});

test("la evidencia se acumula pero no crece sin límite", async () => {
  // 40 titulares distintos, por encima del tope de 20 que se guardan.
  for (let i = 0; i < 4; i += 1) {
    await saveCandidates(
      db,
      [
        {
          slug: toSlug("chaqueta de motociclista"),
          nameEs: "chaqueta de motociclista",
          category: "prenda",
          evidence: Array.from({ length: 10 }, (_, j) => ({
            title: `otro titular ${i}-${j}`,
            source: "WWD",
            link: `https://example.test/extra-${i}-${j}`,
          })),
        },
      ],
      "2026-09-19",
    );
  }
  const row = (await listCandidates(db)).find(
    (r) => r.slug === "chaqueta-de-motociclista",
  )!;

  assert.equal(row.evidence.length, 20, "se recorta al tope");
  assert.ok(row.mentions >= 40, `las menciones sí siguen subiendo: ${row.mentions}`);

  // En los 20 huecos caben la última tanda entera y la anterior; lo más viejo
  // es lo que se cae, que es el orden que quiere quien mira la lista.
  const links = row.evidence.map((item) => item.link);
  assert.equal(links.filter((l) => l.includes("extra-3")).length, 10);
  assert.equal(links.filter((l) => l.includes("extra-2")).length, 10);
  assert.ok(!links.some((l) => l.includes("extra-0")), "lo más viejo se cayó");
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
    batches: 1,
    failedBatches: 0,
    returned: 6,
    droppedShortName: 1,
    droppedKnown: 2,
    droppedNoEvidence: 0,
    kept: 3,
  });

  assert.match(linea, /120 titulares/);
  assert.match(linea, /14 pasaron el filtro/);
  assert.match(linea, /14 al modelo en 1 tanda/);
  assert.match(linea, /40 negocio/);
  assert.match(linea, /58 sin moda/);
  assert.match(linea, /8 otro tema/);
  assert.match(linea, /6 candidatas/);
  assert.match(linea, /1 por nombre corto/);
  assert.match(linea, /2 ya en catálogo/);
  assert.match(linea, /0 sin evidencia/);
  assert.match(linea, /3 nuevas/);
});

/* ── el feed entero, en tandas ─────────────────────────────────────── */

test("el feed entero se parte en tandas, no se recorta a la primera", () => {
  const lote = Array.from({ length: 130 }, (_, i) => titular(`Titular ${i}`));
  const tandas = batchHeadlines(lote, 40, 6);

  assert.equal(tandas.length, 4);
  assert.deepEqual(tandas.map((t) => t.length), [40, 40, 40, 10]);
  // Nada se pierde y nada se repite.
  assert.equal(tandas.flat().length, 130);
  assert.equal(new Set(tandas.flat().map((h) => h.title)).size, 130);
});

test("el tope de tandas acota el gasto de un feed desbocado", () => {
  const lote = Array.from({ length: 1000 }, (_, i) => titular(`Titular ${i}`));
  assert.equal(batchHeadlines(lote, 40, 6).length, 6);
});

test("una candidata que sale en dos tandas suma su evidencia, sin repetir", () => {
  const ev = (link: string) => ({ title: `T ${link}`, source: "Vogue", link });
  const merged = mergeCandidates([
    [{ slug: "zueco", nameEs: "zueco", category: "prenda", evidence: [ev("a"), ev("b")] }],
    [{ slug: "zueco", nameEs: "zueco", category: null, evidence: [ev("b"), ev("c")] }],
    [{ slug: "bailarina", nameEs: "bailarina café", category: "prenda", evidence: [ev("d")] }],
  ]);

  assert.equal(merged.length, 2);
  const zueco = merged.find((c) => c.slug === "zueco");
  assert.deepEqual(zueco?.evidence.map((e) => e.link), ["a", "b", "c"]);
  assert.equal(zueco?.category, "prenda", "la categoría de la primera tanda gana");
});

test("mergeCandidates no muta las tandas que recibe", () => {
  const evidence = [{ title: "T", source: "Vogue", link: "a" }];
  const batch = [{ slug: "x", nameEs: "x", category: null, evidence }];
  mergeCandidates([batch, [{ slug: "x", nameEs: "x", category: null, evidence: [{ title: "U", source: "WWD", link: "b" }] }]]);
  assert.equal(evidence.length, 1, "la evidencia original sigue intacta");
});

/* ── el nombre que se extrae ───────────────────────────────────────── */

test("el artículo con el que arranca el modelo no crea otra candidata", () => {
  assert.equal(toSlug("el zueco"), toSlug("zueco"));
  assert.equal(toSlug("La bailarina café"), toSlug("bailarina café"));
  assert.equal(cleanCandidateName("los pantalones satinados"), "pantalones satinados");
});

test("no se muerde un nombre que empieza parecido a un artículo", () => {
  assert.equal(cleanCandidateName("lazo de seda"), "lazo de seda");
  assert.equal(cleanCandidateName("uniforme de oficina"), "uniforme de oficina");
  // Y si quitarlo dejara casi nada, se queda como está.
  assert.equal(cleanCandidateName("la"), "la");
});

test("el prompt le pide la prenda y no el tema, en singular", () => {
  // El prompt es producto, no implementación: si alguien lo suaviza, vuelven
  // las candidatas tipo "años 90" que no se pueden cotizar ni comprar.
  assert.match(EXTRACTION_PROMPT, /pantalón satinado/);
  assert.match(EXTRACTION_PROMPT, /SINGULAR/);
  assert.match(EXTRACTION_PROMPT, /no son tendencias|NO son tendencias/);
  assert.match(EXTRACTION_PROMPT, /tienda/);
});

/* ── medios distintos: un listicle no es cinco tendencias ──────────── */

test("outletsOf saca los medios distintos, sin repetir", () => {
  const candidate = {
    slug: "x", nameEs: "x", category: null,
    evidence: [
      { title: "a", source: "Vogue México", link: "https://x.test/a" },
      { title: "b", source: "Vogue México", link: "https://x.test/b" },
      { title: "c", source: "WWD", link: "https://x.test/c" },
    ],
  };
  assert.deepEqual(outletsOf(candidate), ["Vogue México", "WWD"]);
});

test("cinco candidatas del mismo listicle quedan por debajo de una citada por tres medios", async () => {
  // El caso real: "12 Fall Shoe Trends" de una sola revista producía cinco
  // candidatas con una mención cada una, arriba del todo.
  const listicle = {
    title: "12 Fall Shoe Trends",
    source: "Fashionista",
    link: "https://x.test/12-fall-shoe-trends",
  };
  await saveCandidates(
    db,
    ["zueco lista", "mocasín lista", "bota alta lista"].map((nombre) => ({
      slug: toSlug(nombre), nameEs: nombre, category: "prenda", evidence: [listicle],
    })),
    "2026-09-20",
  );
  await saveCandidates(
    db,
    [{
      slug: "pantalon-satinado", nameEs: "pantalón satinado", category: "prenda",
      evidence: [
        { title: "a", source: "Vogue México", link: "https://x.test/sat-a" },
        { title: "b", source: "WWD", link: "https://x.test/sat-b" },
        { title: "c", source: "Glamour México", link: "https://x.test/sat-c" },
      ],
    }],
    "2026-09-20",
  );

  const rows = await listCandidates(db);
  const satinado = rows.findIndex((r) => r.slug === "pantalon-satinado");
  const delListicle = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.slug.endsWith("-lista"));

  assert.equal(rows[satinado].sources, 3);
  assert.equal(rows[satinado].mentions, 3);
  for (const { row, i } of delListicle) {
    assert.equal(row.sources, 1, `${row.slug} sale de un solo medio`);
    assert.ok(
      satinado < i,
      `${row.slug} (1 medio) quedó por encima de una de 3 medios`,
    );
  }
});

test("el mismo medio otro día suma titular pero no medio", async () => {
  await saveCandidates(
    db,
    [{
      slug: "pantalon-satinado", nameEs: "pantalón satinado", category: "prenda",
      evidence: [{ title: "d", source: "WWD", link: "https://x.test/sat-d" }],
    }],
    "2026-09-21",
  );
  const row = (await listCandidates(db)).find((r) => r.slug === "pantalon-satinado")!;

  assert.equal(row.sources, 3, "WWD ya contaba: sigue habiendo tres medios");
  assert.equal(row.mentions, 4, "pero es un titular más");
});

test("un medio cuenta aunque su titular se caiga del recorte de evidencia", async () => {
  // Por esto los medios se guardan aparte y no se derivan de evidence: el
  // recorte a 20 titulares se llevaría por delante al medio que apareció una
  // sola vez hace meses, y la candidata parecería más débil de lo que es.
  await saveCandidates(
    db,
    [{
      slug: "recorte", nameEs: "prueba de recorte", category: "prenda",
      evidence: [{ title: "viejo", source: "Harper's Bazaar", link: "https://x.test/viejo" }],
    }],
    "2026-09-20",
  );
  for (let i = 0; i < 3; i += 1) {
    await saveCandidates(
      db,
      [{
        slug: "recorte", nameEs: "prueba de recorte", category: "prenda",
        evidence: Array.from({ length: 10 }, (_, j) => ({
          title: `nuevo ${i}-${j}`, source: "WWD", link: `https://x.test/nuevo-${i}-${j}`,
        })),
      }],
      "2026-09-21",
    );
  }

  const row = (await listCandidates(db)).find((r) => r.slug === "recorte")!;
  assert.equal(row.evidence.length, 20, "la evidencia sí se recortó");
  assert.ok(
    !row.evidence.some((item) => item.source === "Harper's Bazaar"),
    "y el titular viejo ya no está",
  );
  assert.equal(row.sources, 2, "pero el medio se sigue contando");
  assert.ok(row.outlets.includes("Harper's Bazaar"));
});

test("una base anterior a outlets se rellena desde la evidencia que ya tenía", async () => {
  // Sin esto, las candidatas que ya estaban guardadas aparecerían con cero
  // medios —y al final de la lista— hasta que la prensa volviera a nombrarlas.
  const vieja = new PGlite();
  const viejaDb: Db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await vieja.query(sql, params)).rows as T[];
    },
  };
  try {
    await migrate(viejaDb);
    await vieja.query("alter table trend_candidates drop column outlets");
    await vieja.query(
      `insert into trend_candidates
         (slug, name_es, category, mentions, first_seen, last_seen, evidence)
       values ('vieja', 'candidata vieja', 'prenda', 3, '2026-09-01', '2026-09-10', $1)`,
      [
        JSON.stringify([
          { title: "a", source: "Vogue México", link: "https://x.test/a" },
          { title: "b", source: "WWD", link: "https://x.test/b" },
          { title: "c", source: "WWD", link: "https://x.test/c" },
        ]),
      ],
    );

    await migrate(viejaDb);
    // Repetir la migración no puede volver a tocarla.
    await migrate(viejaDb);

    const row = (await listCandidates(viejaDb))[0];
    assert.equal(row.sources, 2);
    assert.deepEqual(row.outlets, ["Vogue México", "WWD"]);
  } finally {
    await vieja.close();
  }
});
