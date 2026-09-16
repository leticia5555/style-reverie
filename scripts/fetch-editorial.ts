/**
 * Trae los feeds editoriales y guarda data/editorial.cache.json.
 *
 *   npm run editorial
 *
 * Es el refresco manual; en runtime la página se refresca sola cuando el
 * caché pasa de una hora. Cada URL se puede apuntar a otro sitio con su
 * SR_FEED_* (ver README), que es como se prueba el parser sin salir a internet.
 *
 * Su salida es además la forma de verificar una fuente nueva: la que imprima
 * ERROR se quita de FEEDS y se anota en el README.
 */
import { refreshEditorial } from "@/lib/editorial";

async function main() {
  const cache = await refreshEditorial({ toRepo: true });

  for (const feed of cache.feeds) {
    const state = feed.ok ? `${feed.count} artículos` : `ERROR ${feed.error}`;
    console.log(`${feed.name.padEnd(18)} ${feed.lang.padEnd(5)} ${state}`);
  }

  const matched = cache.articles.filter((a) => a.matches.length).length;
  console.log(
    `\n${cache.articles.length} titulares · ${matched} cruzan con alguna tendencia`,
  );

  if (!cache.feeds.some((feed) => feed.ok)) {
    console.error("\nNinguna fuente respondió: se conservó el caché anterior.");
    process.exitCode = 1;
  }
}

main();
