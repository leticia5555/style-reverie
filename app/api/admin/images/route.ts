import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import {
  approveHost,
  removeCuratedImage,
  saveCuratedImage,
} from "@/lib/curated-images";
import { getDb } from "@/lib/db/client";
import { checkImageUrl, parseImageUrl } from "@/lib/image-validate";

export const dynamic = "force-dynamic";
/** Comprobar una URL sale a la red; el límite por defecto se queda corto. */
export const maxDuration = 30;

/**
 * Guarda o quita la foto curada de una tendencia.
 *
 * Antes de guardar se comprueba que la URL cargue de verdad: no basta con que
 * esté bien escrita, porque un 404 o una página HTML con extensión .jpg solo
 * se ven pidiéndola, y descubrirlo mañana en la página es descubrirlo tarde.
 *
 * Si el host no está en IMAGE_HOSTS se aprueba aquí y se guarda en la base.
 * Las curadas se sirven por /api/image, así que un host aprobado hoy funciona
 * hoy, sin esperar a un deploy.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "falta DATABASE_URL" }, { status: 503 });
  }

  let body: {
    trendId?: unknown;
    imageUrl?: unknown;
    credit?: unknown;
    creditUrl?: unknown;
    action?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const trendId = typeof body.trendId === "string" ? body.trendId.trim() : "";
  if (!trendId) {
    return NextResponse.json({ error: "falta la tendencia" }, { status: 400 });
  }

  if (body.action === "remove") {
    await removeCuratedImage(db, trendId);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const credit = typeof body.credit === "string" ? body.credit.trim() : "";
  const creditUrl = typeof body.creditUrl === "string" ? body.creditUrl.trim() : "";

  /**
   * Los tres campos son obligatorios. Una foto prestada sin decir de quién es
   * y sin enlace al original no se enseña, y aceptar aquí una sin crédito
   * abriría justo ese camino.
   */
  if (!imageUrl || !credit || !creditUrl) {
    return NextResponse.json(
      { error: "hacen falta imagen, crédito y enlace al original" },
      { status: 400 },
    );
  }

  const creditLink = parseImageUrl(creditUrl);
  if ("reason" in creditLink) {
    return NextResponse.json(
      { error: `el enlace al original ${creditLink.reason}` },
      { status: 400 },
    );
  }

  const check = await checkImageUrl(imageUrl);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 422 });
  }

  // El host nuevo se aprueba aquí: es lo que hace que el proxy la pueda servir.
  if (!check.knownHost) await approveHost(db, check.host);

  await saveCuratedImage(db, { trendId, imageUrl, credit, creditUrl });

  return NextResponse.json(
    {
      status: "ok",
      host: check.host,
      hostApproved: !check.knownHost,
      contentType: check.contentType,
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
