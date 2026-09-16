"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompareChart, COMPARE_COLORS } from "@/components/CompareChart";
import { Delta } from "@/components/Delta";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { PageLede } from "@/components/PageLede";
import { TrendPicker, type PickerOption } from "@/components/TrendPicker";
import { useI18n } from "@/lib/i18n";
import type { Insight } from "@/lib/insights";
import type { CompareSide, Comparison } from "@/lib/trends";
import { SOURCES } from "@/lib/types";

function SideCard({ side, accent }: { side: CompareSide; accent: string }) {
  const { t, pick } = useI18n();
  const { summary } = side;

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <span
        className="block h-0.5 w-10 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <h2 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-ink">
        {pick(summary.name)}
      </h2>
      <p className="eyebrow mt-1">
        {t(`category.${summary.category}`)} · {summary.season}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        {pick(side.description)}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="tabular font-serif text-4xl text-ink">
          {summary.score.toFixed(1)}
        </span>
        <LifecycleBadge lifecycle={summary.lifecycle} size="md" />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <div>
          <dt className="eyebrow">{t("common.momentum7d")}</dt>
          <dd className="mt-0.5 text-sm">
            <Delta value={summary.momentum7d} />
          </dd>
        </div>
        <div>
          <dt className="eyebrow">{t("common.yoy")}</dt>
          <dd className="mt-0.5 text-sm">
            <Delta value={summary.yoyPct} suffix="%" decimals={0} />
          </dd>
        </div>
        <div>
          <dt className="eyebrow">{t("common.sources")}</dt>
          <dd className="tabular mt-0.5 text-sm text-ink">
            {summary.sourceCount}/{summary.sourceTotal}
          </dd>
        </div>
      </dl>

      <Link
        href={`/trends/${summary.id}`}
        className="mt-4 inline-block text-xs text-lavender-ink hover:underline"
      >
        {t("compare.openDetail")} →
      </Link>
    </div>
  );
}

/** Barras espejo: A crece a la izquierda del eje y B a la derecha. */
function SignalRows({ a, b }: { a: CompareSide; b: CompareSide }) {
  const { t } = useI18n();
  const byKeyA = new Map(a.breakdown.map((row) => [row.source, row.value]));
  const byKeyB = new Map(b.breakdown.map((row) => [row.source, row.value]));

  return (
    <ul className="space-y-3">
      {SOURCES.map((source) => {
        const valueA = byKeyA.get(source) ?? 0;
        const valueB = byKeyB.get(source) ?? 0;
        const gap = valueA - valueB;

        return (
          <li key={source}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="tabular w-12 text-right font-medium text-ink">
                {valueA.toFixed(0)}
              </span>
              <span className="flex-1 text-center text-muted">
                {t(`source.${source}`)}
              </span>
              <span className="tabular w-12 font-medium text-ink">
                {valueB.toFixed(0)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="flex h-1.5 flex-1 justify-end rounded-full bg-quiet-soft">
                <span
                  className="block h-1.5 rounded-full"
                  style={{
                    width: `${valueA}%`,
                    backgroundColor: COMPARE_COLORS.a,
                  }}
                />
              </span>
              <span className="w-px shrink-0 self-stretch bg-line-strong" aria-hidden />
              <span className="flex h-1.5 flex-1 rounded-full bg-quiet-soft">
                <span
                  className="block h-1.5 rounded-full"
                  style={{
                    width: `${valueB}%`,
                    backgroundColor: COMPARE_COLORS.b,
                  }}
                />
              </span>
            </div>
            <p className="mt-1 text-center text-[11px] text-faint">
              {t("compare.gap")} <Delta value={gap} decimals={1} />
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function CompareView({
  comparison,
  options,
  insight,
}: {
  comparison: Comparison;
  options: PickerOption[];
  insight: Insight;
}) {
  const { t, pick } = useI18n();
  const router = useRouter();
  const { a, b } = comparison;

  const go = (nextA: string, nextB: string) =>
    router.replace(`/compare?a=${nextA}&b=${nextB}`, { scroll: false });

  return (
    <div className="mx-auto max-w-6xl">
      <PageLede
        titleKey="compare.title"
        subtitleKey="compare.subtitle"
        insight={insight}
      />

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="grid items-end gap-4 md:grid-cols-[1fr_auto_1fr]">
          <TrendPicker
            label={t("compare.trendA")}
            value={a.summary.id}
            options={options}
            accent={COMPARE_COLORS.a}
            onChange={(id) => go(id, b.summary.id)}
          />
          <button
            type="button"
            onClick={() => go(b.summary.id, a.summary.id)}
            title={t("compare.swap")}
            aria-label={t("compare.swap")}
            className="justify-self-center rounded-lg border border-line-strong px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-quiet-soft"
          >
            ⇄
          </button>
          <TrendPicker
            label={t("compare.trendB")}
            value={b.summary.id}
            options={options}
            accent={COMPARE_COLORS.b}
            onChange={(id) => go(a.summary.id, id)}
          />
        </div>
        {a.summary.id === b.summary.id ? (
          <p className="mt-3 text-xs text-rose-ink">{t("compare.sameTrend")}</p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SideCard side={a} accent={COMPARE_COLORS.a} />
        <SideCard side={b} accent={COMPARE_COLORS.b} />
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
          {t("compare.series")}
        </h2>
        <div className="mt-3 rounded-xl border border-line bg-surface p-4">
          <CompareChart
            series={comparison.series}
            nameA={pick(a.summary.name)}
            nameB={pick(b.summary.name)}
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl tracking-tight text-ink">
            {t("compare.signals")}
          </h2>
          <p className="text-xs text-muted">{t("compare.signalsNote")}</p>
        </div>
        <div className="mt-3 rounded-xl border border-line bg-surface p-5">
          <SignalRows a={a} b={b} />
        </div>
      </section>
    </div>
  );
}
