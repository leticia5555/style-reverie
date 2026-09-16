import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getDb } from "@/lib/db/client";
import { discardCandidate, promoteCandidate } from "@/lib/promote";
import { resetCatalogCache } from "@/lib/trends";

export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Promover una candidata al catálogo, o descartarla.
 *
 * Las dos son decisiones humanas y van detrás de la sesión de admin. No usan
 * CRON_SECRET a propósito: ese secreto viaja en URLs para poder operar desde
 * el celular, y una acción que escribe en el catálogo no puede depender de un
 * secreto que queda en el historial del navegador.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "falta DATABASE_URL" }, { status: 503 });
  }

  let body: { slug?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const { slug, action } = body;
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "falta slug" }, { status: 400 });
  }
  if (action !== "promote" && action !== "discard") {
    return NextResponse.json({ error: "acción desconocida" }, { status: 400 });
  }

  try {
    if (action === "discard") {
      const result = await discardCandidate(db, slug);
      return NextResponse.json(result, {
        status: result.status === "ok" ? 200 : 404,
        headers: { "cache-control": "no-store" },
      });
    }

    const result = await promoteCandidate(db, slug, today());
    if (result.status === "not-found") {
      return NextResponse.json(result, { status: 404 });
    }
    // El catálogo en memoria acaba de quedarse corto: tiene una tendencia más.
    resetCatalogCache();
    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
