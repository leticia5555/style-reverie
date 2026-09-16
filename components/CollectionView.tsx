"use client";

import Link from "next/link";
import { PaletteStrip } from "@/components/CollectionCard";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { useI18n } from "@/lib/i18n";
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

export function CollectionView({ collection }: { collection: Collection }) {
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

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/fashion-week"
        className="text-xs text-muted transition-colors hover:text-lavender-ink"
      >
        ← {t("fw.back")}
      </Link>

      <header className="mt-4 border-b border-line pb-8">
        <p className="eyebrow">
          {collection.season} · {collection.city} · {showDate}
        </p>
        <h1 className="mt-2 font-serif text-5xl tracking-tight text-ink">
          {collection.house}
        </h1>
        <p className="mt-2 font-serif text-2xl text-lavender-ink italic">
          {pick(collection.headline)}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {pick(collection.summary)}
        </p>
        <p className="mt-4 text-xs text-muted">
          <span className="eyebrow">{t("fw.designer")}</span>{" "}
          {collection.designer}
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
          {t("fw.looks")}
        </h2>
        <ol className="mt-4 space-y-6">
          {collection.looks.map((look) => (
            <li key={look.number} className="flex gap-5">
              {/* El número de salida es como se cita un look en la prensa. */}
              <span className="tabular w-12 shrink-0 pt-1 text-right font-serif text-2xl text-faint">
                {String(look.number).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 border-l border-line pl-5">
                <h3 className="font-serif text-xl text-ink">
                  {pick(look.title)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
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
          ))}
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
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface px-4">
            {collection.trends
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((trend) => (
                <li key={trend.id}>
                  <Link
                    href={`/trends/${trend.id}`}
                    className="flex flex-wrap items-center gap-3 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {pick(trend.name)}
                    </span>
                    <LifecycleBadge lifecycle={trend.lifecycle} />
                    <span className="tabular w-12 text-right text-ink">
                      {trend.score.toFixed(1)}
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
  );
}
