import { test } from "node:test";
import assert from "node:assert/strict";
import { isUsableKeyword, matchTrends, normalizeTerm } from "@/lib/editorial-match";
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
