import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sesión de admin: una contraseña en ADMIN_PASSWORD.
 *
 * Es deliberadamente pequeña — un solo usuario, el dueño del producto— pero no
 * ingenua. La cookie no lleva la contraseña sino un HMAC derivado de ella, así
 * que leerla no la revela; va httpOnly para que ningún script de la página
 * pueda tocarla, y sameSite=strict para que un POST desde otro sitio no la
 * mande, que es toda la defensa de CSRF que hace falta aquí.
 *
 * Cambiar ADMIN_PASSWORD invalida las sesiones abiertas, que es lo que uno
 * espera de cambiar una contraseña.
 */
export const ADMIN_COOKIE = "sr_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** El valor que lleva la cookie: deriva de la contraseña, no la contiene. */
export function sessionToken(password: string): string {
  return createHmac("sha256", password).update("style-reverie/admin").digest("hex");
}

export type AdminCheck =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** Comprueba la contraseña que llega del formulario de entrada. */
export function checkPassword(password: unknown): AdminCheck {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { ok: false, status: 503, error: "ADMIN_PASSWORD no está configurado" };
  }
  if (typeof password !== "string" || !equals(password, expected)) {
    return { ok: false, status: 401, error: "contraseña incorrecta" };
  }
  return { ok: true };
}

export function cookieOptions(): {
  httpOnly: true;
  sameSite: "strict";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "strict",
    // En local no hay TLS y el navegador descartaría una cookie secure.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

/** ¿Este valor de cookie corresponde a la contraseña de ahora? */
export function tokenIsValid(value: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !value) return false;
  return equals(value, sessionToken(expected));
}

/** Lee la cookie de la cabecera. No usa next/headers: así se puede probar. */
export function cookieFromRequest(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_COOKIE) return rest.join("=");
  }
  return undefined;
}

/**
 * ¿La petición trae sesión de admin? Para los route handlers, que sí reciben
 * la Request; los componentes de servidor usan `lib/admin-session.ts`.
 */
export function isAdminRequest(request: Request): boolean {
  return tokenIsValid(cookieFromRequest(request));
}
