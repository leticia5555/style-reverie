/**
 * Extracción de la imagen de un item de RSS y control de qué hosts puede
 * cargar next/image.
 */

/**
 * Hosts de imagen de las fuentes. Tiene que ir en sincronía con
 * `images.remotePatterns` de next.config.ts: next/image lanza un error en
 * runtime si recibe un host que no está configurado, y eso tumbaría la página
 * entera por una sola foto. Por eso la lista se comprueba también aquí y una
 * imagen de un host desconocido cae al placeholder en vez de romper nada.
 *
 * Los de las fuentes nuevas se anotaron sin poder comprobarlos desde el
 * contenedor, que no tiene salida a internet. Si alguno está mal, la tarjeta
 * pinta el placeholder de la fuente: la lista es una red de seguridad, no un
 * requisito para que la página funcione. `npm run editorial` y mirar el feed
 * es lo que los confirma.
 */
export const IMAGE_HOSTS = [
  // Condé Nast — Vogue
  "assets.vogue.com",
  "media.vogue.com",
  "media.condenast.com",
  "www.vogue.com",
  // Condé Nast México — Vogue MX y Glamour MX
  "www.vogue.mx",
  "assets.vogue.mx",
  "www.glamour.mx",
  "assets.glamour.mx",
  // Elle México
  "elle.mx",
  "www.elle.mx",
  // Hearst — Harper's Bazaar
  "hips.hearstapps.com",
  "www.harpersbazaar.com",
  // Fashionista
  "fashionista.com",
  "www.fashionista.com",
  "assets.fashionista.com",
  // Penske Media — WWD
  "wwd.com",
  "www.wwd.com",
  "pmc-wwd.s3.amazonaws.com",
  // Future plc — Who What Wear
  "www.whowhatwear.com",
  "whowhatwear.com",
  "cdn.mos.cms.futurecdn.net",
  "media.whowhatwear.com",
] as const;

/**
 * Hosts extra para desarrollo, separados por coma (SR_IMAGE_HOSTS). Sirven
 * para probar la tarjeta contra un servidor local sin tocar la lista real;
 * a estos sí se les permite http, porque en local no hay TLS.
 */
function extraHosts(): string[] {
  return (process.env.SR_IMAGE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

export function isAllowedImageHost(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    if (extraHosts().includes(hostname)) return true;
    if (protocol !== "https:") return false;
    return IMAGE_HOSTS.some((host) => hostname === host);
  } catch {
    return false;
  }
}

/** Atributo de una etiqueta suelta, tolerante a comillas simples o dobles. */
function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[2] ?? match[3] ?? null) : null;
}

function firstImgSrc(html: string | undefined): string | null {
  if (!html) return null;
  const tag = html.match(/<img\b[^>]*>/i);
  if (!tag) return null;
  const src = attr(tag[0], "src");
  return src?.trim() || null;
}

/** Los feeds traen la URL con entidades escapadas más veces de la cuenta. */
function unescapeUrl(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

type MediaNode = { $?: Record<string, string>; url?: string };

function mediaUrl(node: unknown): string | null {
  if (!node) return null;
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    // media:content puede venir repetido en varios tamaños; se toma el mayor.
    const candidates = node
      .map((entry) => ({
        url: mediaUrl(entry),
        width: Number((entry as MediaNode)?.$?.width ?? 0),
      }))
      .filter((entry): entry is { url: string; width: number } => Boolean(entry.url))
      .sort((a, b) => b.width - a.width);
    return candidates[0]?.url ?? null;
  }
  const record = node as MediaNode;
  return record.$?.url ?? record.url ?? null;
}

export type RssItemImageFields = {
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  contentEncoded?: string;
  content?: string;
  enclosure?: { url?: string; type?: string };
};

/**
 * Orden de preferencia pedido por el producto: media:content, media:thumbnail,
 * enclosure de tipo imagen y, por último, la primera <img> del contenido.
 */
export function imageFromItem(item: RssItemImageFields): string | null {
  const enclosure =
    item.enclosure?.url && (item.enclosure.type ?? "").startsWith("image")
      ? item.enclosure.url
      : null;

  const candidate =
    mediaUrl(item.mediaContent) ??
    mediaUrl(item.mediaThumbnail) ??
    enclosure ??
    firstImgSrc(item.contentEncoded) ??
    firstImgSrc(item.content);

  if (!candidate) return null;
  const url = unescapeUrl(candidate);
  return url.startsWith("http") ? url : null;
}

/** og:image de una página, sin meter un parser de HTML entero. */
export function ogImageFrom(html: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const property = attr(tag, "property") ?? attr(tag, "name");
    if (property?.toLowerCase() !== "og:image") continue;
    const content = attr(tag, "content");
    if (content) {
      const url = unescapeUrl(content);
      if (url.startsWith("http")) return url;
    }
  }
  return null;
}
