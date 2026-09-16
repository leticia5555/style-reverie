import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AWIN_IMAGE_HOSTS,
  byTier,
  fetchAwinProducts,
  isAwinImageHost,
  mockAwinProducts,
  usableProducts,
  type AwinProduct,
} from "@/lib/sources/awin";
import type { ShopLink } from "@/lib/types";

const producto = (over: Partial<AwinProduct> = {}): AwinProduct => ({
  id: "p1",
  retailer: "ASOS",
  title: "Pantalón satinado",
  imageUrl: "https://images.asos-media.com/p1.jpg",
  url: "https://asos.test/p1",
  price: 99,
  currency: "USD",
  tier: "mid",
  ...over,
});

test("solo se aceptan hosts de imagen de anunciantes aprobados", () => {
  assert.equal(isAwinImageHost("https://images.asos-media.com/x.jpg"), true);
  assert.equal(isAwinImageHost("https://static.zara.net/x.jpg"), true);
  assert.equal(isAwinImageHost("https://cualquier-cosa.test/x.jpg"), false);
});

test("una foto de producto por http no pasa", () => {
  assert.equal(isAwinImageHost("http://images.asos-media.com/x.jpg"), false);
});

test("un producto sin imagen del retailer se descarta", () => {
  // Es la regla entera de esta tira: sin foto del retailer, no hay tarjeta.
  const kept = usableProducts([
    producto(),
    producto({ id: "p2", imageUrl: "" }),
    producto({ id: "p3", imageUrl: "https://pinterest.com/x.jpg" }),
  ]);
  assert.deepEqual(kept.map((p) => p.id), ["p1"]);
});

test("si ninguno tiene foto del retailer, los tres niveles quedan vacíos", () => {
  const grouped = byTier([
    producto({ id: "a", imageUrl: "" }),
    producto({ id: "b", imageUrl: "https://otro.test/x.jpg" }),
  ]);
  assert.deepEqual(grouped, { budget: [], mid: [], invest: [] });
});

test("byTier agrupa conservando el orden del feed", () => {
  const grouped = byTier([
    producto({ id: "a", tier: "budget" }),
    producto({ id: "b", tier: "invest" }),
    producto({ id: "c", tier: "budget" }),
  ]);
  assert.deepEqual(grouped.budget.map((p) => p.id), ["a", "c"]);
  assert.deepEqual(grouped.invest.map((p) => p.id), ["b"]);
  assert.deepEqual(grouped.mid, []);
});

/* ── el mock tiene la forma del feed real ──────────────────────────── */

const link = (retailer: string): ShopLink => ({
  retailer,
  label: { es: "prenda", en: "piece" },
  price: 100,
  currency: "USD",
  priceUsd: 100,
  url: `https://${retailer}.test/x`,
});

test("el mock trae productos que hay que descartar, a propósito", () => {
  // Un mock donde todo está bien no prueba la única regla que importa.
  const todos = mockAwinProducts("x", [link("ASOS"), link("Tienda Rara")]);
  assert.equal(todos.length, 2);
  assert.equal(usableProducts(todos).length, 1, "el retailer desconocido cae");
});

test("sin credenciales NO se sirve el mock: la tira no se pinta", async () => {
  // Las URLs del mock apuntan a hosts reales de anunciantes y no existen.
  // Servirlas llenaría la ficha de recuadros rotos, que es peor que no tener
  // tira — y es justo la regla de esta sección.
  const anterior = process.env.AWIN_API_KEY;
  const host = process.env.SR_AWIN_HOST;
  delete process.env.AWIN_API_KEY;
  delete process.env.SR_AWIN_HOST;
  try {
    const productos = await fetchAwinProducts("x", [
      link("ASOS"),
      link("Zara México"),
    ]);
    assert.deepEqual(productos, []);
  } finally {
    if (anterior) process.env.AWIN_API_KEY = anterior;
    if (host) process.env.SR_AWIN_HOST = host;
  }
});

test("con SR_AWIN_HOST se sirve el mock, para poder verla en local", async () => {
  const anterior = process.env.AWIN_API_KEY;
  delete process.env.AWIN_API_KEY;
  process.env.SR_AWIN_HOST = "localhost:4600";
  try {
    const productos = await fetchAwinProducts("x", [
      link("ASOS"),
      link("Zara México"),
    ]);
    assert.equal(productos.length, 2);
    assert.ok(productos.every((p) => p.imageUrl.includes("localhost:4600")));
  } finally {
    delete process.env.SR_AWIN_HOST;
    if (anterior) process.env.AWIN_API_KEY = anterior;
  }
});

test("next.config declara los hosts de Awin, o next/image los rechazaría", () => {
  const config = readFileSync("./next.config.ts", "utf8");
  assert.match(config, /AWIN_IMAGE_HOSTS/);
  assert.ok(AWIN_IMAGE_HOSTS.length > 0);
});
