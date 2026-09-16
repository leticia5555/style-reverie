"use client";

import { CollectionCard } from "@/components/CollectionCard";
import { PageHeading } from "@/components/PageHeading";
import { useI18n } from "@/lib/i18n";
import type { Collection } from "@/lib/fashion-week";

export function FashionWeekIndex({
  collections,
}: {
  collections: Collection[];
}) {
  const { t } = useI18n();

  /** Agrupadas por temporada, la más reciente primero. */
  const seasons = [...new Set(collections.map((c) => c.season))].sort((a, b) =>
    b.localeCompare(a),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading titleKey="fw.title" subtitleKey="fw.subtitle" />
      <p className="text-[11px] leading-relaxed text-faint">
        {t("fw.curated")}
      </p>

      {seasons.map((season) => (
        <section key={season} className="mt-8">
          <h2 className="eyebrow border-b border-line pb-2">
            {season} · {collections.filter((c) => c.season === season).length}{" "}
            {t("fw.collections")}
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {collections
              .filter((collection) => collection.season === season)
              .map((collection) => (
                <CollectionCard key={collection.slug} collection={collection} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
