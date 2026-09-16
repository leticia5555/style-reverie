import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { listApprovedHosts } from "@/lib/curated-images";
import { isKnownHost, parseImageUrl } from "@/lib/image-validate";

export const dynamic = "force-dynamic";

/**
 * Sirve una imagen curada desde su origen.
 *
 * Existe por una razón concreta: `IMAGE_HOSTS` alimenta `remotePatterns` de
 * next.config, que es configuración de tiempo de compilación. Un host aprobado
 * desde el panel no serviría de nada hasta el siguiente deploy — next/image lo
 * rechazaría en runtime. Pasando por aquí, next/image solo ve una ruta de este
 * mismo origen, que siempre está permitida, y curar una foto deja de depender
 * de volver a desplegar.
 *
 * Un proxy que pida cualquier URL es un proxy abierto: cualquiera podría usar
 * este dominio para pedir lo que quisiera y con nuestra IP. Por eso solo pasa
 * lo que está en la lista de hosts —los compilados y los aprobados a mano— y
 * las direcciones internas se descartan antes, en `parseImageUrl`.
 */

const TIMEOUT_MS = 10_000;
/** Un día en el navegador: la URL identifica el archivo, no cambia debajo. */
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src");
  if (!src) {
    return NextResponse.json({ error: "falta src" }, { status: 400 });
  }

  const parsed = parseImageUrl(src);
  if ("reason" in parsed) {
    return NextResponse.json({ error: parsed.reason }, { status: 400 });
  }
  const { url } = parsed;

  const db = getDb();
  const approved = db ? await listApprovedHosts(db).catch(() => []) : [];
  const host = url.hostname.toLowerCase();
  if (!isKnownHost(host) && !approved.includes(host)) {
    return NextResponse.json({ error: "host no permitido" }, { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "StyleReverie/0.1 (+image proxy)",
        accept: "image/*",
      },
      cache: "no-store",
    });

    const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
    if (!upstream.ok || !contentType.startsWith("image/")) {
      return NextResponse.json({ error: "el origen no dio una imagen" }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": CACHE_CONTROL,
      },
    });
  } catch {
    return NextResponse.json({ error: "el origen no respondió" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
