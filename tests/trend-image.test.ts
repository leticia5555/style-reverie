import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { curatedImage, editorialImage, resolveTrendImage } from "@/lib/trend-image";
import type { Article } from "@/lib/editorial";

const articulo = (
  trendId: string,
  publishedAt: string,
  imageUrl: string | null,
  sourceName = "Vogue México",
): Article => ({
  id: `${trendId}-${publishedAt}`,
  title: `${trendId} en portada`,
  link: `https://ejemplo.test/${trendId}-${publishedAt}`,
  source: "vogue-mx",
  sourceName,
  lang: "es",
  publishedAt,
  snippet: "",
  matches: [{ trendId, keyword: trendId }],
  imageUrl,
  imageFrom: imageUrl ? "feed" : null,
});

test("sin foto curada ni artículo con imagen no hay imagen", () => {
  assert.equal(resolveTrendImage("pantalon-barril", []), null);
});

test("gana el artículo MÁS RECIENTE que la menciona con foto", () => {
  const image = editorialImage("pantalon-barril", [
    articulo("pantalon-barril", "2026-09-01T10:00:00.000Z", "https://a.test/vieja.jpg"),
    articulo("pantalon-barril", "2026-09-15T10:00:00.000Z", "https://a.test/nueva.jpg"),
    articulo("pantalon-barril", "2026-09-10T10:00:00.000Z", "https://a.test/media.jpg"),
  ]);
  assert.equal(image?.url, "https://a.test/nueva.jpg");
});

test("un artículo sin foto no cuenta, aunque sea el más reciente", () => {
  const image = editorialImage("pantalon-barril", [
    articulo("pantalon-barril", "2026-09-20T10:00:00.000Z", null),
    articulo("pantalon-barril", "2026-09-01T10:00:00.000Z", "https://a.test/vieja.jpg"),
  ]);
  assert.equal(image?.url, "https://a.test/vieja.jpg");
});

test("un artículo que no menciona la tendencia no le presta su foto", () => {
  const image = editorialImage("pantalon-barril", [
    articulo("falda-cargo", "2026-09-20T10:00:00.000Z", "https://a.test/otra.jpg"),
  ]);
  assert.equal(image, null);
});

test("la imagen del feed llega con el medio y el enlace al artículo", () => {
  const image = editorialImage("pantalon-barril", [
    articulo("pantalon-barril", "2026-09-15T10:00:00.000Z", "https://a.test/f.jpg", "WWD"),
  ]);
  assert.equal(image?.credit, "WWD");
  assert.match(image?.creditUrl ?? "", /^https:\/\/ejemplo\.test\//);
  assert.equal(image?.from, "editorial");
});

/* ── la curada manda ───────────────────────────────────────────────── */

test("sin archivo curado, curatedImage devuelve null", () => {
  assert.equal(curatedImage("no-existe-esta-tendencia"), null);
});

test("el ejemplo del README de content/trends documenta los tres campos", () => {
  // Si alguien quita credit o creditUrl del ejemplo, la siguiente persona
  // curará fotos sin crédito y el componente las descartará en silencio.
  const doc = readFileSync("./content/trends/EJEMPLO.md", "utf8");
  for (const campo of ["imageUrl", "credit", "creditUrl"]) {
    assert.match(doc, new RegExp(`"${campo}"`), `falta ${campo} en el ejemplo`);
  }
  assert.match(doc, /Pinterest/, "debe decir de dónde NO se sacan fotos");
});

test("nada del código busca fotos en Pinterest ni en Google Imágenes", () => {
  // La regla no es negociable y una línea de código la rompería en silencio.
  const source = readFileSync("./lib/trend-image.ts", "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/pinterest|googleusercontent|gstatic/i.test(code));
});
