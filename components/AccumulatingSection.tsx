"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { AccumulatingTrend, Category } from "@/lib/types";
import { MIN_REAL_DAYS } from "@/lib/types";

/**
 * Tendencias promovidas desde /alerts que todavía no tienen con qué derivar
 * nada.
 *
 * Van en su propia sección y no como filas grises de la tabla a propósito: la
 * tabla es una lista ordenada por score, y una fila sin score ahí dentro
 * obliga a inventarle un lugar. Aquí lo único que se promete es lo que hay,
 * cuántos días lleva juntando y cuántos le faltan.
 */
export function AccumulatingSection({ trends }: { trends: AccumulatingTrend[] }) {
  const { t, lang } = useI18n();
  if (!trends.length) return null;

  const fecha = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(
      lang === "es" ? "es-MX" : "en-US",
      { day: "numeric", month: "short", timeZone: "UTC" },
    );

  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl tracking-tight text-ink">
        {t("accumulating.title")}
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-muted">
        {t("accumulating.note")}
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend) => {
          const pct = Math.round((trend.realDays / MIN_REAL_DAYS) * 100);
          return (
            <li
              key={trend.id}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <p className="font-serif text-lg leading-tight text-ink">
                {trend.name[lang]}
              </p>
              <p className="eyebrow mt-1.5">
                {t(`category.${trend.category}` as `category.${Category}`)}
                {" · "}
                {t("accumulating.since")} {fecha(trend.promotedAt)}
              </p>

              <p className="mt-3 inline-block rounded-full bg-lavender-soft px-2 py-0.5 text-[11px] text-lavender-ink">
                {t("accumulating.badge")}
              </p>

              <p className="tabular mt-3 text-sm text-ink-soft">
                {trend.realDays} / {MIN_REAL_DAYS} {t("accumulating.days")}
              </p>
              {/* La barra es la misma cuenta, para verla sin leer el número. */}
              <div
                className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-quiet-soft"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-lavender-ink"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-muted">
                {trend.sources.length
                  ? `${t("accumulating.responding")}: ${trend.sources.length}`
                  : t("accumulating.noSignalYet")}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-faint">
        {t("accumulating.graduates")}{" "}
        <Link href="/alerts" className="underline-offset-2 hover:underline">
          {t("accumulating.fromAlerts")}
        </Link>
      </p>
    </section>
  );
}
