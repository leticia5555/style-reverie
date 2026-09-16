import { test } from "node:test";
import assert from "node:assert/strict";
import { forecast } from "@/lib/forecast";

/** Serie de scores con fechas consecutivas desde el 1 de agosto de 2026. */
const serie = (values: number[]) =>
  values.map((score, index) => ({
    date: new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10),
    score,
  }));

const rampa = (n: number, desde: number, paso: number) =>
  serie(Array.from({ length: n }, (_, i) => desde + i * paso));

test("una recta de pendiente 1 proyecta exactamente +7 a siete días", () => {
  const result = forecast(rampa(30, 40, 1))!;
  assert.equal(result.slopePerDay, 1);
  assert.equal(result.target, 76);
});

test("una recta perfecta da R² = 1", () => {
  assert.equal(forecast(rampa(30, 40, 1))!.fit, 1);
});

test("devuelve exactamente siete puntos", () => {
  assert.equal(forecast(rampa(30, 40, 1))!.points.length, 7);
});

test("el primer punto proyectado es el día siguiente al último real", () => {
  const result = forecast(rampa(30, 40, 1))!;
  assert.equal(result.points[0].date, "2026-08-31");
  assert.equal(result.points.at(-1)!.date, "2026-09-06");
});

test("una serie plana no se mueve", () => {
  const result = forecast(serie(Array(30).fill(55)))!;
  assert.equal(result.slopePerDay, 0);
  assert.equal(result.target, 55);
});

test("una bajada proyecta hacia abajo", () => {
  const result = forecast(rampa(30, 80, -0.5))!;
  assert.equal(result.slopePerDay, -0.5);
  assert.ok(result.target < 66);
});

test("se recorta en 100: el score no puede desbordar por arriba", () => {
  assert.equal(forecast(rampa(30, 60, 2))!.target, 100);
});

test("se recorta en 0: el score no puede bajar de cero", () => {
  assert.equal(forecast(rampa(30, 30, -1))!.target, 0);
});

test("una serie en zigzag da R² cero: la recta no describe nada", () => {
  const zigzag = serie(
    Array.from({ length: 30 }, (_, i) => 50 + (i % 2 ? 6 : -6)),
  );
  assert.ok(forecast(zigzag)!.fit < 0.1);
});

test("solo mira la ventana: ignora lo anterior a los últimos 30 días", () => {
  const larga = serie([
    ...Array(60).fill(10),
    ...Array.from({ length: 30 }, (_, i) => 40 + i),
  ]);
  assert.equal(forecast(larga)!.fit, 1);
});

test("una serie de un solo punto no se puede proyectar", () => {
  assert.equal(forecast(serie([50])), null);
});
