"use client";

import { CollectionCard } from "@/components/CollectionCard";
import { TrendPhoto } from "@/components/TrendPhoto";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import type { Insight } from "@/lib/insights";
import type { Collection } from "@/lib/fashion-week";

export function FashionWeekIndex({
  collections,
  insight,
  images = {},
}: {
  collections: Collection[];
  insight: Insight;
  /** slug de colección → foto prestada de una de sus tendencias. */
  images?: Record<string, TrendImage>;
}) {
  const { t, pick } = useI18n();

  /** Agrupadas por temporada, la más reciente primero. */
  const seasons = [...new Set(collections.map((c) => c.season))].sort((a, b) =>
    b.localeCompare(a),
  );
  const lead = collections[0];

  return (
    <div>
      <header className="-mx-5 md:-mx-8">
        <div className="relative h-[52vh] min-h-[340px] w-full overflow-hidden bg-quiet-soft">
          {lead ? (
            images[lead.slug] ? (
              <TrendPhoto
                image={images[lead.slug]}
                name={{ es: lead.house, en: lead.house }}
                sizes="100vw"
                priority
              />
            ) : (
              <span className="flex h-full w-full">
                {lead.palette.map((color) => (
                  <span
                    key={color.hex}
                    className="flex-1"
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </span>
            )
          ) : null}
        </div>

        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <h1 className="mt-8 font-serif text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {t("fw.title")}
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-xl leading-relaxed text-ink-soft">
            {t("fw.subtitle")}
          </p>
          {insight.line ? (
            <p className="mt-4 max-w-2xl text-sm text-muted">
              {pick(insight.line)}
            </p>
          ) : null}
          <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-faint">
            {t("fw.curated")}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl">
        {seasons.map((season) => {
          const ofSeason = collections.filter((c) => c.season === season);
          return (
            <section key={season} className="mt-20">
              <h2 className="eyebrow border-b border-line pb-3">
                {season} · {ofSeason.length} {t("fw.collections")}
              </h2>
              {/* Asimétrica: la primera de cada temporada ocupa el ancho. */}
              <ul className="mt-8 grid gap-12 sm:grid-cols-2 sm:gap-x-10">
                {ofSeason.map((collection, index) => (
                  <CollectionCard
                    key={collection.slug}
                    collection={collection}
                    image={images[collection.slug] ?? null}
                    wide={index === 0}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
