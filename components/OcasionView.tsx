"use client";

import Link from "next/link";
import { TrendPhoto } from "@/components/TrendPhoto";
import {
  joinPhrases,
  momentumPhrase,
  scorePhrase,
} from "@/lib/editorial-phrases";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import { ACCENT_STYLE } from "@/lib/ocasiones-accent";
import type { Ocasion } from "@/lib/ocasiones";
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

export function OcasionView({
  ocasion,
  images = {},
}: {
  ocasion: Ocasion;
  images?: Record<string, TrendImage>;
}) {
  const { t, pick, lang } = useI18n();
  const accent = ACCENT_STYLE[ocasion.accent];

  const money = (price: number, currency: "MXN" | "USD") =>
    `${new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: currency === "MXN" ? 0 : 2,
    }).format(price)} ${currency}`;

  const lead = ocasion.trends.find((trend) => images[trend.summary.id]);

  return (
    <div>
      <header className="-mx-5 md:-mx-8">
        <div className="relative h-[52vh] min-h-[340px] w-full overflow-hidden bg-quiet-soft">
          {lead ? (
            <TrendPhoto
              image={images[lead.summary.id]}
              name={ocasion.name}
              trendId={ocasion.slug}
              sizes="100vw"
              priority
            />
          ) : null}
        </div>

        <div className="mx-auto max-w-4xl px-5 md:px-8">
          <Link
            href="/ocasiones"
            className="mt-8 inline-block text-xs text-muted transition-colors hover:text-lavender-ink"
          >
            ← {t("oc.back")}
          </Link>
          <span
            className={`mt-4 block h-1 w-16 rounded-full ${accent.bar}`}
            aria-hidden
          />
          <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {pick(ocasion.name)}
          </h1>
          <p className="mt-3 font-serif text-2xl text-ink-soft italic">
            {pick(ocasion.tagline)}
          </p>
          <p className="mt-5 max-w-2xl font-serif text-xl leading-relaxed text-ink-soft">
            {pick(ocasion.intro)}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl">

      <section className="mt-20">
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          {t("oc.trends")}
        </h2>
        <ul className="mt-8 space-y-12">
          {ocasion.trends.map(({ summary, note }, index) => (
            <li key={summary.id}>
              <div className="grid gap-6 sm:grid-cols-12 sm:items-start sm:gap-8">
                <div
                  className={`sm:col-span-5 ${index % 2 === 1 ? "sm:order-2" : ""}`}
                >
                  <div className="relative aspect-4/5 w-full overflow-hidden rounded-sm bg-quiet-soft">
                    <TrendPhoto
                      image={images[summary.id] ?? null}
                      name={summary.name}
                      trendId={summary.id}
                      sizes="(max-width: 640px) 100vw, 35vw"
                    />
                  </div>
                </div>
                <div className={`sm:col-span-7 ${index % 2 === 1 ? "sm:order-1" : ""}`}>
                  <h3 className="font-serif text-3xl leading-tight tracking-tight text-ink">
                    <Link
                      href={`/trends/${summary.id}`}
                      className="hover:text-lavender-ink"
                    >
                      {pick(summary.name)}
                    </Link>
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-ink-soft">
                    {pick(note)}
                  </p>
                  <p className="tabular mt-4 border-t border-line pt-3 text-sm leading-relaxed text-muted">
                    {pick(
                      joinPhrases([
                        scorePhrase(summary.score),
                        momentumPhrase(summary.momentum7d),
                      ]),
                    )}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20">
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          {t("oc.pieces")}
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {ocasion.pieces.map((piece) => (
            <li
              key={`${piece.tier}-${piece.retailer}`}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.08em] uppercase ${TIER_STYLE[piece.tier]}`}
              >
                {t(TIER_KEY[piece.tier])}
              </span>
              <a
                href={piece.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 block"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink group-hover:text-lavender-ink">
                    {piece.retailer}
                  </span>
                  <span className="tabular text-sm whitespace-nowrap text-ink-soft">
                    {money(piece.price, piece.currency)}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {pick(piece.label)}
                </span>
              </a>
              {piece.note ? (
                <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-soft">
                  {pick(piece.note)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {ocasion.avoid?.length ? (
        <section className="mt-12">
          <h2 className="font-serif text-2xl tracking-tight text-ink">
            {t("oc.avoid")}
          </h2>
          <ul className="mt-4 space-y-2">
            {ocasion.avoid.map((item) => (
              <li
                key={item.es}
                className="rounded-xl border border-quiet bg-quiet-soft px-4 py-3 text-sm leading-relaxed text-quiet-ink"
              >
                {pick(item)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
    </div>
  );
}
