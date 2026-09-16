"use client";

import Link from "next/link";
import { Delta } from "@/components/Delta";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { PageLede } from "@/components/PageLede";
import { ShoppingTiers } from "@/components/ShoppingTiers";
import { useI18n } from "@/lib/i18n";
import type { Insight } from "@/lib/insights";
import type { Edicion, EdicionPick, EdicionSummary } from "@/lib/edicion";

function useDates() {
  const { lang } = useI18n();
  const locale = lang === "es" ? "es-MX" : "en-US";
  const format = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, {
      ...opts,
      timeZone: "UTC",
    });
  return {
    long: (iso: string) =>
      format(iso, { day: "numeric", month: "long", year: "numeric" }),
    // El archivo es una lista densa: la fecha larga se partía en tres líneas.
    short: (iso: string) =>
      format(iso, { day: "numeric", month: "short", year: "numeric" }),
  };
}

function Pick({ pick, index }: { pick: EdicionPick; index: number }) {
  const { t, pick: tr } = useI18n();
  const { summary } = pick;

  return (
    <article className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* El número ordena la lectura: es una edición, no una tabla. */}
          <p className="eyebrow">
            {t("edicion.pick")} {String(index + 1).padStart(2, "0")} ·{" "}
            {t(`category.${summary.category}`)} · {summary.season}
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
            <Link
              href={`/trends/${summary.id}`}
              className="hover:text-lavender-ink"
            >
              {tr(summary.name)}
            </Link>
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {tr(pick.description)}
          </p>
        </div>
        <div className="text-right">
          <span className="tabular block font-serif text-4xl leading-none text-ink">
            {summary.score.toFixed(1)}
          </span>
          <span className="mt-2 block">
            <LifecycleBadge lifecycle={summary.lifecycle} />
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-cream bg-cream-soft px-4 py-3">
        <p className="eyebrow text-cream-ink">{t("edicion.whyNow")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">
          {tr(pick.reason)}
        </p>
        {pick.note ? (
          <p className="mt-2 border-t border-cream pt-2 text-sm leading-relaxed text-ink-soft italic">
            {tr(pick.note)}
          </p>
        ) : null}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        <div className="flex items-baseline gap-2">
          <dt className="eyebrow">{t("common.momentum7d")}</dt>
          <dd className="text-sm">
            <Delta value={summary.momentum7d} />
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="eyebrow">{t("common.yoy")}</dt>
          <dd className="text-sm">
            <Delta value={summary.yoyPct} suffix="%" decimals={0} />
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="eyebrow">{t("edicion.risingDays")}</dt>
          <dd className="tabular text-sm text-ink">{pick.risingDays}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="eyebrow">{t("common.sources")}</dt>
          <dd className="tabular text-sm text-ink">{summary.sourceCount}/{summary.sourceTotal}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <ShoppingTiers shopping={pick.shopping} />
      </div>
    </article>
  );
}

export function EdicionView({
  edicion,
  archive,
  isCurrent,
  insight,
}: {
  edicion: Edicion;
  archive: EdicionSummary[];
  isCurrent: boolean;
  insight: Insight;
}) {
  const { t, pick: tr } = useI18n();
  const dates = useDates();

  return (
    <div className="mx-auto max-w-4xl">
      <PageLede
        titleKey="edicion.title"
        subtitleKey="edicion.subtitle"
        insight={insight}
      />

      <header className="flex flex-wrap items-center justify-between gap-3 border-y border-line-strong py-4">
        <div>
          <p className="eyebrow">
            {isCurrent ? t("edicion.current") : t("edicion.of")}
          </p>
          <p className="mt-1 font-serif text-2xl text-ink">
            {dates.long(edicion.date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] tracking-[0.08em] uppercase ${
              edicion.curated
                ? "border-lavender bg-lavender-soft text-lavender-ink"
                : "border-line-strong text-muted"
            }`}
          >
            {edicion.curated ? t("edicion.curated") : t("edicion.auto")}
          </span>
          {isCurrent ? null : (
            <Link
              href="/edicion"
              className="text-xs text-lavender-ink hover:underline"
            >
              {t("edicion.backToCurrent")} →
            </Link>
          )}
        </div>
      </header>

      <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-ink-soft">
        {tr(edicion.intro)}
      </p>

      <div className="mt-10">
        {edicion.picks.map((pick, index) => (
          <Pick key={pick.summary.id} pick={pick} index={index} />
        ))}
      </div>

      <section className="mt-16 border-t border-line-strong pt-8">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
          {t("edicion.archive")}
        </h2>
        <p className="mt-1 text-xs text-muted">{t("edicion.archiveNote")}</p>
        <ul className="mt-4 divide-y divide-line">
          {archive.map((entry) => {
            const active = entry.date === edicion.date;
            return (
              <li key={entry.date}>
                <Link
                  href={`/edicion/${entry.date}`}
                  className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-sm ${
                    active ? "text-ink" : "text-ink-soft hover:text-lavender-ink"
                  }`}
                >
                  <span className="tabular w-32 shrink-0 font-medium">
                    {dates.short(entry.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {entry.names.map((name) => tr(name)).join(" · ")}
                  </span>
                  {entry.curated ? (
                    <span className="shrink-0 text-[11px] tracking-[0.08em] text-lavender-ink uppercase">
                      {t("edicion.curated")}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
