import { timingSafeEqual } from "node:crypto";

/** Comparación en tiempo constante; longitudes distintas no filtran nada. */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type AuthOutcome =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/**
 * Autoriza una ruta de operaciones contra CRON_SECRET.
 *
 * Acepta la cabecera `Authorization: Bearer <secreto>`, que es como la manda
 * Vercel en los crons, y también `?secret=` en la URL para poder abrirla desde
 * un navegador sin herramientas.
 *
 * El parámetro en la URL tiene un coste real: queda en el historial del
 * navegador, en los logs de acceso y en la cabecera Referer si la página
 * enlazara a otro sitio. Se admite porque la alternativa es no poder operar
 * sin terminal, pero conviene rotar el secreto después de usarlo así.
 */
export function authorizeOps(request: Request): AuthOutcome {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET no está configurado" };
  }

  const header = request.headers.get("authorization");
  if (header && equals(header, `Bearer ${secret}`)) return { ok: true };

  const query = new URL(request.url).searchParams.get("secret");
  if (query && equals(query, secret)) return { ok: true };

  return { ok: false, status: 401, error: "no autorizado" };
}
