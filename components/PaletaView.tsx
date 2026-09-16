"use client";

import Link from "next/link";
import { SeasonPalette } from "@/components/SeasonPalette";
import {
  joinPhrases,
  momentumPhrase,
  scorePhrase,
  yoyPhrase,
} from "@/lib/editorial-phrases";
import { useI18n } from "@/lib/i18n";
import type { Insight } from "@/lib/insights";
import type { PaletteEntry, SeasonPalette as SeasonPaletteData } from "@/lib/paleta";

/**
 * Modo editorial. Aquí la imagen que manda es el propio color: un color se
 * juzga por área, así que cada uno ocupa un campo grande y no una muestra.
 *
 * La retícula alterna: campos que ocupan toda la fila y campos a media, con
 * el texto al lado. Una cuadrícula de tarjetas iguales convierte la paleta en
 * un catálogo de pintura, que es lo contrario de lo que hace una revista.
 */
function ColorBlock({
  entry,
  index,
}: {
  entry: PaletteEntry;
  index: number;
}) {
  const { t, pick } = useI18n();
  const wide = index % 3 === 0;
  const flipped = index % 2 === 1;

  const numbers = joinPhrases([
    scorePhrase(entry.summary.score),
    momentumPhrase(entry.summary.momentum7d),
    yoyPhrase(entry.summary.yoyPct),
  ]);

  return (
    <article className={wide ? "sm:col-span-2" : ""}>
      <div
        className={`grid gap-6 ${wide ? "sm:grid-cols-2 sm:items-center sm:gap-10" : ""}`}
      >
        <div
          className={`relative w-full overflow-hidden rounded-sm ${
            wide ? "aspect-3/2" : "aspect-4/5"
          } ${flipped && wide ? "sm:order-2" : ""}`}
          style={{ backgroundColor: entry.swatch }}
        >
          <span
            className={`tabular absolute top-4 left-4 text-[11px] tracking-[0.12em] uppercase ${
              entry.dark ? "text-white/80" : "text-ink/60"
            }`}
          >
            {entry.swatch}
          </span>
        </div>

        <div className={flipped && wide ? "sm:order-1" : ""}>
          <p className="eyebrow">
            {t(`category.${entry.summary.category}`)} · {entry.summary.season}
          </p>
          <h2
            className={`mt-2 font-serif leading-[1.05] tracking-tight text-ink ${
              wide ? "text-4xl sm:text-5xl" : "text-3xl"
            }`}
          >
            <Link
              href={`/trends/${entry.summary.id}`}
              className="hover:text-lavender-ink"
            >
              {pick(entry.summary.name)}
            </Link>
          </h2>

          <p className="tabular mt-4 text-sm leading-relaxed text-ink-soft">
            {pick(numbers)}
          </p>

          <div className="mt-5 border-t border-line pt-4">
            <p className="eyebrow">{t("paleta.pairs")}</p>
            {entry.pairs.length ? (
              <ul className="mt-2 space-y-3">
                {entry.pairs.map((pair) => (
                  <li key={pair.summary.id}>
                    <Link href={`/trends/${pair.summary.id}`} className="group block">
                      <span className="font-serif text-lg text-ink group-hover:text-lavender-ink">
                        {pick(pair.summary.name)}
                      </span>
                      {pair.note ? (
                        <span className="mt-1 block text-sm leading-relaxed text-muted">
                          {pick(pair.note)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {entry.uncurated ? t("paleta.uncurated") : t("paleta.noPairs")}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function PaletaView({
  entries,
  insight,
  season,
}: {
  entries: PaletteEntry[];
  insight: Insight;
  season: SeasonPaletteData | null;
}) {
  const { t, pick } = useI18n();
  const lead = entries[0];

  return (
    <div>
      {/* Portada: el color de arriba a sangre, y el titular encima. */}
      <header className="-mx-5 md:-mx-8">
        <div
          className="h-[46vh] min-h-[300px] w-full"
          style={{ backgroundColor: lead?.swatch ?? "var(--color-quiet-soft)" }}
        />
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <h1 className="mt-8 font-serif text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {t("paleta.title")}
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-xl leading-relaxed text-ink-soft">
            {t("paleta.subtitle")}
          </p>
          {insight.line ? (
            <p className="mt-4 max-w-2xl text-sm text-muted">
              {pick(insight.line)}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-5xl">
        {season ? (
          <div className="mt-14">
            <SeasonPalette data={season} />
          </div>
        ) : null}

        {/* La temporada entera en una línea, ordenada por score. */}
        <section className="mt-14">
          <p className="eyebrow">{t("paleta.strip")}</p>
          <span className="mt-3 flex h-20 w-full overflow-hidden rounded-sm">
            {entries.map((entry) => (
              <span
                key={entry.summary.id}
                className="flex-1"
                style={{ backgroundColor: entry.swatch }}
                title={`${pick(entry.summary.name)} · ${entry.swatch}`}
              />
            ))}
          </span>
        </section>

        <div className="mt-16 grid gap-16 sm:grid-cols-2 sm:gap-x-10">
          {entries.map((entry, index) => (
            <ColorBlock key={entry.summary.id} entry={entry} index={index} />
          ))}
        </div>

        <p className="mt-16 text-[11px] leading-relaxed text-faint">
          {t("paleta.pairsNote")}
        </p>
      </div>
    </div>
  );
}
