import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, cookieOptions, sessionToken } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Entrar: cambia la contraseña por una cookie de sesión. */
export async function POST(request: Request) {
  let password: unknown;
  try {
    password = ((await request.json()) as { password?: unknown }).password;
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const check = checkPassword(password);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const response = NextResponse.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(
    ADMIN_COOKIE,
    sessionToken(process.env.ADMIN_PASSWORD as string),
    cookieOptions(),
  );
  return response;
}

/** Salir. Sin cuerpo y sin comprobar nada: cerrar sesión siempre se puede. */
export async function DELETE() {
  const response = NextResponse.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
