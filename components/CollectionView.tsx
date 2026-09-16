"use client";

import Link from "next/link";
import { PaletteStrip } from "@/components/CollectionCard";
import { TrendPhoto } from "@/components/TrendPhoto";
import {
  joinPhrases,
  momentumPhrase,
  scorePhrase,
} from "@/lib/editorial-phrases";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import type { Collection } from "@/lib/fashion-week";
import type { ShopTier } from "@/lib/types";

const TIER_STYLE: Record<ShopTier, string> = {
  budget: "border-sage bg-sage-soft text-sage-ink",
  mid: "border-lavender bg-lavender-soft text-lavender-ink",
  invest: "border-rose bg-rose-soft text-rose-ink",
};

const TIER_KEY = {
  budget: "detail.budget",
  mid: "detail.mid",
  invest: "detail.invest",
} as const;

export function CollectionView({
  collection,
  images = {},
}: {
  collection: Collection;
  images?: Record<string, TrendImage>;
}) {
  const { t, pick, lang } = useI18n();
  const money = (price: number, currency: "MXN" | "USD") =>
    `${new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: currency === "MXN" ? 0 : 2,
    }).format(price)} ${currency}`;

  const showDate = new Date(`${collection.showDate}T12:00:00Z`).toLocaleDateString(
    lang === "es" ? "es-MX" : "en-US",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );

  /** La portada toma la foto del primer look que tenga una. */
  const coverId = collection.looks
    .flatMap((look) => look.trendIds ?? [])
    .find((id) => images[id]);

  return (
    <div>
      <header className="-mx-5 md:-mx-8">
        <div className="relative h-[52vh] min-h-[340px] w-full overflow-hidden bg-quiet-soft">
          {coverId ? (
            <TrendPhoto
              image={images[coverId]}
              name={{ es: collection.house, en: collection.house }}
              sizes="100vw"
              priority
            />
          ) : (
            <span className="flex h-full w-full">
              {collection.palette.map((color) => (
                <span
                  key={color.hex}
                  className="flex-1"
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </span>
          )}
        </div>
        <div className="mx-auto max-w-4xl px-5 md:px-8">
          <Link
            href="/fashion-week"
            className="mt-8 inline-block text-xs text-muted transition-colors hover:text-lavender-ink"
          >
            ← {t("fw.back")}
          </Link>
          <p className="eyebrow mt-4">
            {collection.season} · {collection.city} · {showDate}
          </p>
          <h1 className="mt-2 font-serif text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {collection.house}
          </h1>
          <p className="mt-3 font-serif text-2xl text-lavender-ink italic">
            {pick(collection.headline)}
          </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {pick(collection.summary)}
        </p>
        <p className="mt-4 text-xs text-muted">
          <span className="eyebrow">{t("fw.designer")}</span>{" "}
          {collection.designer}
        </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl">
      <section className="mt-10">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
          {t("fw.looks")}
        </h2>
        <ol className="mt-8 space-y-14">
          {collection.looks.map((look, index) => {
            const lookImageId = (look.trendIds ?? []).find((id) => images[id]);
            return (
            <li key={look.number} className="grid gap-6 sm:grid-cols-12 sm:gap-8">
              <div
                className={`sm:col-span-5 ${index % 2 === 1 ? "sm:order-2" : ""}`}
              >
                <div className="relative aspect-4/5 w-full overflow-hidden rounded-sm bg-quiet-soft">
                  <TrendPhoto
                    image={lookImageId ? images[lookImageId] : null}
                    name={look.title}
                    sizes="(max-width: 640px) 100vw, 35vw"
                  />
                </div>
              </div>
              <div className={`sm:col-span-7 ${index % 2 === 1 ? "sm:order-1" : ""}`}>
                {/* El número de salida es como se cita un look en la prensa. */}
                <span className="tabular block font-serif text-2xl text-faint">
                  {String(look.number).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-serif text-3xl leading-tight tracking-tight text-ink">
                  {pick(look.title)}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-ink-soft">
                  {pick(look.description)}
                </p>
                {look.trendIds?.length ? (
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {look.trendIds.map((id) => {
                      const trend = collection.trends.find((x) => x.id === id);
                      if (!trend) return null;
                      return (
                        <li key={id}>
                          <Link
                            href={`/trends/${id}`}
                            className="inline-flex items-baseline gap-1.5 rounded-full border border-lavender bg-lavender-soft px-2.5 py-0.5 text-[11px] text-lavender-ink hover:bg-lavender/25"
                          >
                            {pick(trend.name)}
                            <span className="tabular opacity-70">
                              {trend.score.toFixed(0)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
          {t("fw.palette")}
        </h2>
        <div className="mt-4 rounded-xl border border-line bg-surface p-5">
          <PaletteStrip palette={collection.palette} height="h-3" />
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collection.palette.map((color) => (
              <li key={color.hex} className="flex gap-3">
                <span
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-line"
                  style={{ backgroundColor: color.hex }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm text-ink">{pick(color.name)}</p>
                  <p className="tabular text-[11px] tracking-wide text-faint uppercase">
                    {color.hex}
                  </p>
                  {color.note ? (
                    <p className="mt-1 text-xs leading-snug text-muted">
                      {pick(color.note)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {collection.trends.length ? (
        <section className="mt-12">
          <h2 className="font-serif text-2xl tracking-tight text-ink">
            {t("fw.trends")}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {collection.trends
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((trend) => (
                <li key={trend.id}>
                  <Link href={`/trends/${trend.id}`} className="group block">
                    <span className="block font-serif text-2xl text-ink group-hover:text-lavender-ink">
                      {pick(trend.name)}
                    </span>
                    <span className="tabular mt-1 block text-sm text-muted">
                      {pick(
                        joinPhrases([
                          scorePhrase(trend.score),
                          momentumPhrase(trend.momentum7d),
                        ]),
                      )}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl tracking-tight text-ink">
            {t("fw.shop")}
          </h2>
          <p className="text-xs text-muted">{t("fw.shopNote")}</p>
        </div>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {collection.shopping.map((item) => (
            <li
              key={`${item.tier}-${item.retailer}`}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.08em] uppercase ${TIER_STYLE[item.tier]}`}
              >
                {t(TIER_KEY[item.tier])}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 block"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink group-hover:text-lavender-ink">
                    {item.retailer}
                  </span>
                  <span className="tabular text-sm whitespace-nowrap text-ink-soft">
                    {money(item.price, item.currency)}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {pick(item.label)}
                </span>
              </a>
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-soft">
                {pick(item.rationale)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
    </div>
  );
}
