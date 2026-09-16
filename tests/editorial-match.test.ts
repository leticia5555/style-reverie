import { test } from "node:test";
import assert from "node:assert/strict";
import { isUsableKeyword, matchTrends, normalizeTerm } from "@/lib/editorial-match";
import { classifyTerm, keywordsFor } from "@/lib/keyword-lang";
import { getTrends } from "@/lib/trends";

const trends = getTrends().map(({ id, keywords }) => ({ id, keywords }));
const ids = (text: string) =>
  matchTrends(text, trends)
    .map((match) => match.trendId)
    .sort();

test("normaliza acentos, guiones y mayúsculas a la misma cadena", () => {
  assert.equal(normalizeTerm("Cat-Eye"), "cat eye");
  assert.equal(normalizeTerm("Marrón"), "marron");
  assert.equal(normalizeTerm("  doble   espacio "), "doble espacio");
});

test("descarta términos de una palabra corta, que dan falsos positivos", () => {
  assert.equal(isUsableKeyword("capa"), false);
  assert.equal(isUsableKeyword("obi belt"), true);
  assert.equal(isUsableKeyword("crochet"), true);
});

test("detecta una tendencia por su sinónimo en inglés", () => {
  assert.deepEqual(ids("The Barrel Jeans Are Not Going Anywhere in 2026"), [
    "pantalon-barril",
  ]);
});

test("detecta dos tendencias en el mismo titular", () => {
  assert.deepEqual(
    ids("Butter Yellow Is Finally Cooling Off to matcha green"),
    ["amarillo-mantequilla", "verde-matcha"],
  );
});

test("exige palabra completa: capa no casa dentro de escapade", () => {
  assert.deepEqual(ids("A Weekend Escapade in Capri"), []);
});

test("exige palabra completa también en español", () => {
  assert.deepEqual(ids("Se escapaba del molde"), []);
});

test("casa un término con guion contra su forma sin guion", () => {
  assert.deepEqual(
    ids("Quiet Luxury brands face a slowdown as cat-eye sunglasses surge"),
    ["gafas-cat-eye", "lujo-silencioso"],
  );
});

test("casa en español con acentos", () => {
  assert.deepEqual(ids("El marrón cacao sustituye al negro"), ["marron-cacao"]);
});

test("casa un plural presente en los sinónimos", () => {
  assert.deepEqual(ids("Flat Mary Jane styles dominate wholesale"), [
    "mary-jane-planas",
  ]);
});

test("casa al principio y al final del texto", () => {
  assert.deepEqual(ids("cargo skirt"), ["falda-cargo"]);
});

/* ---- Idioma de la fuente ------------------------------------------------ */

const inLang = (text: string, lang: "es" | "en") =>
  matchTrends(text, trends, lang)
    .map((match) => match.trendId)
    .sort();

test("clasifica los términos por idioma, y los préstamos en ambos", () => {
  assert.equal(classifyTerm("pantalon barril"), "es");
  assert.equal(classifyTerm("barrel leg trousers"), "en");
  // Préstamo puro: ningún marcador de ninguno de los dos idiomas.
  assert.equal(classifyTerm("boho"), "both");
  assert.equal(classifyTerm("cat eye"), "both");
  // Con el sustantivo en español ya es una frase en español.
  assert.equal(classifyTerm("gafas cat eye"), "es");
});

test("una fuente en español cruza por el término en español", () => {
  assert.deepEqual(inLang("El pantalón barril manda esta temporada", "es"), [
    "pantalon-barril",
  ]);
});

test("una fuente en inglés cruza por el término en inglés", () => {
  assert.deepEqual(inLang("Barrel leg trousers are back", "en"), [
    "pantalon-barril",
  ]);
});

test("el idioma de la fuente descarta el término del otro idioma", () => {
  // El mismo titular en español no debe casar leyendo términos en inglés, ni
  // al revés: es lo que hacía que una fuente mexicana cruzara por casualidad.
  assert.deepEqual(inLang("El pantalón barril manda esta temporada", "en"), []);
  assert.deepEqual(inLang("Barrel leg trousers are back", "es"), []);
});

test("un préstamo cruza desde cualquiera de las dos fuentes", () => {
  assert.deepEqual(inLang("El crochet vuelve a la playa", "es"), ["crochet-fino"]);
  assert.deepEqual(inLang("Crochet is the beach staple", "en"), ["crochet-fino"]);
});

test("sin idioma se buscan todos los términos, como antes", () => {
  assert.deepEqual(ids("El pantalón barril manda esta temporada"), [
    "pantalon-barril",
  ]);
  assert.deepEqual(ids("Barrel leg trousers are back"), ["pantalon-barril"]);
});

test("una tendencia sin términos en un idioma conserva todos los suyos", () => {
  // Filtrar no puede dejar a una tendencia muda: vale más un match por el
  // nombre en inglés que ninguno.
  const solo = [{ id: "solo", keywords: ["quiet luxury"] }];
  assert.deepEqual(
    matchTrends("La era del quiet luxury", solo, "es").map((m) => m.trendId),
    ["solo"],
  );
});

test("toda tendencia del catálogo sigue teniendo términos en ambos idiomas", () => {
  for (const trend of trends) {
    for (const lang of ["es", "en"] as const) {
      assert.ok(
        keywordsFor(trend.keywords, lang).some(isUsableKeyword),
        `${trend.id} se queda sin términos usables en ${lang}`,
      );
    }
  }
});
