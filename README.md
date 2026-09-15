# Style Reverie

Terminal de inteligencia de tendencias de moda — "Bloomberg para moda", en versión
editorial y femenina. Cada tendencia cotiza con un score 0–100 derivado de señales
de seis fuentes, su momentum y su ciclo de vida.

**Estado actual: prototipo con datos 100% mock.** Toda la interfaz lleva la etiqueta
visible *Datos de muestra*.

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
npm run seed   # regenera data/trends.seed.json (determinista)
```

Rutas: `/` redirige a `/trending`; cada tendencia vive en `/trends/<id>`.

## Estructura

```
app/
  layout.tsx            Shell: fuentes, provider de idioma, nav lateral
  trending/             Tabla de tendencias con filtros
  trends/[id]/          Ficha de una tendencia
components/             Shell, nav, badges, gráficas
data/trends.seed.json   25 tendencias SS26/FW26 con 90 días de señales
lib/scoring.ts          Score compuesto ponderado por fuente
lib/lifecycle.ts        Ciclo de vida derivado de score + momentum
scripts/generate-seed.ts  Generador del seed (npm run seed)
```

## Idioma

Español por default, toggle ES/EN en el pie de la barra lateral (se guarda en
`localStorage`). Los nombres y descripciones de tendencias vienen con ambos idiomas
en el seed.

## Diseño

Fondo blanco, pasteles sutiles (lavanda, rosa pálido, sage, crema), serif editorial
(Playfair Display) para titulares y sans (Inter) para datos, con cifras tabulares.
Sin dark mode y sin emojis en la interfaz.
