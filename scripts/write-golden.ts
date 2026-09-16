/**
 * Regenera tests/fixtures/golden-scores.json.
 *
 *   npm run golden
 *
 * Solo se corre cuando los pesos o los umbrales cambian A PROPÓSITO. Si el
 * test de oro falla por otra razón, regenerarlo esconde el problema en vez de
 * arreglarlo.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTrendSummaries } from "@/lib/trends";

const golden = getTrendSummaries().map((row) => ({
  id: row.id,
  score: row.score,
  lifecycle: row.lifecycle,
  momentum7d: row.momentum7d,
  yoyPct: row.yoyPct,
  sourceCount: row.sourceCount,
}));

const out = resolve(process.cwd(), "tests/fixtures/golden-scores.json");
writeFileSync(out, `${JSON.stringify(golden, null, 2)}\n`, "utf8");
console.log(`${golden.length} tendencias congeladas en ${out}`);
