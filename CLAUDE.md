# Style Reverie — decisiones de arquitectura

Terminal de inteligencia de tendencias de moda. SaaS a $9/mes.

Este archivo es el contrato entre sesiones. Lo de aquí no se cambia sin decirlo
explícitamente: si una tarea parece pedir lo contrario, es que hay que
preguntar, no improvisar.

---

## Mercado

- **LATAM con foco en México.** No España, no Europa.
- **Español por default**, inglés por toggle. Todo texto de dominio es
  `Localized { es, en }`; nunca se hardcodea una sola lengua en un componente.
- **Precios en MXN y USD.** La moneda va pegada al retailer, no al nivel de
  precio: los locales (Shein, Zara México, Amazon México, Liverpool) cotizan en
  pesos y los de importación (ASOS, Revolve, Nordstrom) en dólares.
- **El código de moneda siempre visible** junto al monto. MXN y USD comparten
  el símbolo `$` y confundirlos no es un detalle.
- Los rangos de precio se definen en USD y el precio en MXN se deriva con un
  tipo de cambio de referencia estático, para que los tres niveles
  (Budget / Mid / Invest) queden ordenados aunque mezclen monedas. `ShopLink`
  guarda `priceUsd` para poder ordenar sin convertir al vuelo.

## Diseño

- **Fondo blanco con pasteles sutiles**: lavanda, rosa pálido, sage, crema.
  Todos los colores son tokens en `app/globals.css`; no se escriben hex sueltos
  en componentes (excepto los swatches de color del catálogo y los hex de las
  paletas curadas de Fashion Week, que son dato, no estilo).
- **Playfair Display para titulares, Inter para datos**, con cifras tabulares
  (`.tabular`) en toda columna numérica para que no bailen al filtrar.
- **Nunca dark mode.** `color-scheme: light`, y ninguna media query de
  `prefers-color-scheme`.
- **Nunca emojis en la UI.** Ni en labels, ni en botones, ni en estados vacíos.
- Sensación de terminal financiera, pero femenina y editorial.

## Datos derivados

- **El score y el ciclo de vida se DERIVAN en `lib/`. Nunca se guardan ni se
  asignan a mano.**
  - `lib/scoring.ts` — el score es el promedio ponderado **renormalizado**.
  - `lib/lifecycle.ts` — el ciclo de vida sale de score + momentum 7d.

### Pesos y renormalización

Pesos conceptuales, suman 1 entre las siete fuentes:

| Fuente | Peso | Participa |
| --- | --- | --- |
| Google Trends | .20 | sí |
| Mercado Libre | .20 | sí |
| Pinterest | .18 | **NO** |
| TikTok | .15 | sí |
| Instagram | .10 | sí |
| Editorial | .10 | sí |
| Amazon | .07 | sí |

**El score de cada día se calcula solo con las fuentes que tienen valor ese
día, reescalando sus pesos para que sumen 1 entre ellas.**

Esto no es un detalle de implementación, es lo que permite que el score
sobreviva a la realidad: una fuente que todavía no existe, otra que se cae tres
días, Pinterest que nunca participa. Sin renormalizar, cada hueco hundiría el
score como si el mercado se hubiera enfriado, cuando lo único que pasó es que
faltó un dato.

- **Una fuente ausente no es una fuente en cero.** `SignalPoint.signals` es
  parcial a propósito. Escribir ceros para rellenar es la forma más fácil de
  romper esto.
- **Pinterest tiene peso pero nunca participa**, porque no se persiste. Su .18
  existe para dejar dicho cuánto valdría el día que se decida; hasta entonces
  se reparte entre las demás al renormalizar.
- Un día sin ninguna fuente utilizable da `null`, no cero.
- El desglose por fuente muestra el peso **ya renormalizado**: la columna suma
  100% y los aportes suman el score, o la tabla no explica el número de al lado.
- `sourceCount` va siempre con `sourceTotal`. Nada de "de seis fuentes"
  escrito a mano: el denominador es cuántas hubo ese día.
- El seed trae un `target` de ciclo de vida por tendencia, pero es solo la forma
  de curva que el generador debe producir: la app **siempre** re-deriva.
- Cambiar los pesos o los umbrales debe recalcular el histórico completo sin
  migración. Por eso nada derivado se persiste.

## Origen de las señales: mock vs real

- **Toda señal lleva su origen**, `mock` o `real`.
- **La UI nunca mezcla ambas en una misma serie sin marcarlo.** Si una curva
  tiene 90 días mock y 3 reales, eso se ve; no se dibuja una línea continua que
  insinúe que todo se midió igual.
- La etiqueta de origen la calcula `app/layout.tsx` con `summarizeCatalog()`:
  **"Datos de muestra"** si nada es real, **"Datos parciales"** si hay mezcla, y
  desaparece solo cuando TODO es real. Basta un día mock en una tendencia para
  que el catálogo entero siga siendo mixto.
- En las gráficas, `splitByOrigin()` parte la serie: el tramo mock va atenuado,
  el real a plena intensidad, con una vertical en el corte y la fecha desde la
  que hay dato real. Si toda la serie tiene el mismo origen no se parte nada.
- Hoy `/editorial` es la única ruta con dato real: los titulares vienen por RSS.
  Las tendencias contra las que se cruzan siguen siendo el catálogo de muestra,
  y la página lo dice.
- Ojo: la señal `pinterest` del seed es **mock**, no viene de la API de
  Pinterest. No confundir una cosa con la otra cuando llegue el conector.

## Fuentes externas

Tres reglas, y la primera no es negociable.

### Pinterest: PROHIBIDO persistir

- Los datos de la API de Pinterest **no se guardan nunca**: ni en base de datos,
  ni en archivo, ni en un caché de más de una hora.
- Solo lectura en vivo, con caché efímero de **una hora como máximo**.
- No entran al histórico. No alimentan `signals`. No se snapshotean en el cron.
- Si una tarea futura pide "guardar el histórico de Pinterest", la respuesta es
  que no se puede: hay que decírselo al usuario, no buscarle la vuelta.

### Mercado Libre Trends y Google Trends: sí se persisten

- Son la base del histórico. Se guardan con snapshot diario y origen `real`.
- Mercado Libre Trends es la fuente primaria para México.
- Mercado Libre **sí entra al score**, con peso .20 igual que Google. Decidido
  en la sesión 5; ver la tabla de pesos arriba.

### Rutas de operación

`/api/cron/daily` y `/api/admin/setup` se autorizan con `CRON_SECRET` vía
`lib/auth.ts`, por cabecera `Bearer` o por `?secret=` en la URL. El parámetro
en la URL existe para poder operar desde un navegador sin herramientas, pero
queda en el historial y en los logs: conviene rotar el secreto después de
usarlo así. Ambas rutas son idempotentes y no destruyen nada.

### API de Anthropic: descubrimiento de candidatas

`lib/sources/discovery.ts` manda los titulares del feed a Claude
(`claude-sonnet-5`) y extrae candidatas a tendencia. Reglas:

- **Se filtra ANTES de mandar.** `lib/sources/fashion-filter.ts` descarta
  belleza, celebridades y negocio con reglas baratas. Mandar el lote entero
  cuesta tokens y ensucia la extracción.
- **Las candidatas NO entran al catálogo solas.** Se acumulan en
  `trend_candidates` con su conteo de menciones y su evidencia; promoverlas es
  una decisión humana.
- Una candidata que ya casa con los keywords de una tendencia existente se
  descarta: no es un descubrimiento.
- Una candidata sin evidencia se descarta: el modelo puede alucinar un índice.
- Sin `ANTHROPIC_API_KEY` el paso se salta y queda registrado en `signal_runs`.

### Nunca en el request del usuario

- **Ninguna fuente externa se llama durante un request.** Siempre se sirve
  desde caché o base de datos.
- El refresco ocurre fuera del camino del usuario: cron, script manual
  (`npm run editorial`) o revalidación en background.
- Una fuente caída nunca tumba la página: su error se guarda en el estado y la
  UI lo muestra ("sin respuesta"). Si ninguna responde, se conserva lo último
  bueno en vez de vaciar el feed.

## Contenido curado

Lo que se edita a mano vive en `content/` y se lee con `fs` **durante el build**.
Las páginas que lo consumen se prerenderizan, así que cambiar un archivo de
`content/` requiere un nuevo deploy. El contenido pasa por git a propósito.

```
content/ediciones/YYYY-MM-DD.json   Sobreescribe la edición de ese domingo
content/fashion-week/<slug>.json    Una colección de pasarela
content/ocasiones/<slug>.json       Una ocasión
content/paleta/<trend-id>.json      Con qué combina ese color
```

**Trampa conocida:** un componente cliente no puede importar un *valor* desde un
módulo que lea `fs` — arrastra `node:fs` al bundle del navegador y Turbopack
aborta el build con un error poco obvio. Por eso los estilos por ocasión viven
en `lib/ocasiones-accent.ts`, separados de `lib/ocasiones.ts`. Los `import type`
sí son seguros: se borran en compilación.

## Base de datos

- Neon Postgres. `lib/db/schema.sql` es el esquema.
- **No hace falta terminal.** `ensureDatabase()` aplica el esquema y siembra
  solo si `trends` está vacía. Lo llaman dos sitios:
  - `GET /api/admin/setup?secret=$CRON_SECRET` — a mano, desde un navegador.
  - El cron diario, antes de correr las fuentes: un cambio de esquema futuro
    entra solo con la siguiente corrida.
- **El seed nunca pisa datos reales**: si `trends` tiene filas, no se siembra.
- `npm run db:migrate` y `npm run db:seed` siguen existiendo para quien sí
  tenga terminal.
- **Los valores van en `numeric`, nunca en `real`.** float4 no representa 36.8
  exactamente y el round-trip movería los scores en el último decimal. El
  driver devuelve `numeric` como string: hay que parsearlo.
- `migrate()` manda las sentencias una a una; ni Neon ni PGlite aceptan varias
  en un statement preparado.
- `getCatalog()` lee de Postgres y cae al seed si la base no responde. El
  fallback es silencioso pero no invisible: `source` viaja en el resultado.
- Las funciones de `lib/trends.ts` aceptan el catálogo como parámetro con el
  seed por defecto. Así el test de oro sigue siendo síncrono y las páginas le
  pasan el catálogo de la base.

## Tests

- `npm test` corre `node --test` sobre `tests/`. Verde antes de cada commit.
- **El test de oro** (`tests/golden.test.ts`) congela los 25 scores. Solo se
  regenera con `npm run golden` cuando los pesos o los umbrales cambian a
  propósito; hacerlo por cualquier otra razón esconde el problema.
- Los tests de base levantan **PGlite** (Postgres en wasm) y corren el esquema
  y las consultas de verdad, sin red.

## Proceso

- **Build, lint y typecheck verdes** antes de cada commit:
  `npm run build && npm run lint && npx tsc --noEmit`.
- **Un commit por paso**, con mensaje que explique el *por qué*, no el qué.
- **Merge a `main` al final** de cada sesión.
- Verificar en el navegador antes de dar algo por hecho: captura en desktop y en
  mobile (390px), y revisarla.

### Notas de entorno

- El contenedor de desarrollo **no tiene salida a internet** salvo los registries
  de paquetes. Los feeds RSS y los CDN de imágenes no se pueden validar desde
  aquí; se prueban contra fixtures locales (`SR_FEED_*`, `SR_IMAGE_HOSTS`).
- El optimizador de imágenes de Next cachea en `.next/cache/images` por URL. Al
  iterar sobre imágenes en local hay que borrarlo o se sirven las viejas.
- `next dev` genera `CLAUDE.md`/`AGENTS.md` propios de Next. Este CLAUDE.md es
  del proyecto: si Next lo pisa, hay que recuperar este contenido.
