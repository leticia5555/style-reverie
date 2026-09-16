import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLifecycle, LIFECYCLE_THRESHOLDS } from "@/lib/lifecycle";

const { emergingMaxScore, peakMinScore, risingMomentum, fallingMomentum } =
  LIFECYCLE_THRESHOLDS;

test("caída sostenida gana a todo lo demás, incluso con score altísimo", () => {
  assert.equal(deriveLifecycle(95, fallingMomentum), "CAYENDO");
  assert.equal(deriveLifecycle(95, fallingMomentum - 0.1), "CAYENDO");
});

test("justo por encima del umbral de caída ya no es CAYENDO", () => {
  assert.notEqual(deriveLifecycle(95, fallingMomentum + 0.1), "CAYENDO");
});

test("score alto sin impulso es PICO, y con impulso vuelve a SUBIENDO", () => {
  assert.equal(deriveLifecycle(peakMinScore, 0), "PICO");
  assert.equal(deriveLifecycle(peakMinScore, risingMomentum - 0.1), "PICO");
  assert.equal(deriveLifecycle(peakMinScore, risingMomentum), "SUBIENDO");
});

test("justo por debajo del score de saturación no es PICO", () => {
  assert.notEqual(deriveLifecycle(peakMinScore - 0.1, 0), "PICO");
});

test("el corte entre EMERGIENDO y SUBIENDO está en el score, no en el momentum", () => {
  assert.equal(
    deriveLifecycle(emergingMaxScore - 0.1, risingMomentum),
    "EMERGIENDO",
  );
  assert.equal(deriveLifecycle(emergingMaxScore, risingMomentum), "SUBIENDO");
});

test("subida lenta clasifica igual que subida rápida", () => {
  assert.equal(deriveLifecycle(emergingMaxScore - 0.1, 0.1), "EMERGIENDO");
  assert.equal(deriveLifecycle(emergingMaxScore, 0.1), "SUBIENDO");
});

test("plana y pequeña es EMERGIENDO; plana y grande sin llegar a pico, CAYENDO", () => {
  assert.equal(deriveLifecycle(emergingMaxScore - 0.1, 0), "EMERGIENDO");
  assert.equal(deriveLifecycle(peakMinScore - 0.1, 0), "CAYENDO");
});

test("los cuatro ciclos son alcanzables", () => {
  const vistos = new Set([
    deriveLifecycle(40, 3),
    deriveLifecycle(70, 3),
    deriveLifecycle(85, 0),
    deriveLifecycle(85, -3),
  ]);
  assert.deepEqual(
    [...vistos].sort(),
    ["CAYENDO", "EMERGIENDO", "PICO", "SUBIENDO"],
  );
});

test("nunca devuelve algo fuera de los cuatro ciclos", () => {
  for (let score = 0; score <= 100; score += 2.5) {
    for (let m = -6; m <= 6; m += 0.5) {
      assert.ok(
        ["EMERGIENDO", "SUBIENDO", "PICO", "CAYENDO"].includes(
          deriveLifecycle(score, m),
        ),
        `score=${score} momentum=${m}`,
      );
    }
  }
});
