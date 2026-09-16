import { NextResponse } from "next/server";
import { authorizeOps } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { ensureDatabase } from "@/lib/db/setup";
import { getTrends, resetCatalogCache } from "@/lib/trends";

export const dynamic = "force-dynamic";
/** Sembrar 13.500 señales tarda más que el límite por defecto. */
export const maxDuration = 300;

/**
 * Deja la base lista sin necesidad de una terminal.
 *
 * Aplica el esquema —idempotente— y carga el catálogo de muestra solo si la
 * tabla trends está vacía. Se puede abrir tantas veces como haga falta: la
 * segunda no hace nada y lo dice.
 *
 * Se autoriza con CRON_SECRET, por cabecera o por ?secret= para poder
 * dispararlo desde un navegador.
 */
export async function GET(request: Request) {
  const auth = authorizeOps(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "falta DATABASE_URL" },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  try {
    const report = await ensureDatabase(db, getTrends());
    // El catálogo cacheado en memoria quedó obsoleto tras sembrar.
    resetCatalogCache();

    return NextResponse.json(
      { status: "ok", ...report, durationMs: Date.now() - startedAt },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
