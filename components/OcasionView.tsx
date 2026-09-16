"use client";

import Link from "next/link";
import { Delta } from "@/components/Delta";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { useI18n } from "@/lib/i18n";
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

export function OcasionView({ ocasion }: { ocasion: Ocasion }) {
  const { t, pick, lang } = useI18n();
  const accent = ACCENT_STYLE[ocasion.accent];

  const money = (price: number, currency: "MXN" | "USD") =>
    `${new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: currency === "MXN" ? 0 : 2,
    }).format(price)} ${currency}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/ocasiones"
        className="text-xs text-muted transition-colors hover:text-lavender-ink"
      >
        ← {t("oc.back")}
      </Link>

      <header className="mt-4 border-b border-line pb-8">
        <span className={`block h-1 w-16 rounded-full ${accent.bar}`} aria-hidden />
        <h1 className="mt-4 font-serif text-5xl tracking-tight text-ink">
          {pick(ocasion.name)}
        </h1>
        <p className="mt-2 font-serif text-2xl text-ink-soft italic">
          {pick(ocasion.tagline)}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {pick(ocasion.intro)}
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
          {t("oc.trends")}
        </h2>
        <ul className="mt-4 space-y-3">
          {ocasion.trends.map(({ summary, note }) => (
            <li
              key={summary.id}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Link
                  href={`/trends/${summary.id}`}
                  className="font-serif text-xl text-ink hover:text-lavender-ink"
                >
                  {pick(summary.name)}
                </Link>
                <div className="flex items-center gap-3">
                  <LifecycleBadge lifecycle={summary.lifecycle} />
                  <span className="tabular text-sm font-medium text-ink">
                    {summary.score.toFixed(1)}
                  </span>
                  <span className="text-sm">
                    <Delta value={summary.momentum7d} />
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {pick(note)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
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
  );
}
