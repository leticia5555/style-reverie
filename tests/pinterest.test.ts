import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getPinterestSignals,
  isFresh,
  matchKeywords,
  resetPinterestCache,
} from "@/lib/pinterest";
import { getTrends } from "@/lib/trends";

const trends = getTrends();

/** Líneas de import reales, sin comentarios: la prosa sí puede nombrarlos. */
function importsOf(file: string): string[] {
  return readFileSync(resolve(process.cwd(), file), "utf8")
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line) || /\bfrom\s+"/.test(line));
}

test("REGLA DURA: el módulo no importa nada que pueda persistir", () => {
  const imports = importsOf("lib/pinterest.ts").join("\n");
  for (const prohibido of ["lib/db", "node:fs", "node:path", "@neondatabase"]) {
    assert.ok(
      !imports.includes(prohibido),
      `lib/pinterest.ts no puede importar ${prohibido}`,
    );
  }
});

test("REGLA DURA: el módulo no contiene escrituras", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/pinterest.ts"), "utf8")
    // Fuera los comentarios: explican la regla nombrando lo prohibido.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const prohibido of ["insert into", "writeFile", "localStorage"]) {
    assert.ok(
      !source.toLowerCase().includes(prohibido.toLowerCase()),
      `lib/pinterest.ts no puede contener ${prohibido}`,
    );
  }
});

test("el cron no toca Pinterest", () => {
  const cron = readFileSync(resolve(process.cwd(), "lib/cron.ts"), "utf8");
  const route = readFileSync(
    resolve(process.cwd(), "app/api/cron/daily/route.ts"),
    "utf8",
  );
  assert.ok(!cron.toLowerCase().includes("pinterest"));
  assert.ok(!route.toLowerCase().includes("pinterest"));
});

test("cruza el ranking contra los keywords del catálogo", () => {
  const signals = matchKeywords(
    [
      { keyword: "falda cargo" },
      { keyword: "recetas de otoño" },
      { keyword: "pantalon barril" },
    ],
    trends,
    "2026-09-16T10:00:00.000Z",
  );
  assert.ok(signals.has("falda-cargo"));
  assert.ok(signals.has("pantalon-barril"));
});

test("el primero del ranking vale 100 y el puesto se conserva", () => {
  const signals = matchKeywords(
    [{ keyword: "falda cargo" }, { keyword: "pantalon barril" }],
    trends,
    "2026-09-16T10:00:00.000Z",
  );
  assert.equal(signals.get("falda-cargo")!.value, 100);
  assert.equal(signals.get("falda-cargo")!.rank, 1);
  assert.equal(signals.get("pantalon-barril")!.rank, 2);
});

test("una tendencia que no sale en el ranking no tiene señal", () => {
  const signals = matchKeywords(
    [{ keyword: "falda cargo" }],
    trends,
    "2026-09-16T10:00:00.000Z",
  );
  assert.equal(signals.has("verde-matcha"), false);
});

test("la caché vive una hora exacta", () => {
  const now = Date.now();
  const entry = { at: now, result: { status: "ok" as const, signals: new Map() } };
  assert.equal(isFresh(entry, now + 59 * 60_000), true);
  assert.equal(isFresh(entry, now + 61 * 60_000), false);
  assert.equal(isFresh(null, now), false);
});

test("sin token devuelve no disponible, sin lanzar", async () => {
  resetPinterestCache();
  delete process.env.PINTEREST_TOKEN;
  const result = await getPinterestSignals(trends);
  assert.equal(result.status, "unavailable");
  assert.match(result.reason, /PINTEREST_TOKEN/);
});

test("sin red no llega a llamar: la respuesta se sirve de la caché", async () => {
  resetPinterestCache();
  delete process.env.PINTEREST_TOKEN;
  const primera = await getPinterestSignals(trends);
  const segunda = await getPinterestSignals(trends);
  assert.equal(primera, segunda, "la segunda llamada devuelve el mismo objeto");
});
