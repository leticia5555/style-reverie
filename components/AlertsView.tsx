"use client";

import Link from "next/link";
import { Delta } from "@/components/Delta";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { PageHeading } from "@/components/PageHeading";
import { Sparkline } from "@/components/Sparkline";
import { useI18n } from "@/lib/i18n";
import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import type { Alert } from "@/lib/trends";
import type { TrendSummary } from "@/lib/types";

function AlertCard({ alert }: { alert: Alert }) {
  const { t, pick } = useI18n();
  const gained = alert.score - alert.scoreAtStart;

  return (
    <li className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-sage">
      <Link href={`/trends/${alert.id}`} className="block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-2xl leading-tight tracking-tight text-ink">
              {pick(alert.name)}
            </h3>
            <p className="eyebrow mt-1">
              {t(`category.${alert.category}`)} · {alert.season}
            </p>
          </div>
          <div className="text-right">
            <span className="tabular block font-serif text-3xl text-ink">
              {alert.score.toFixed(1)}
            </span>
            <span className="mt-1 block">
              <LifecycleBadge lifecycle={alert.lifecycle} />
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <span className="shrink-0">
            <Sparkline
              values={alert.spark}
              color={LIFECYCLE_STYLES[alert.lifecycle].hex}
              width={120}
              height={32}
            />
          </span>
          <p className="text-sm leading-relaxed text-ink-soft">
            {t("alerts.rising")}{" "}
            <strong className="tabular font-medium text-ink">
              {alert.risingDays} {t("alerts.days")}
            </strong>
            , {t("alerts.fromScore")}{" "}
            <span className="tabular">{alert.scoreAtStart.toFixed(1)}</span>{" "}
            <Delta value={gained} className="text-xs" />
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
          <div>
            <dt className="eyebrow">{t("common.momentum7d")}</dt>
            <dd className="mt-0.5 text-sm font-medium">
              <Delta value={alert.momentum7d} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{t("common.yoy")}</dt>
            <dd className="mt-0.5 text-sm">
              <Delta value={alert.yoyPct} suffix="%" decimals={0} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{t("common.sources")}</dt>
            <dd className="tabular mt-0.5 text-sm text-ink">
              {alert.sourceCount}/6
            </dd>
          </div>
        </dl>
      </Link>
    </li>
  );
}

export function AlertsView({
  alerts,
  watchlist,
}: {
  alerts: Alert[];
  watchlist: TrendSummary[];
}) {
  const { t, pick } = useI18n();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading titleKey="alerts.title" subtitleKey="alerts.subtitle" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sage bg-sage-soft px-4 py-3">
        <p className="text-xs text-sage-ink">{t("alerts.rule")}</p>
        <p className="tabular text-xs font-medium text-sage-ink">
          {alerts.length} {t("alerts.count")}
        </p>
      </div>

      {alerts.length ? (
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          {t("alerts.empty")}
        </p>
      )}

      {watchlist.length ? (
        <section className="mt-10">
          <h2 className="font-serif text-xl tracking-tight text-ink">
            {t("alerts.watchlist")}
          </h2>
          <p className="mt-1 text-xs text-muted">{t("alerts.watchlistNote")}</p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface px-4">
            {watchlist.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/trends/${row.id}`}
                  className="flex flex-wrap items-center gap-3 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {pick(row.name)}
                  </span>
                  <span className="eyebrow shrink-0">
                    {t(`category.${row.category}`)}
                  </span>
                  <span className="tabular w-12 shrink-0 text-right text-ink">
                    {row.score.toFixed(1)}
                  </span>
                  <span className="w-14 shrink-0 text-right">
                    <Delta value={row.momentum7d} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
