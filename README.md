# Style Reverie

Terminal de inteligencia de tendencias de moda — "Bloomberg para moda", en versión
editorial y femenina. Cada tendencia cotiza con un score 0–100 derivado de señales
de seis fuentes, su momentum y su ciclo de vida.

**Estado actual: catálogo de tendencias mock, feed editorial real.** Las pantallas
que se alimentan del seed llevan la etiqueta visible *Datos de muestra*; `/editorial`
no la lleva porque sus titulares vienen por RSS de los medios.

Mercado objetivo: LATAM con foco en México. Los links de compra cotizan en MXN
(Shein, Zara México, Amazon México, Liverpool) y en USD (ASOS, Revolve, Nordstrom).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 (design tokens en `app/globals.css`)
- Recharts 3 para las gráficas
- Deploy previsto en Vercel

## Correr en local

```bash
npm install
npm run dev    # http://localhost:3000  → redirige a /trending
npm run build  # build de producción
npm run lint
npm run seed      # regenera data/trends.seed.json (determinista)
npm run editorial # trae los feeds RSS y escribe data/editorial.cache.json
npm test          # suite completa con node --test
npm run db:migrate # aplica el esquema a DATABASE_URL (o abre /api/admin/setup)
npm run db:seed    # carga el catálogo en Postgres con origen mock
npm run golden     # regenera el test de oro (solo si cambian pesos/umbrales)
```

Rutas:

| Ruta | Qué es | Datos |
| --- | --- | --- |
| `/trending` | Tabla de 25 tendencias con filtros | Mock |
| `/trends/<id>` | Ficha: momentum, fuentes, dónde comprar | Mock |
| `/compare?a=&b=` | Comparador A vs B | Mock |
| `/alerts` | Emergentes: momentum 7d ≥ 3 y score < 60 | Mock |
| `/editorial` | Titulares RSS cruzados con el catálogo | **Real** |
| `/edicion` | Cinco prendas por domingo, con archivo | Mock + curado |
| `/fashion-week` | Colecciones: looks, paleta y qué comprar | Curado |
| `/ocasiones` | Boda, ski, playa, oficina y fiesta | Curado |
| `/paleta` | Colores del catálogo por score | Mock + curado |

`/` redirige a `/trending`.

## Contenido curado

Lo que se edita a mano vive en `content/` y se lee con `fs` durante el build;
todas las páginas que lo consumen se prerenderizan, así que **cambiar un archivo
de `content/` requiere un nuevo deploy**. El contenido pasa por git a propósito.

```
content/ediciones/YYYY-MM-DD.json   Sobreescribe la edición de ese domingo
content/fashion-week/<slug>.json    Una colección de pasarela
content/ocasiones/<slug>.json       Una ocasión
content/paleta/<trend-id>.json      Con qué combina ese color
```

Las combinaciones de `/paleta` se nombran por id de tendencia
(`content/paleta/verde-matcha.json`) y llevan una pareja de ejemplo cada una:

```json
{ "pairs": [{ "trendId": "crochet-fino", "note": { "es": "…", "en": "…" } }] }
```

El orden del array es el orden en que se muestran. Un color sin archivo sale
con "todavía sin combinaciones curadas" en vez de un hueco.

La edición semanal funciona sin archivo: se genera sola con las cinco
tendencias de mayor momentum entre SUBIENDO y EMERGIENDO de esa semana. El
archivo solo hace falta para cambiar la selección o escribir los textos; si
trae `picks`, reemplaza la selección automática, y lo que no venga cae en lo
generado.

Importante para componentes cliente: no importar valores desde un módulo que
lea `fs`. Los estilos por ocasión viven en `lib/ocasiones-accent.ts` separados
de `lib/ocasiones.ts` justo por eso — importarlos juntos arrastra `node:fs` al
bundle del navegador y Turbopack aborta el build.

## Feed editorial

Ocho fuentes por RSS, cada una marcada con su idioma. Se parsean con
`rss-parser`, se cruzan contra los `keywords` de cada tendencia (nombre en ambos
idiomas, término de compra y sinónimos escritos a mano) y se guardan en un JSON
con TTL de una hora.

| Fuente | Idioma | URL | Verificada |
| --- | --- | --- | --- |
| Vogue México | es | `https://www.vogue.mx/feed/rss` | pendiente |
| Elle México | es | `https://elle.mx/feed/` | pendiente |
| Glamour México | es | `https://www.glamour.mx/feed/rss` | pendiente |
| Harper's Bazaar | en | `https://www.harpersbazaar.com/rss/all.xml/` | pendiente |
| Fashionista | en | `https://fashionista.com/.rss/full/` | pendiente |
| Vogue | en | `https://www.vogue.com/feed/rss` | sí |
| WWD | en | `https://wwd.com/feed/` | sí |
| Who What Wear | en | `https://www.whowhatwear.com/rss` | sí |

**Business of Fashion salió de la lista**: no publica RSS público y cada corrida
gastaba los 10s de timeout para devolver cero titulares.

Las cinco marcadas *pendiente* se agregaron desde un contenedor sin salida a
internet, así que su URL no se pudo comprobar en vivo. `npm run editorial`
imprime el estado de cada fuente: la que responda se queda y la que dé error se
quita de `FEEDS` en `lib/editorial.ts`, anotándolo aquí.

El idioma de la fuente decide contra qué términos cruza el matcher:
`lib/keyword-lang.ts` clasifica cada keyword como `es`, `en` o `both` (los
préstamos puros —boho, matcha, crochet, oversize— van a los dos, porque la
prensa mexicana los usa igual). Así "wine red" deja de casar por casualidad
dentro de un titular en español. Si el filtro dejara a una tendencia sin ningún
término, se usan todos: vale más un match en el idioma equivocado que ninguno.

El caché no se versiona: `data/editorial.cache.json` está en `.gitignore` porque
es un artefacto de runtime. En Vercel el repo es de solo lectura, así que el
refresco escribe en el directorio temporal y la página usa además `revalidate`
de una hora.

Cada titular lleva su imagen. Se busca en el feed por orden — `media:content`
(el tamaño mayor si viene repetido), `media:thumbnail`, `enclosure` de tipo
imagen y la primera `<img>` de `content:encoded` — y si no hay ninguna se
descarga el artículo para leer su `og:image`. La imagen se guarda junto al item
en el caché, así que ese fetch extra se hace una sola vez por artículo; está
acotado a 12 por refresco para que un feed sin imágenes no alargue el ciclo.

Los hosts de imagen de las cinco fuentes nuevas se anotaron igual de a ciegas
que sus URLs. Si alguno está mal la tarjeta pinta el placeholder de la fuente,
no se rompe nada: la lista es una red de seguridad, no un requisito.

Los hosts que puede cargar `next/image` viven en `IMAGE_HOSTS`
(`lib/editorial-image.ts`) y `next.config.ts` construye desde ahí sus
`remotePatterns`. Si un feed sirviera desde un CDN que no está en la lista, el
servidor anula esa imagen y la tarjeta pinta el placeholder de la fuente en vez
de dejar que `next/image` lance en runtime.

Para probar sin salir a internet, cada URL se puede apuntar a un servidor local
con su variable: `SR_FEED_VOGUE_MX`, `SR_FEED_ELLE_MX`, `SR_FEED_GLAMOUR_MX`,
`SR_FEED_BAZAAR`, `SR_FEED_FASHIONISTA`, `SR_FEED_VOGUE`, `SR_FEED_WWD` y
`SR_FEED_WWW`. `SR_IMAGE_HOSTS` acepta hosts de imagen extra separados por coma.

## Rutas de operación

Tres rutas para operar sin terminal. Se autorizan con `CRON_SECRET`, por
cabecera `Authorization: Bearer <secreto>` —que es como lo manda Vercel— o por
`?secret=` en la URL, para poder abrirlas desde el celular. El parámetro queda
en el historial del navegador y en los logs de acceso: conviene rotar el
secreto después de usarlo así.

| Ruta | Qué hace |
| --- | --- |
| `GET /api/cron/daily` | Corrida diaria: migra, corre las fuentes, descubre candidatas y congela la edición del domingo |
| `GET /api/admin/setup` | Aplica el esquema y siembra solo si `trends` está vacía. Idempotente |
| `GET /api/admin/runs` | Las últimas 20 filas de `signal_runs` con su `detail`. Solo lectura; `?limit=` sube hasta 100 |

`runs` es la que se abre cuando algo salió raro: cada conector deja ahí su
motivo de fallo o de salto, y el paso de descubrimiento su desglose completo.
Una corrida sin `finishedAt` se quedó a medias —se cayó la función o se agotó
el tiempo—, que es distinto de una que terminó en error.

## Descubrimiento de candidatas

El cron manda los titulares del día a Claude (`lib/sources/discovery.ts`) y
extrae tendencias de las que la prensa habla y el catálogo todavía no tiene.
Las candidatas **no entran al catálogo solas**: se acumulan en
`trend_candidates` con su conteo de menciones y su evidencia, y aparecen en
`/alerts` bajo *Detectadas en prensa, sin catalogar*. Promoverlas es una
decisión humana.

Antes de gastar tokens, `lib/sources/fashion-filter.ts` filtra. La primera
corrida real llegó llena de notas de negocio —nombramientos, aranceles,
exposiciones— porque una nota sobre el nuevo director creativo de una casa dice
"collection" y eso contaba como señal de moda. Ahora el filtro:

- **Veta en duro** lo que nunca es una tendencia por muchas prendas que nombre:
  nombramientos, cadena de suministro, resultados, museos y premios. El veto
  busca palabra completa, no subcadena, para que un falso positivo no tire un
  titular de moda en silencio.
- **Separa prenda de contexto.** Una prenda, color o textura concretos bastan;
  "collection", "runway" o "style" describen el marco y hacen falta al menos
  dos para seguir sin ninguna prenda.
- **Pesa el otro tema**: un titular de belleza que además nombra un vestido
  cae por belleza.

Cada corrida deja su desglose en `signal_runs.detail`, en una línea:

```
120 titulares · 14 pasaron el filtro (40 negocio, 58 sin moda, 8 otro tema) ·
14 al modelo · 6 candidatas · descartadas 1 por nombre corto, 2 ya en
catálogo, 0 sin evidencia · 3 nuevas
```

Sin eso, una corrida que termina "ok" con cero candidatas no se puede explicar
sin volver a correrla.

## Estructura

```
app/
  layout.tsx            Shell: fuentes, provider de idioma, nav lateral
  trending/             Tabla de tendencias con filtros
  trends/[id]/          Ficha de una tendencia
  compare/              Comparador A vs B
  alerts/               Alertas de emergentes
  editorial/            Feed editorial RSS
components/             Shell, nav, badges, gráficas
data/trends.seed.json   25 tendencias SS26/FW26 con 90 días de señales
lib/scoring.ts          Score compuesto ponderado por fuente
lib/lifecycle.ts        Ciclo de vida derivado de score + momentum
lib/editorial.ts        Fetch de los RSS, caché de 1 hora y estado por fuente
lib/editorial-match.ts  Normalización y match de tendencias en un titular
lib/keyword-lang.ts     Clasifica cada keyword por idioma (es / en / ambos)
lib/sources/            Conectores externos, filtro de moda y descubrimiento
lib/editorial-image.ts  Imagen del item, og:image y hosts permitidos
lib/edicion.ts          Edición semanal: selección, razones y archivo
lib/fashion-week.ts     Carga de colecciones curadas
lib/ocasiones.ts        Carga de ocasiones curadas
lib/paleta.ts           Colores por score y sus combinaciones curadas
lib/forecast.ts         Regresión lineal a 7 días
lib/content.ts          Lectura de los JSON de content/
scripts/generate-seed.ts   Generador del seed (npm run seed)
scripts/fetch-editorial.ts Refresco manual del feed (npm run editorial)
```

## Idioma

Español por default, toggle ES/EN en el pie de la barra lateral (se guarda en
`localStorage`). Los nombres y descripciones de tendencias vienen con ambos idiomas
en el seed.

## Diseño

Fondo blanco, pasteles sutiles (lavanda, rosa pálido, sage, crema), serif editorial
(Playfair Display) para titulares y sans (Inter) para datos, con cifras tabulares.
Sin dark mode y sin emojis en la interfaz.
