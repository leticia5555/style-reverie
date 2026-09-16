import type { ShopLink, ShopTier } from "@/lib/types";

/**
 * Feed de productos de Awin (marketing de afiliados).
 *
 * **Solo imágenes que provee el retailer.** Esta es la única vía por la que
 * una foto de producto entra en la app: el retailer la publica en su feed de
 * afiliados justamente para que se use al enlazar a su ficha. Una foto de
 * producto sacada de cualquier otro sitio no se enseña — y si el feed no trae
 * imagen, no se enseña nada. Una tira de huecos grises no es una tira.
 *
 * Hoy devuelve datos mock: la cuenta de Awin está aprobada pero el conector
 * real necesita credenciales y salir a la red, y ninguna de las dos cosas
 * existe todavía aquí. La forma del dato sí es la definitiva, así que cambiar
 * `fetchAwinProducts` por la llamada de verdad no toca nada de lo que hay
 * encima.
 */

export type AwinProduct = {
  /** Identificador del producto en el feed del anunciante. */
  id: string;
  retailer: string;
  title: string;
  /** URL de la imagen QUE PROVEE EL RETAILER. Sin ella no hay tarjeta. */
  imageUrl: string;
  /** Enlace de afiliado a la ficha del producto. */
  url: string;
  price: number;
  currency: "MXN" | "USD";
  tier: ShopTier;
};

/** Hosts de imagen de producto que se aceptan, por anunciante aprobado. */
export const AWIN_IMAGE_HOSTS = [
  "images.asos-media.com",
  "static.zara.net",
  "img.ltwebstatic.com",
  "www.liverpool.com.mx",
  "media.revolve.com",
  "n.nordstrommedia.com",
  "m.media-amazon.com",
] as const;

export function isAwinImageHost(url: string): boolean {
  try {
    const { hostname, host, protocol } = new URL(url);
    // Servidor de fixtures en local: sin TLS, y solo si se pide a propósito.
    // Se comparan las dos formas porque el fixture suele llevar puerto y
    // `hostname` lo deja fuera.
    const fixture = process.env.SR_AWIN_HOST;
    if (fixture && (host === fixture || hostname === fixture)) return true;
    if (protocol !== "https:") return false;
    return AWIN_IMAGE_HOSTS.some((host) => hostname === host);
  } catch {
    return false;
  }
}

/**
 * Descarta lo que no se puede enseñar: sin imagen del retailer, o con una
 * imagen de un host que no es de un anunciante aprobado, no hay producto.
 */
export function usableProducts(products: AwinProduct[]): AwinProduct[] {
  return products.filter(
    (product) => product.imageUrl && isAwinImageHost(product.imageUrl),
  );
}

/** Agrupa por nivel de precio, conservando el orden del feed. */
export function byTier(products: AwinProduct[]): Record<ShopTier, AwinProduct[]> {
  const grouped: Record<ShopTier, AwinProduct[]> = {
    budget: [],
    mid: [],
    invest: [],
  };
  for (const product of usableProducts(products)) {
    grouped[product.tier].push(product);
  }
  return grouped;
}

/**
 * Mock con la forma del feed real.
 *
 * Deliberadamente imperfecto: trae productos sin imagen y con imagen de un
 * host que no es de anunciante, porque el feed real los trae y el código de
 * arriba tiene que seguir descartándolos. Un mock donde todo está bien no
 * prueba la única regla que importa aquí.
 *
 * Sus URLs apuntan a los hosts reales de los anunciantes y **no existen**: son
 * la forma del dato, no dato. Por eso este mock no se sirve en producción —ver
 * `fetchAwinProducts`— y para verlo en local se apunta a un servidor de
 * fixtures con SR_AWIN_HOST, igual que SR_FEED_* con los feeds.
 */
export function mockAwinProducts(trendId: string, links: ShopLink[]): AwinProduct[] {
  const HOSTS: Record<string, string> = {
    ASOS: "images.asos-media.com",
    "Zara México": "static.zara.net",
    Shein: "img.ltwebstatic.com",
    Liverpool: "www.liverpool.com.mx",
    Revolve: "media.revolve.com",
    Nordstrom: "n.nordstrommedia.com",
    "Amazon México": "m.media-amazon.com",
  };

  const fixtureHost = process.env.SR_AWIN_HOST;

  return links.map((link, index) => {
    const host = fixtureHost ?? HOSTS[link.retailer];
    return {
      id: `${trendId}-${index}`,
      retailer: link.retailer,
      title: link.label.es,
      // Sin host conocido se deja vacío: así el filtro tiene qué descartar.
      imageUrl: host
        ? fixtureHost
          ? `http://${host}/?l=${encodeURIComponent(link.retailer)}&i=${index}&w=600&h=800`
          : `https://${host}/${trendId}-${index}.jpg`
        : "",
      url: link.url,
      price: link.price,
      currency: link.currency,
      tier: (["budget", "mid", "invest"] as const)[index % 3],
    };
  });
}

/**
 * Lo que sustituirá la llamada real. La firma ya es la definitiva: recibe la
 * tendencia y sus enlaces de compra y devuelve productos con imagen.
 */
export async function fetchAwinProducts(
  trendId: string,
  links: ShopLink[],
): Promise<AwinProduct[]> {
  /**
   * Sin credenciales no hay productos, y eso significa que la tira no se
   * pinta. Servir aquí el mock llenaría la ficha de recuadros rotos: sus URLs
   * apuntan a hosts reales de anunciantes y no existen, así que el navegador
   * las pediría y fallaría. Una tira de imágenes rotas es peor que ninguna
   * tira, que es exactamente la regla de esta sección.
   *
   * Para verla en local se levanta un servidor de fixtures y se apunta
   * SR_AWIN_HOST a él.
   */
  if (!process.env.AWIN_API_KEY) {
    if (process.env.SR_AWIN_HOST) {
      return usableProducts(mockAwinProducts(trendId, links));
    }
    return [];
  }
  // TODO: feed real de Awin. Hasta entonces el mock tiene la misma forma.
  return usableProducts(mockAwinProducts(trendId, links));
}
