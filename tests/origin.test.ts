import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitByOrigin,
  summarizeCatalog,
  summarizeOrigin,
} from "@/lib/origin";
import type { OriginByDate } from "@/lib/db/catalog";

const origins = (entries: [string, "mock" | "real"][]): OriginByDate =>
  new Map(entries);

const serie = (dates: string[]) =>
  dates.map((date, index) => ({ date, score: 10 + index }));

test("todo mock es mock", () => {
  const summary = summarizeOrigin(
    origins([["2026-09-01", "mock"], ["2026-09-02", "mock"]]),
  );
  assert.equal(summary.state, "mock");
  assert.equal(summary.firstRealDate, null);
});

test("todo real es real", () => {
  const summary = summarizeOrigin(
    origins([["2026-09-01", "real"], ["2026-09-02", "real"]]),
  );
  assert.equal(summary.state, "real");
  assert.equal(summary.realDays, 2);
});

test("mezcla es mixta y reporta el primer día real", () => {
  const summary = summarizeOrigin(
    origins([
      ["2026-09-01", "mock"],
      ["2026-09-02", "mock"],
      ["2026-09-03", "real"],
    ]),
  );
  assert.equal(summary.state, "mixed");
  assert.equal(summary.firstRealDate, "2026-09-03");
  assert.equal(summary.realDays, 1);
});

test("sin datos de origen se asume mock", () => {
  assert.equal(summarizeOrigin(undefined).state, "mock");
  assert.equal(summarizeOrigin(new Map()).state, "mock");
});

test("el catálogo es real solo si TODAS las tendencias lo son", () => {
  const todoReal = new Map([
    ["a", origins([["2026-09-01", "real"]])],
    ["b", origins([["2026-09-01", "real"]])],
  ]);
  assert.equal(summarizeCatalog(todoReal).state, "real");

  const unaMock = new Map([
    ["a", origins([["2026-09-01", "real"]])],
    ["b", origins([["2026-09-01", "mock"]])],
  ]);
  assert.equal(
    summarizeCatalog(unaMock).state,
    "mixed",
    "una sola tendencia mock basta para que el catálogo no sea real",
  );
});

test("un solo día mock dentro de una tendencia la deja mixta", () => {
  const casiReal = new Map([
    [
      "a",
      origins([
        ["2026-09-01", "mock"],
        ["2026-09-02", "real"],
        ["2026-09-03", "real"],
      ]),
    ],
  ]);
  assert.equal(summarizeCatalog(casiReal).state, "mixed");
});

test("el catálogo reporta el día real más antiguo de todas", () => {
  const mezcla = new Map([
    ["a", origins([["2026-09-05", "mock"], ["2026-09-06", "real"]])],
    ["b", origins([["2026-09-02", "mock"], ["2026-09-03", "real"]])],
  ]);
  assert.equal(summarizeCatalog(mezcla).firstRealDate, "2026-09-03");
});

test("una serie sin tramo real no se parte: no hay nada que atenuar", () => {
  assert.equal(
    splitByOrigin(
      serie(["2026-09-01", "2026-09-02"]),
      origins([["2026-09-01", "mock"], ["2026-09-02", "mock"]]),
    ),
    null,
  );
});

test("una serie enteramente real tampoco se parte", () => {
  assert.equal(
    splitByOrigin(
      serie(["2026-09-01", "2026-09-02"]),
      origins([["2026-09-01", "real"], ["2026-09-02", "real"]]),
    ),
    null,
  );
});

test("una serie mixta se parte en dos tramos por el día del corte", () => {
  const split = splitByOrigin(
    serie(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]),
    origins([
      ["2026-09-01", "mock"],
      ["2026-09-02", "mock"],
      ["2026-09-03", "real"],
      ["2026-09-04", "real"],
    ]),
  )!;

  assert.equal(split.firstRealDate, "2026-09-03");
  assert.deepEqual(
    split.rows.map((row) => row.mock),
    [10, 11, null, null],
  );
  // El día anterior al corte también lleva valor real para que la línea
  // no se rompa visualmente.
  assert.deepEqual(
    split.rows.map((row) => row.real),
    [null, 11, 12, 13],
  );
});
