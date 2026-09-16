"use client";

import Link from "next/link";
import { Delta } from "@/components/Delta";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { MomentumChart } from "@/components/MomentumChart";
import { PinterestSignal } from "@/components/PinterestSignal";
import { ShoppingTiers } from "@/components/ShoppingTiers";
import { SourceBreakdown } from "@/components/SourceBreakdown";
import { StatTile } from "@/components/StatTile";
import { useI18n } from "@/lib/i18n";
import { trendInsight } from "@/lib/insights-trend";
import type { ChartRow } from "@/lib/origin";
import type { TrendDetail } from "@/lib/trends";

export function TrendDetailView({
  detail,
  split,
}: {
  detail: TrendDetail;
  split?: { rows: ChartRow[]; firstRealDate: string } | null;
}) {
  const { t, pick } = useI18n();
  const { summary } = detail;
  const line = trendInsight(summary, detail.forecast);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/trending"
        className="text-xs text-muted transition-colors hover:text-lavender-ink"
      >
        ← {t("detail.back")}
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-6 border-b border-line pb-8">
        <div className="max-w-xl">
          <p className="eyebrow">
            {t(`category.${summary.category}`)} · {summary.season}
          </p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink">
            {pick(summary.name)}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {pick(detail.description)}
          </p>
          {line ? (
            <p className="mt-4 font-serif text-lg leading-snug text-ink italic">
              {pick(line)}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="eyebrow">{t("common.score")}</p>
          <p className="tabular font-serif text-5xl leading-none text-ink">
            {summary.score.toFixed(1)}
          </p>
          <div className="mt-3 flex justify-end">
            <LifecycleBadge lifecycle={summary.lifecycle} size="md" />
          </div>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("common.momentum7d")}>
          <Delta value={summary.momentum7d} />
        </StatTile>
        <StatTile label={t("common.yoy")}>
          <Delta value={summary.yoyPct} suffix="%" decimals={0} />
        </StatTile>
        <StatTile label={t("detail.peak")}>
          <span className="tabular">{detail.high.toFixed(1)}</span>
        </StatTile>
        <StatTile label={t("detail.low")}>
          <span className="tabular">{detail.low.toFixed(1)}</span>
        </StatTile>
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl text-ink">{t("detail.momentum")}</h2>
          <p className="text-xs text-muted">{t("detail.momentumNote")}</p>
        </div>
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <MomentumChart
            series={detail.series}
            lifecycle={summary.lifecycle}
            forecast={detail.forecast}
            split={split}
          />
        </div>
      </section>

      <PinterestSignal trendId={summary.id} />

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl text-ink">
            {t("detail.breakdown")}
          </h2>
          <p className="text-xs text-muted">
            {summary.sourceCount}/{summary.sourceTotal} {t("common.sources")}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted">{t("detail.breakdownNote")}</p>
        <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
          <SourceBreakdown rows={detail.breakdown} score={summary.score} />
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl text-ink">{t("detail.shop")}</h2>
          <p className="text-xs text-muted">{t("detail.shopNote")}</p>
        </div>
        <div className="mt-4">
          <ShoppingTiers shopping={detail.shopping} />
        </div>
      </section>
    </div>
  );
}
