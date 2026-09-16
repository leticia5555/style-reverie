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
```

Rutas:

| Ruta | Qué es | Datos |
| --- | --- | --- |
| `/trending` | Tabla de 25 tendencias con filtros | Mock |
| `/trends/<id>` | Ficha: momentum, fuentes, dónde comprar | Mock |
| `/compare?a=&b=` | Comparador A vs B | Mock |
| `/alerts` | Emergentes: momentum 7d ≥ 3 y score < 60 | Mock |
| `/editorial` | Titulares RSS cruzados con el catálogo | **Real** |

`/` redirige a `/trending`.

## Feed editorial

Cuatro fuentes por RSS: Vogue, WWD, Business of Fashion y Who What Wear. Se
parsean con `rss-parser`, se cruzan contra los `keywords` de cada tendencia
(nombre en ambos idiomas, término de compra y sinónimos escritos a mano) y se
guardan en un JSON con TTL de una hora.

El caché no se versiona: `data/editorial.cache.json` está en `.gitignore` porque
es un artefacto de runtime. En Vercel el repo es de solo lectura, así que el
refresco escribe en el directorio temporal y la página usa además `revalidate`
de una hora.

Para probar el parser sin salir a internet, las URLs se pueden apuntar a un
servidor local con `SR_FEED_VOGUE`, `SR_FEED_WWD`, `SR_FEED_BOF` y `SR_FEED_WWW`.

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
