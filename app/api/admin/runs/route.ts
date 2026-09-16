import { NextResponse } from "next/server";
import { authorizeOps } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { recentRuns } from "@/lib/db/runs";

export const dynamic = "force-dynamic";

/** Lo que pide el producto; se puede subir por query hasta este tope. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Las columnas de tiempo vuelven como Date en unos drivers y como string en
 * otros. Se normalizan para que la respuesta sea la misma en Neon y en PGlite.
 */
const iso = (value: string | Date | null): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
};

function parseLimit(url: string): number {
  const raw = new URL(url).searchParams.get("limit");
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsed)));
}

/**
 * Bitácora de las últimas corridas, para diagnosticar desde el celular.
 *
 * Es solo lectura y no toca nada: devuelve las filas de `signal_runs` tal cual,
 * con su `detail` — que es donde el paso de descubrimiento deja su desglose y
 * cada conector su motivo de fallo o de salto.
 *
 * Se autoriza con CRON_SECRET igual que el cron y el setup, por cabecera o por
 * ?secret= en la URL. El parámetro queda en el historial y en los logs:
 * conviene rotar el secreto después de usarlo así.
 */
export async function GET(request: Request) {
  const auth = authorizeOps(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "falta DATABASE_URL" }, { status: 503 });
  }

  try {
    const rows = await recentRuns(db, parseLimit(request.url));
    const runs = rows.map((row) => {
      const startedAt = iso(row.started_at);
      const finishedAt = iso(row.finished_at);
      return {
        id: Number(row.id),
        source: row.source,
        status: row.status,
        startedAt,
        finishedAt,
        /**
         * Una corrida sin finishedAt se quedó a medias —se cayó la función o
         * se agotó el tiempo—, que es distinto de una que terminó en error.
         */
        durationMs:
          startedAt && finishedAt
            ? Date.parse(finishedAt) - Date.parse(startedAt)
            : null,
        rowsWritten: Number(row.rows_written),
        detail: row.detail,
      };
    });

    return NextResponse.json(
      { status: "ok", count: runs.length, runs },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
