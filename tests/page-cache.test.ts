import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Una página que lee la base no puede servirse congelada desde el build.
 *
 * Pasó de verdad: una corrida de descubrimiento escribió 25 candidatas y
 * /alerts siguió enseñando las de la última compilación. No falla nada, no se
 * registra nada — la página simplemente miente hasta el siguiente deploy.
 */
const DB_PAGES = [
  "app/alerts/page.tsx",
  "app/trending/page.tsx",
  "app/paleta/page.tsx",
  "app/edicion/page.tsx",
  "app/compare/page.tsx",
];

const read = (path: string) => readFileSync(path, "utf8");

test("toda página que lee la base declara su política de caché", () => {
  for (const path of DB_PAGES) {
    const source = read(path);
    const leeLaBase = /getCatalog|listCandidates|getEdicion/.test(source);
    if (!leeLaBase) continue;

    const declara =
      /export const dynamic\s*=/.test(source) ||
      /export const revalidate\s*=/.test(source) ||
      // searchParams ya vuelve dinámica la página por sí solo.
      /searchParams/.test(source);

    assert.ok(declara, `${path} se serviría congelada desde el build`);
  }
});

test("/alerts va dinámica: es donde se mira tras correr el descubrimiento", () => {
  assert.match(read("app/alerts/page.tsx"), /export const dynamic = "force-dynamic"/);
});

test("las páginas de catálogo se refrescan solas, sin esperar un deploy", () => {
  for (const path of ["app/trending/page.tsx", "app/paleta/page.tsx", "app/edicion/page.tsx"]) {
    const match = read(path).match(/export const revalidate = (\d+)/);
    assert.ok(match, `${path} sin revalidate`);
    const seconds = Number(match[1]);
    // El cron corre una vez al día; más de una hora ya no es "se refresca".
    assert.ok(seconds > 0 && seconds <= 3600, `${path}: revalidate ${seconds}`);
  }
});
