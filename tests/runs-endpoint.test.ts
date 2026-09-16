import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Db } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { finishRun, startRun } from "@/lib/db/runs";
import { GET } from "@/app/api/admin/runs/route";

const SECRET = "secreto-de-prueba-largo-para-timing-safe";
const URL_BASE = "https://x.test/api/admin/runs";

let pg: PGlite;
let db: Db;

const req = (url: string, headers?: Record<string, string>) =>
  new Request(url, { headers });

before(async () => {
  process.env.CRON_SECRET = SECRET;
  pg = new PGlite();
  db = {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
  };
  setDb(db);
  await migrate(db);

  // 25 corridas, para poder comprobar el tope de 20.
  for (let i = 0; i < 24; i += 1) {
    const id = await startRun(db, `fuente-${i}`);
    await finishRun(db, id, "ok", i);
  }
  const ultima = await startRun(db, "discovery");
  await finishRun(
    db,
    ultima,
    "skipped",
    0,
    "falta ANTHROPIC_API_KEY · 120 titulares · 14 pasaron el filtro",
  );
});

after(async () => {
  setDb(null);
  delete process.env.CRON_SECRET;
  await pg.close();
});

test("sin credenciales devuelve 401 y no toca la base", async () => {
  const response = await GET(req(URL_BASE));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "no autorizado" });
});

test("con un secreto equivocado tampoco entra", async () => {
  const response = await GET(req(`${URL_BASE}?secret=otro`));
  assert.equal(response.status, 401);
});

test("autoriza por cabecera Bearer, como el cron", async () => {
  const response = await GET(
    req(URL_BASE, { authorization: `Bearer ${SECRET}` }),
  );
  assert.equal(response.status, 200);
});

test("autoriza por ?secret=, que es como se abre desde el celular", async () => {
  const response = await GET(req(`${URL_BASE}?secret=${SECRET}`));
  assert.equal(response.status, 200);
});

test("devuelve las últimas 20 corridas, la más reciente primero", async () => {
  const response = await GET(req(`${URL_BASE}?secret=${SECRET}`));
  const body = await response.json();

  assert.equal(body.status, "ok");
  assert.equal(body.count, 20);
  assert.equal(body.runs.length, 20);
  assert.equal(body.runs[0].source, "discovery");
});

test("cada fila trae su detalle, que es para lo que existe la ruta", async () => {
  const response = await GET(req(`${URL_BASE}?secret=${SECRET}`));
  const body = await response.json();
  const discovery = body.runs[0];

  assert.equal(discovery.status, "skipped");
  assert.match(discovery.detail, /pasaron el filtro/);
  assert.equal(typeof discovery.startedAt, "string");
  assert.equal(typeof discovery.rowsWritten, "number");
  assert.ok(discovery.durationMs !== null, "una corrida terminada tiene duración");
});

test("una corrida a medias se distingue de una que terminó en error", async () => {
  // Sin finished_at no hay duración: la función se cayó o se agotó el tiempo.
  await startRun(db, "a-medias");
  const response = await GET(req(`${URL_BASE}?secret=${SECRET}`));
  const body = await response.json();

  assert.equal(body.runs[0].source, "a-medias");
  assert.equal(body.runs[0].finishedAt, null);
  assert.equal(body.runs[0].durationMs, null);
});

test("el limit se acota: ni cero ni más de cien", async () => {
  const pocas = await (await GET(req(`${URL_BASE}?secret=${SECRET}&limit=3`))).json();
  assert.equal(pocas.count, 3);

  const cero = await (await GET(req(`${URL_BASE}?secret=${SECRET}&limit=0`))).json();
  assert.equal(cero.count, 1, "un límite de cero se sube a uno");

  const basura = await (
    await GET(req(`${URL_BASE}?secret=${SECRET}&limit=hola`))
  ).json();
  assert.equal(basura.count, 20, "lo que no es número cae al tope por defecto");
});

test("sin CRON_SECRET configurado devuelve 503, no 401", async () => {
  delete process.env.CRON_SECRET;
  try {
    const response = await GET(req(URL_BASE));
    assert.equal(response.status, 503);
  } finally {
    process.env.CRON_SECRET = SECRET;
  }
});
