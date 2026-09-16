import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { ADMIN_COOKIE, checkPassword, cookieOptions, sessionToken } from "@/lib/admin";
import { POST as login, DELETE as logout } from "@/app/api/admin/login/route";
import { saveCandidates } from "@/lib/sources/discovery";

const PASSWORD = "contraseña-de-prueba-larga-y-tonta";

let pg: PGlite;
let db: Db;

before(async () => {
  process.env.ADMIN_PASSWORD = PASSWORD;
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  setDb(db);
  await migrate(db);
});

after(async () => {
  setDb(null);
  delete process.env.ADMIN_PASSWORD;
  await pg.close();
});

beforeEach(async () => {
  await pg.query("delete from trends");
  await pg.query("delete from trend_candidates");
});

const jsonPost = (body: unknown) =>
  new Request("https://x.test/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/* ── la contraseña ─────────────────────────────────────────────────── */

test("sin ADMIN_PASSWORD configurado no se entra, y lo dice distinto", () => {
  delete process.env.ADMIN_PASSWORD;
  const check = checkPassword(PASSWORD);
  assert.equal(check.ok, false);
  assert.equal(check.status, 503, "no configurado no es lo mismo que incorrecta");
  process.env.ADMIN_PASSWORD = PASSWORD;
});

test("una contraseña equivocada no entra", () => {
  assert.equal(checkPassword("otra").ok, false);
  assert.equal(checkPassword("").ok, false);
  assert.equal(checkPassword(undefined).ok, false);
  assert.equal(checkPassword(12345).ok, false);
});

test("la correcta entra", () => {
  assert.equal(checkPassword(PASSWORD).ok, true);
});

/* ── la cookie ─────────────────────────────────────────────────────── */

test("la cookie NO lleva la contraseña dentro", () => {
  const token = sessionToken(PASSWORD);
  assert.ok(!token.includes(PASSWORD));
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("cambiar la contraseña invalida las sesiones abiertas", () => {
  assert.notEqual(sessionToken(PASSWORD), sessionToken(`${PASSWORD}!`));
});

test("la cookie va httpOnly y sameSite strict", () => {
  const options = cookieOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(
    options.sameSite,
    "strict",
    "un POST desde otro sitio no puede llevarse la sesión",
  );
});

/* ── entrar y salir ────────────────────────────────────────────────── */

test("entrar con la contraseña correcta devuelve la cookie", async () => {
  const response = await login(jsonPost({ password: PASSWORD }));
  assert.equal(response.status, 200);

  const cookie = response.cookies.get(ADMIN_COOKIE);
  assert.ok(cookie, "vuelve con cookie");
  assert.equal(cookie.value, sessionToken(PASSWORD));
  assert.equal(cookie.httpOnly, true);
});

test("entrar con la equivocada no deja cookie", async () => {
  const response = await login(jsonPost({ password: "no" }));
  assert.equal(response.status, 401);
  assert.equal(response.cookies.get(ADMIN_COOKIE)?.value || "", "");
});

test("un cuerpo que no es JSON da 400, no un 500", async () => {
  const response = await login(
    new Request("https://x.test/api/admin/login", { method: "POST", body: "{{{" }),
  );
  assert.equal(response.status, 400);
});

test("salir borra la cookie", async () => {
  const response = await logout();
  assert.equal(response.status, 200);
  const cookie = response.cookies.get(ADMIN_COOKIE);
  assert.equal(cookie?.value, "");
  assert.equal(cookie?.maxAge, 0);
});

/* ── las acciones exigen sesión ────────────────────────────────────── */

test("promover sin sesión no toca nada", async () => {
  const { POST } = await import("@/app/api/admin/candidates/route");
  await saveCandidates(
    db,
    [{ slug: "zueco", nameEs: "zueco de madera", category: "prenda",
       evidence: [{ title: "t", source: "Vogue", link: "https://x.test/1" }] }],
    "2026-09-16",
  );

  const response = await POST(
    new Request("https://x.test/api/admin/candidates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "zueco", action: "promote" }),
    }),
  );

  assert.equal(response.status, 401);
  const rows = await db.query<{ n: string }>("select count(*)::text as n from trends");
  assert.equal(rows[0].n, "0", "no se creó ninguna tendencia");
});

test("con la cookie de la sesión, promover sí funciona", async () => {
  const { POST } = await import("@/app/api/admin/candidates/route");
  await saveCandidates(
    db,
    [{ slug: "zueco", nameEs: "zueco de madera", category: "prenda",
       evidence: [{ title: "t", source: "Vogue", link: "https://x.test/1" }] }],
    "2026-09-16",
  );

  // La cookie sale de entrar de verdad, no se escribe a mano en el test.
  const entrada = await login(jsonPost({ password: PASSWORD }));
  const cookie = entrada.cookies.get(ADMIN_COOKIE)!;

  const response = await POST(
    new Request("https://x.test/api/admin/candidates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${cookie.name}=${cookie.value}`,
      },
      body: JSON.stringify({ slug: "zueco", action: "promote" }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", trendId: "zueco" });
  const rows = await db.query<{ id: string }>("select id from trends");
  assert.deepEqual(rows.map((r) => r.id), ["zueco"]);
});

test("una cookie con un valor inventado no entra", async () => {
  const { POST } = await import("@/app/api/admin/candidates/route");
  const response = await POST(
    new Request("https://x.test/api/admin/candidates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${ADMIN_COOKIE}=${"a".repeat(64)}`,
      },
      body: JSON.stringify({ slug: "zueco", action: "promote" }),
    }),
  );
  assert.equal(response.status, 401);
});

test("descartar también exige sesión, y con ella funciona", async () => {
  const { POST } = await import("@/app/api/admin/candidates/route");
  await saveCandidates(
    db,
    [{ slug: "mala", nameEs: "candidata mala", category: "prenda",
       evidence: [{ title: "t", source: "Vogue", link: "https://x.test/2" }] }],
    "2026-09-16",
  );
  const cookie = (await login(jsonPost({ password: PASSWORD }))).cookies.get(ADMIN_COOKIE)!;

  const response = await POST(
    new Request("https://x.test/api/admin/candidates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${cookie.name}=${cookie.value}`,
      },
      body: JSON.stringify({ slug: "mala", action: "discard" }),
    }),
  );
  assert.equal(response.status, 200);

  const rows = await db.query<{ discarded_at: unknown }>(
    "select discarded_at from trend_candidates where slug = 'mala'",
  );
  assert.ok(rows[0].discarded_at);
});

test("una acción que no existe se rechaza antes de tocar la base", async () => {
  const { POST } = await import("@/app/api/admin/candidates/route");
  const cookie = (await login(jsonPost({ password: PASSWORD }))).cookies.get(ADMIN_COOKIE)!;

  for (const body of [
    { slug: "zueco", action: "borrar-todo" },
    { slug: "", action: "promote" },
    { action: "promote" },
  ]) {
    const response = await POST(
      new Request("https://x.test/api/admin/candidates", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${cookie.name}=${cookie.value}`,
        },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});
