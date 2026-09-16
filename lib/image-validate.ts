import { IMAGE_HOSTS } from "@/lib/editorial-image";

/**
 * Comprobación de una URL de imagen antes de aceptarla en el catálogo.
 *
 * Esto SÍ sale a la red durante un request, y es la única excepción a la regla
 * de que ninguna fuente externa se llama en el camino del usuario: no está en
 * el camino del usuario. Es una acción de operación, detrás de la sesión de
 * admin, en la que la persona acaba de pegar una URL y espera que le digamos
 * si sirve. Comprobarlo después, en el cron, sería enseñarle un hueco mañana.
 */

const TIMEOUT_MS = 8_000;
export type UrlCheck =
  | { ok: true; host: string; contentType: string; knownHost: boolean }
  | { ok: false; reason: string };

/**
 * Hosts que no se piden nunca. El servidor haría la petición desde dentro de
 * la red del proveedor, así que una URL apuntando a una dirección interna
 * convertiría esta ruta en una forma de mirar lo que hay ahí dentro.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal") return true;

  // IPv4 privada o de loopback.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 loopback y enlace local.
  if (host === "::1" || host.startsWith("[::1") || host.startsWith("fe80")) {
    return true;
  }
  return false;
}

export function parseImageUrl(raw: string): { url: URL } | { reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { reason: "no parece una URL" };
  }
  if (url.protocol !== "https:") {
    return { reason: "tiene que ser https" };
  }
  if (isPrivateHost(url.hostname)) {
    return { reason: "esa dirección es interna y no se pide nunca" };
  }
  return { url };
}

/** ¿El host ya está en la lista compilada? Los de la base van aparte. */
export function isKnownHost(hostname: string): boolean {
  return IMAGE_HOSTS.some((host) => host === hostname.toLowerCase());
}

/**
 * Pide la imagen de verdad. No basta con que la URL esté bien escrita: lo que
 * se quiere saber es si carga, y un 404 o una página HTML disfrazada de .jpg
 * solo se ven pidiéndola.
 */
/**
 * Juzga la respuesta del origen. Está separada de la petición a propósito: es
 * donde vive la decisión —¿carga?, ¿es una imagen?, ¿se puede optimizar?— y
 * así se puede probar entera sin salir a la red.
 */
export async function evaluateImageResponse(
  response: Response,
  hostname: string,
): Promise<UrlCheck> {
  if (!response.ok) {
    return { ok: false, reason: `el servidor respondió ${response.status}` };
  }

  const contentType = (response.headers.get("content-type") ?? "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (!contentType.startsWith("image/")) {
    return {
      ok: false,
      reason: `eso no es una imagen, es ${contentType || "algo sin tipo"}`,
    };
  }
  // next/image no procesa SVG, así que aceptarlo sería prometer de más.
  if (contentType.includes("svg")) {
    return { ok: false, reason: "los SVG no se pueden optimizar" };
  }

  // Se leen unos bytes para confirmar que el cuerpo existe de verdad: un 200
  // con content-type de imagen y cuerpo vacío se vería como un hueco.
  const reader = response.body?.getReader();
  if (reader) {
    const { value } = await reader.read();
    await reader.cancel();
    if (!value?.length) return { ok: false, reason: "la respuesta venía vacía" };
  }

  return {
    ok: true,
    host: hostname.toLowerCase(),
    contentType,
    knownHost: isKnownHost(hostname),
  };
}

/**
 * Pide la imagen de verdad. No basta con que la URL esté bien escrita: lo que
 * se quiere saber es si carga, y un 404 o una página HTML disfrazada de .jpg
 * solo se ven pidiéndola.
 */
export async function checkImageUrl(raw: string): Promise<UrlCheck> {
  const parsed = parseImageUrl(raw);
  if ("reason" in parsed) return { ok: false, reason: parsed.reason };
  const { url } = parsed;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "StyleReverie/0.1 (+image curation)",
        accept: "image/*",
      },
      cache: "no-store",
    });
    return await evaluateImageResponse(response, url.hostname);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: detail.includes("aborted") ? "tardó demasiado" : detail,
    };
  } finally {
    clearTimeout(timer);
  }
}
