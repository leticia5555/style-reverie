import { NextResponse } from "next/server";
import { getPinterestSignals } from "@/lib/pinterest";
import { getCatalog } from "@/lib/trends";

export const dynamic = "force-dynamic";

/**
 * Señal de Pinterest de hoy para una tendencia.
 *
 * Existe como endpoint aparte para que el render de la ficha no dependa de
 * que Pinterest responda: la página se pinta y el cliente pide esto después.
 * La respuesta no se guarda en ningún sitio; el único caché es el de memoria
 * dentro de lib/pinterest.ts, con una hora de vida.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { trends } = await getCatalog();
  const result = await getPinterestSignals(trends);

  if (result.status !== "ok") {
    return NextResponse.json(
      { status: "unavailable", reason: result.reason },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }

  const signal = result.signals.get(id) ?? null;
  return NextResponse.json(
    { status: "ok", signal },
    {
      status: 200,
      // Una hora, igual que el caché en memoria. Nunca más.
      headers: { "cache-control": "private, max-age=3600" },
    },
  );
}
