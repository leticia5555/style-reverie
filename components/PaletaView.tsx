"use client";

import Link from "next/link";
import { Delta } from "@/components/Delta";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { PageLede } from "@/components/PageLede";
import { Sparkline } from "@/components/Sparkline";
import { useI18n } from "@/lib/i18n";
import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import type { Insight } from "@/lib/insights";
import type { PaletteEntry } from "@/lib/paleta";

export function PaletaView({
  entries,
  insight,
}: {
  entries: PaletteEntry[];
  insight: Insight;
}) {
  const { t, pick } = useI18n();

  return (
    <div className="mx-auto max-w-5xl">
      <PageLede
        titleKey="paleta.title"
        subtitleKey="paleta.subtitle"
        insight={insight}
      />

      {/* Tira continua: la temporada entera en una línea, ordenada por score. */}
      <section>
        <p className="eyebrow">{t("paleta.strip")}</p>
        <span className="mt-2 flex h-14 w-full overflow-hidden rounded-xl border border-line">
          {entries.map((entry) => (
            <span
              key={entry.summary.id}
              className="flex-1"
              style={{ backgroundColor: entry.swatch }}
              title={`${pick(entry.summary.name)} · ${entry.swatch}`}
            />
          ))}
        </span>
      </section>

      <ul className="mt-8 space-y-4">
        {entries.map((entry) => (
          <li
            key={entry.summary.id}
            className="overflow-hidden rounded-xl border border-line bg-surface"
          >
            <div className="grid md:grid-cols-[200px_minmax(0,1fr)]">
              {/* El swatch ocupa un bloque real: un color se juzga por área. */}
              <div
                className="flex min-h-32 flex-col justify-between p-4"
                style={{ backgroundColor: entry.swatch }}
              >
                <span
                  className={`tabular text-[11px] tracking-[0.12em] uppercase ${
                    entry.dark ? "text-white/80" : "text-ink/60"
                  }`}
                >
                  {entry.swatch}
                </span>
                <span
                  className={`font-serif text-3xl leading-none ${
                    entry.dark ? "text-white" : "text-ink"
                  }`}
                >
                  {entry.summary.score.toFixed(1)}
                </span>
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl tracking-tight text-ink">
                      <Link
                        href={`/trends/${entry.summary.id}`}
                        className="hover:text-lavender-ink"
                      >
                        {pick(entry.summary.name)}
                      </Link>
                    </h2>
                    <p className="eyebrow mt-1">{entry.summary.season}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Sparkline
                      values={entry.summary.spark}
                      color={LIFECYCLE_STYLES[entry.summary.lifecycle].hex}
                      width={90}
                      height={26}
                    />
                    <LifecycleBadge lifecycle={entry.summary.lifecycle} />
                  </div>
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                  <div className="flex items-baseline gap-2">
                    <dt className="eyebrow">{t("common.momentum7d")}</dt>
                    <dd className="text-sm">
                      <Delta value={entry.summary.momentum7d} />
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="eyebrow">{t("common.yoy")}</dt>
                    <dd className="text-sm">
                      <Delta
                        value={entry.summary.yoyPct}
                        suffix="%"
                        decimals={0}
                      />
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="eyebrow">{t("common.sources")}</dt>
                    <dd className="tabular text-sm text-ink">
                      {entry.summary.sourceCount}/6
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-line pt-3">
                  <p className="eyebrow">{t("paleta.pairs")}</p>
                  {entry.pairs.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {entry.pairs.map((pair) => (
                        <li key={pair.summary.id}>
                          <Link
                            href={`/trends/${pair.summary.id}`}
                            title={`${t("paleta.correlation")} ${pair.correlation.toFixed(3)}`}
                            className="inline-flex items-baseline gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-lavender hover:bg-lavender-soft hover:text-lavender-ink"
                          >
                            {pick(pair.summary.name)}
                            {/* Tres decimales: a dos, un 0.998 se redondea a
                                1.00 y se lee como correlación perfecta. */}
                            <span className="tabular text-[10px] text-faint">
                              {pair.correlation.toFixed(3)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      {t("paleta.noPairs")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[11px] leading-relaxed text-faint">
        {t("paleta.pairsNote")}
      </p>
    </div>
  );
}
