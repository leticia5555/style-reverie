import { NextResponse } from "next/server";
import { authorizeOps } from "@/lib/auth";
import { runDaily } from "@/lib/cron";
import { googleTrendsConnector } from "@/lib/sources/google-trends";
import { mercadoLibreConnector } from "@/lib/sources/mercadolibre";

export const dynamic = "force-dynamic";
/** Traer varias fuentes externas no cabe en el límite por defecto. */
export const maxDuration = 300;

/**
 * Cron diario. Vercel lo llama con `Authorization: Bearer $CRON_SECRET`.
 *
 * Devuelve 200 aunque alguna fuente falle: el detalle va en el cuerpo y en
 * signal_runs. Un 500 haría que Vercel reintentara la corrida entera,
 * incluidas las fuentes que ya escribieron bien.
 */
export async function GET(request: Request) {
  const auth = authorizeOps(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const outcome = await runDaily([
    mercadoLibreConnector,
    googleTrendsConnector,
  ]);

  return NextResponse.json(outcome, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
