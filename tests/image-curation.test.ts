import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import {
  approveHost,
  listApprovedHosts,
  listCuratedImages,
  removeCuratedImage,
  saveCuratedImage,
} from "@/lib/curated-images";
import {
  evaluateImageResponse,
  isKnownHost,
  parseImageUrl,
} from "@/lib/image-validate";
import { proxiedImageUrl } from "@/lib/trend-image";

let pg: PGlite;
let db: Db;

before(async () => {
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  setDb(db);
  await migrate(db);
  await db.query(
    `insert into trends (id, name_es, name_en, category, season, summary_es,
                         summary_en, score_year_ago, keywords, shopping)
     values ('zueco', 'zueco', 'clog', 'prenda', 'FW26', 'x', 'x', 0, '{}', '{}'::jsonb)`,
  );

});

after(async () => {
  setDb(null);
  await pg.close();
});

beforeEach(async () => {
  await pg.query("delete from trend_images");
  await pg.query("delete from image_hosts");
});

/* ── lo que se rechaza antes de salir a la red ─────────────────────── */

test("una URL que no es https no se pide", () => {
  const out = parseImageUrl("http://ejemplo.test/x.jpg");
  assert.ok("reason" in out && out.reason.includes("https"));
});

test("una dirección interna nunca se pide", () => {
  // El servidor pediría desde dentro de la red del proveedor: una URL así
  // convertiría la ruta en una forma de mirar lo que hay ahí dentro.
  for (const raw of [
    "https://localhost/x.jpg",
    "https://127.0.0.1/x.jpg",
    "https://10.0.0.5/x.jpg",
    "https://192.168.1.1/x.jpg",
    "https://172.16.4.4/x.jpg",
    "https://169.254.169.254/latest/meta-data",
    "https://metadata.google.internal/x.jpg",
  ]) {
    const out = parseImageUrl(raw);
    assert.ok("reason" in out, `debería rechazar ${raw}`);
  }
});

test("una IP pública sí se admite: no todo lo numérico es interno", () => {
  assert.ok(!("reason" in parseImageUrl("https://93.184.216.34/x.jpg")));
});

test("lo que no es una URL se dice, no se revienta", () => {
  assert.ok("reason" in parseImageUrl("pega aquí la url"));
});

/* ── lo que solo se sabe pidiéndola ────────────────────────────────── */

const respuesta = (
  status: number,
  contentType: string,
  body: BodyInit | null = "xx",
) => new Response(status === 204 ? null : body, {
  status,
  headers: contentType ? { "content-type": contentType } : {},
});

test("una imagen que carga se acepta y dice su host", async () => {
  const check = await evaluateImageResponse(
    respuesta(200, "image/jpeg"),
    "assets.vogue.com",
  );
  assert.equal(check.ok, true);
  assert.equal(check.ok && check.host, "assets.vogue.com");
  assert.equal(check.ok && check.knownHost, true);
});

test("un host que no está compilado se marca como nuevo", async () => {
  const check = await evaluateImageResponse(respuesta(200, "image/webp"), "nueva.test");
  assert.equal(check.ok && check.knownHost, false, "hay que aprobarlo");
});

test("un 404 se dice con su número", async () => {
  const check = await evaluateImageResponse(respuesta(404, "text/html"), "x.test");
  assert.equal(check.ok, false);
  assert.match(!check.ok ? check.reason : "", /404/);
});

test("una página HTML con extensión .jpg no cuela", async () => {
  // Es el caso que solo se ve pidiéndola: la URL parece una foto y no lo es.
  const check = await evaluateImageResponse(respuesta(200, "text/html"), "x.test");
  assert.equal(check.ok, false);
  assert.match(!check.ok ? check.reason : "", /no es una imagen/);
});

test("un SVG se rechaza porque next/image no lo optimiza", async () => {
  const check = await evaluateImageResponse(respuesta(200, "image/svg+xml"), "x.test");
  assert.equal(check.ok, false);
  assert.match(!check.ok ? check.reason : "", /SVG/);
});

test("un 200 con el cuerpo vacío no es una imagen", async () => {
  const check = await evaluateImageResponse(respuesta(200, "image/jpeg", ""), "x.test");
  assert.equal(check.ok, false);
});

test("el content-type con charset se lee igual", async () => {
  const check = await evaluateImageResponse(
    respuesta(200, "image/jpeg; charset=binary"),
    "assets.vogue.com",
  );
  assert.equal(check.ok, true);
  assert.equal(check.ok && check.contentType, "image/jpeg");
});

test("isKnownHost distingue los compilados de los demás", () => {
  assert.equal(isKnownHost("assets.vogue.com"), true);
  assert.equal(isKnownHost("ASSETS.VOGUE.COM"), true);
  assert.equal(isKnownHost("cualquiera.test"), false);
});

/* ── guardar, listar, quitar ───────────────────────────────────────── */

test("guardar una foto la deja curada y en primer lugar", async () => {
  await saveCuratedImage(db, {
    trendId: "zueco",
    imageUrl: "https://assets.vogue.com/z.jpg",
    credit: "Vogue México",
    creditUrl: "https://www.vogue.mx/articulo",
  });
  const rows = await listCuratedImages(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].credit, "Vogue México");
});

test("guardar dos veces reemplaza, no duplica", async () => {
  const base = {
    trendId: "zueco",
    credit: "Vogue México",
    creditUrl: "https://www.vogue.mx/a",
  };
  await saveCuratedImage(db, { ...base, imageUrl: "https://assets.vogue.com/1.jpg" });
  await saveCuratedImage(db, { ...base, imageUrl: "https://assets.vogue.com/2.jpg" });
  const rows = await listCuratedImages(db);
  assert.equal(rows.length, 1);
  assert.match(rows[0].imageUrl, /2\.jpg$/);
});

test("quitarla la devuelve al feed o al pastel", async () => {
  await saveCuratedImage(db, {
    trendId: "zueco",
    imageUrl: "https://assets.vogue.com/z.jpg",
    credit: "Vogue México",
    creditUrl: "https://www.vogue.mx/a",
  });
  await removeCuratedImage(db, "zueco");
  assert.deepEqual(await listCuratedImages(db), []);
});

test("aprobar un host es idempotente", async () => {
  await approveHost(db, "fotos.nuevas.test");
  await approveHost(db, "FOTOS.NUEVAS.TEST");
  assert.deepEqual(await listApprovedHosts(db), ["fotos.nuevas.test"]);
});

/* ── el proxy ──────────────────────────────────────────────────────── */

test("la URL curada se pide por el proxy, no directa", () => {
  // remotePatterns es de tiempo de compilación: un host aprobado hoy no
  // serviría hasta el siguiente deploy si se pidiera directa.
  const url = proxiedImageUrl("https://fotos.nuevas.test/x.jpg");
  assert.match(url, /^\/api\/image\?src=/);
  assert.ok(url.includes(encodeURIComponent("https://fotos.nuevas.test/x.jpg")));
});

test("el proxy rechaza un host que no está aprobado", async () => {
  const { GET } = await import("@/app/api/image/route");
  const response = await GET(
    new Request(
      `https://x.test/api/image?src=${encodeURIComponent("https://sin-aprobar.test/x.jpg")}`,
    ),
  );
  assert.equal(response.status, 403, "sin esto sería un proxy abierto");
});

test("el proxy rechaza una dirección interna aunque esté 'aprobada'", async () => {
  await approveHost(db, "127.0.0.1");
  const { GET } = await import("@/app/api/image/route");
  const response = await GET(
    new Request(
      `https://x.test/api/image?src=${encodeURIComponent("https://127.0.0.1/secreto")}`,
    ),
  );
  assert.equal(response.status, 400);
});

test("el proxy sin src no revienta", async () => {
  const { GET } = await import("@/app/api/image/route");
  const response = await GET(new Request("https://x.test/api/image"));
  assert.equal(response.status, 400);
});

/* ── el endpoint del panel ─────────────────────────────────────────── */

const SECRET = "contraseña-de-prueba-larga-y-tonta";

const post = (body: unknown, cookie?: string) =>
  new Request("https://x.test/api/admin/images", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

async function adminCookie(): Promise<string> {
  const { sessionToken, ADMIN_COOKIE } = await import("@/lib/admin");
  return `${ADMIN_COOKIE}=${sessionToken(SECRET)}`;
}

test("sin sesión no se guarda nada", async () => {
  process.env.ADMIN_PASSWORD = SECRET;
  const { POST } = await import("@/app/api/admin/images/route");
  const response = await POST(
    post({ trendId: "zueco", imageUrl: "https://assets.vogue.com/z.jpg", credit: "V", creditUrl: "https://www.vogue.mx/a" }),
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await listCuratedImages(db), []);
  delete process.env.ADMIN_PASSWORD;
});

test("faltando el crédito no se guarda, aunque la URL sea buena", async () => {
  // Es la regla de las imágenes: sin crédito y sin enlace no se enseña, así
  // que tampoco se acepta. Se comprueba ANTES de salir a la red.
  process.env.ADMIN_PASSWORD = SECRET;
  const { POST } = await import("@/app/api/admin/images/route");
  const cookie = await adminCookie();

  for (const body of [
    { trendId: "zueco", imageUrl: "https://assets.vogue.com/z.jpg", creditUrl: "https://www.vogue.mx/a" },
    { trendId: "zueco", imageUrl: "https://assets.vogue.com/z.jpg", credit: "Vogue" },
    { trendId: "zueco", credit: "Vogue", creditUrl: "https://www.vogue.mx/a" },
  ]) {
    const response = await POST(post(body, cookie));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.deepEqual(await listCuratedImages(db), []);
  delete process.env.ADMIN_PASSWORD;
});

test("un enlace al original que no es https se rechaza", async () => {
  process.env.ADMIN_PASSWORD = SECRET;
  const { POST } = await import("@/app/api/admin/images/route");
  const response = await POST(
    post(
      {
        trendId: "zueco",
        imageUrl: "https://assets.vogue.com/z.jpg",
        credit: "Vogue",
        creditUrl: "http://www.vogue.mx/a",
      },
      await adminCookie(),
    ),
  );
  assert.equal(response.status, 400);
  delete process.env.ADMIN_PASSWORD;
});

test("quitar una foto sí funciona con sesión", async () => {
  process.env.ADMIN_PASSWORD = SECRET;
  await saveCuratedImage(db, {
    trendId: "zueco",
    imageUrl: "https://assets.vogue.com/z.jpg",
    credit: "Vogue México",
    creditUrl: "https://www.vogue.mx/a",
  });
  const { POST } = await import("@/app/api/admin/images/route");
  const response = await POST(
    post({ trendId: "zueco", action: "remove" }, await adminCookie()),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await listCuratedImages(db), []);
  delete process.env.ADMIN_PASSWORD;
});
