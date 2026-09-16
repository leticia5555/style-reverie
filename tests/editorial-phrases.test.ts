import { test } from "node:test";
import assert from "node:assert/strict";
import {
  joinPhrases,
  momentumPhrase,
  risingPhrase,
  scorePhrase,
  sourcesPhrase,
  yoyPhrase,
} from "@/lib/editorial-phrases";

test("el momentum se dice, no se pinta como badge", () => {
  assert.equal(momentumPhrase(3.9).es, "subiendo 3.9 puntos esta semana");
  assert.equal(momentumPhrase(3.9).en, "up 3.9 points this week");
  assert.equal(momentumPhrase(-1.2).es, "cediendo 1.2 puntos esta semana");
});

test("un movimiento que es ruido se dice estable, no +0.0", () => {
  // Decir "subiendo 0.1 puntos" es fingir precisión que el dato no tiene.
  assert.equal(momentumPhrase(0.1).es, "estable esta semana");
  assert.equal(momentumPhrase(-0.05).es, "estable esta semana");
  assert.equal(momentumPhrase(0).en, "flat this week");
});

test("el signo del momentum nunca se cuela en el texto", () => {
  // "cediendo -1.2 puntos" diría lo contrario de lo que pasa.
  assert.ok(!momentumPhrase(-1.2).es.includes("-"));
  assert.ok(!momentumPhrase(-1.2).en.includes("-"));
});

test("la variación anual se redondea y se dice en los dos sentidos", () => {
  assert.equal(yoyPhrase(36.4).es, "un 36% por encima de hace un año");
  assert.equal(yoyPhrase(-27.2).es, "un 27% por debajo de hace un año");
  assert.equal(yoyPhrase(0.2).es, "igual que hace un año");
});

test("los días y las fuentes concuerdan en singular", () => {
  assert.equal(risingPhrase(1).es, "lleva un día subiendo");
  assert.equal(risingPhrase(12).es, "lleva 12 días subiendo");
  assert.equal(risingPhrase(0).es, "", "cero días no se dice");
  assert.equal(sourcesPhrase(1, 5).es, "lo confirma 1 de 5 fuentes");
  assert.equal(sourcesPhrase(5, 5).es, "lo confirman 5 de 5 fuentes");
});

test("las frases se unen con mayúscula inicial y punto final", () => {
  const frase = joinPhrases([
    scorePhrase(86.9),
    momentumPhrase(3.9),
    yoyPhrase(36),
  ]);
  assert.equal(
    frase.es,
    "Cotiza en 86.9, subiendo 3.9 puntos esta semana, un 36% por encima de hace un año.",
  );
  assert.match(frase.en, /^Trading at 86\.9, up 3\.9 points this week/);
});

test("una frase vacía no deja una coma huérfana", () => {
  const frase = joinPhrases([scorePhrase(50), risingPhrase(0)]);
  assert.equal(frase.es, "Cotiza en 50.0.");
  assert.ok(!frase.es.includes(", ."));
});

test("sin ninguna frase no se inventa un punto suelto", () => {
  assert.equal(joinPhrases([]).es, "");
  assert.equal(joinPhrases([risingPhrase(0)]).en, "");
});

test("toda frase existe en los dos idiomas", () => {
  const todas = [
    momentumPhrase(2), momentumPhrase(-2), momentumPhrase(0),
    yoyPhrase(10), yoyPhrase(-10), yoyPhrase(0),
    risingPhrase(3), sourcesPhrase(2, 5), scorePhrase(70),
  ];
  for (const frase of todas) {
    assert.ok(frase.es.length > 0, "falta el español");
    assert.ok(frase.en.length > 0, "falta el inglés");
    assert.notEqual(frase.es, frase.en, `sin traducir: ${frase.es}`);
  }
});
