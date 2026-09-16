import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenIsValid } from "@/lib/admin";

/**
 * La sesión de admin vista desde un componente de servidor, que no recibe la
 * Request. Vive aparte de `lib/admin.ts` porque importa `next/headers`, y eso
 * ata el módulo a un contexto de petición: los route handlers y los tests usan
 * `isAdminRequest`, que solo mira una cabecera.
 */
export async function isAdminSession(): Promise<boolean> {
  return tokenIsValid((await cookies()).get(ADMIN_COOKIE)?.value);
}
