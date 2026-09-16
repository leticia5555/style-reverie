import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FEEDS, readCache } from "@/lib/editorial";
import { IMAGE_HOSTS } from "@/lib/editorial-image";

test("Business of Fashion ya no está: no publica RSS y costaba el timeout", () => {
  const keys = FEEDS.map((feed) => feed.key);
  assert.ok(!keys.includes("bof" as never));
  assert.ok(!FEEDS.some((feed) => feed.url.includes("businessoffashion")));
});

test("están las fuentes nuevas, con su idioma", () => {
  const byKey = new Map(FEEDS.map((feed) => [feed.key as string, feed]));
  for (const key of ["vogue-mx", "glamour-mx"]) {
    assert.equal(byKey.get(key)?.lang, "es", `${key} debería ser una fuente en español`);
  }
  for (const key of ["bazaar", "fashionista"]) {
    assert.equal(byKey.get(key)?.lang, "en", `${key} debería ser una fuente en inglés`);
  }
});

test("cada fuente tiene clave única, idioma declarado y URL https", () => {
  const keys = new Set<string>();
  for (const feed of FEEDS) {
    assert.ok(!keys.has(feed.key), `clave duplicada: ${feed.key}`);
    keys.add(feed.key);
    assert.ok(["es", "en"].includes(feed.lang), `${feed.key} sin idioma válido`);
    assert.match(feed.url, /^https:\/\//, `${feed.key} con URL rara`);
  }
});

/**
 * El caché en disco sobrevive a los cambios de la lista de fuentes: quedaron
 * artículos de Business of Fashion escritos por la corrida anterior, y sin
 * limpiarlos la página seguiría pintando una fuente que ya no existe.
 */
test("leer el caché descarta los artículos de una fuente retirada", () => {
  const path = join(tmpdir(), "style-reverie-editorial.json");
  const backup = `${path}.test-backup`;
  const had = existsSync(path);
  if (had) renameSync(path, backup);

  try {
    writeFileSync(
      path,
      JSON.stringify({
        // En el futuro para ganarle al caché versionado del repo.
        fetchedAt: "2099-01-01T00:00:00.000Z",
        articles: [
          { id: "a", title: "T", link: "https://x/1", source: "bof", sourceName: "Business of Fashion", publishedAt: null, snippet: "", matches: [], imageUrl: null, imageFrom: null },
          { id: "b", title: "U", link: "https://x/2", source: "wwd", sourceName: "WWD", publishedAt: null, snippet: "", matches: [], imageUrl: null, imageFrom: null },
        ],
        feeds: [
          { key: "bof", name: "Business of Fashion", url: "https://x", ok: true, count: 1 },
          { key: "wwd", name: "WWD", url: "https://x", ok: true, count: 1 },
        ],
      }),
      "utf8",
    );

    const cache = readCache();
    assert.deepEqual(cache.articles.map((a) => a.id), ["b"]);
    assert.deepEqual(cache.feeds.map((f) => f.key), ["wwd"]);
    // Y al artículo que se guardó sin idioma se le pone el de su fuente.
    assert.equal(cache.articles[0].lang, "en");
  } finally {
    rmSync(path, { force: true });
    if (had) renameSync(backup, path);
  }
});

test("data/editorial.cache.json no se versiona: es artefacto de runtime", () => {
  const ignore = readFileSync("./.gitignore", "utf8");
  assert.match(ignore, /editorial\.cache\.json/);
});

test("la entradilla de /editorial no nombra fuentes: la lista cambia", () => {
  // Nombraba a Business of Fashion mucho después de que dejara de existir en
  // FEEDS. El contador de fuentes vivas ya dice cuáles respondieron.
  const i18n = readFileSync("./lib/i18n.tsx", "utf8");
  const subtitle = i18n.slice(i18n.indexOf('"editorial.subtitle"'));
  for (const feed of FEEDS) {
    assert.ok(
      !subtitle.slice(0, 400).includes(feed.name),
      `la entradilla nombra a ${feed.name} y se quedará desactualizada`,
    );
  }
});

test("cada fuente tiene al menos un host de imagen anotado", () => {
  // Si falta, la tarjeta cae al placeholder: no rompe, pero se pierde la foto.
  const hosts = IMAGE_HOSTS.join(" ");
  const esperados: Record<string, string> = {
    "vogue-mx": "vogue.mx",
    "glamour-mx": "glamour.mx",
    bazaar: "hearstapps.com",
    fashionista: "fashionista.com",
    vogue: "assets.vogue.com",
    wwd: "wwd.com",
    whowhatwear: "whowhatwear.com",
  };
  for (const feed of FEEDS) {
    assert.ok(
      hosts.includes(esperados[feed.key]),
      `${feed.name} no tiene host de imagen en IMAGE_HOSTS`,
    );
  }
});

test("los hosts de Business of Fashion salieron con la fuente", () => {
  assert.ok(!IMAGE_HOSTS.some((host) => host.includes("businessoffashion")));
});

test("Elle México salió: no se le encontró RSS y costaba su timeout", () => {
  // Si alguna vez aparece una URL que responda, vuelve con su idioma "es".
  assert.ok(!FEEDS.some((feed) => feed.url.includes("elle.mx")));
  assert.ok(!IMAGE_HOSTS.some((host) => host.includes("elle.mx")));
});
