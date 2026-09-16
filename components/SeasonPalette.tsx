"use client";

import Link from "next/link";
import { Delta } from "@/components/Delta";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { useI18n } from "@/lib/i18n";
import type { SeasonPalette as SeasonPaletteData } from "@/lib/paleta";

/**
 * Los cinco colores de la temporada, ordenados por score y momentum.
 *
 * Los dos puestos van visibles junto a cada color: el orden combinado no se
 * puede auditar de otra forma, y sin poder auditarlo es un ranking que hay que
 * creerse.
 */
export function SeasonPalette({ data }: { data: SeasonPaletteData }) {
  const { t, pick } = useI18n();
  const [lider, ...resto] = data.colors;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl tracking-tight text-ink">
          {t("season.title")}
        </h2>
        <p className="text-xs text-muted">{t("season.basis")}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        {/* El líder ocupa un bloque grande: un color de temporada es una
            declaración, no una fila más de una tabla. */}
        <div
          className="flex min-h-40 flex-col justify-between p-5"
          style={{ backgroundColor: lider.hex }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span
              className={`text-[11px] font-medium tracking-[0.12em] uppercase ${
                lider.dark ? "text-white/80" : "text-ink/60"
              }`}
            >
              {t("season.leader")}
            </span>
            <span
              className={`tabular text-[11px] ${
                lider.dark ? "text-white/70" : "text-ink/50"
              }`}
            >
              {lider.hex}
            </span>
          </div>

          <div>
            <Link
              href={`/trends/${lider.trendId}`}
              className={`font-serif text-4xl tracking-tight ${
                lider.dark ? "text-white" : "text-ink"
              }`}
            >
              {pick(lider.name)}
            </Link>
            <p
              className={`tabular mt-2 text-xs ${
                lider.dark ? "text-white/70" : "text-ink/60"
              }`}
            >
              {t("common.score")} {lider.score.toFixed(1)} · #{lider.scoreRank}
              {" · "}
              {t("common.momentum7d")} {lider.momentum7d > 0 ? "+" : ""}
              {lider.momentum7d.toFixed(1)} · #{lider.momentumRank}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-line bg-surface">
          {resto.map((color, index) => (
            <li key={color.trendId}>
              <Link
                href={`/trends/${color.trendId}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm hover:bg-lavender-soft/40"
              >
                <span className="tabular w-4 shrink-0 text-faint">
                  {index + 2}
                </span>
                <span
                  className="h-7 w-7 shrink-0 rounded-md border border-line"
                  style={{ backgroundColor: color.hex }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {pick(color.name)}
                </span>
                <LifecycleBadge lifecycle={color.lifecycle} />
                <span className="tabular w-12 shrink-0 text-right text-ink">
                  {color.score.toFixed(1)}
                </span>
                <span className="w-14 shrink-0 text-right">
                  <Delta value={color.momentum7d} />
                </span>
                <span className="tabular hidden w-16 shrink-0 text-right text-[11px] text-faint sm:block">
                  #{color.scoreRank} · #{color.momentumRank}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 font-serif text-lg leading-snug text-ink-soft italic">
        {pick(data.line)}
      </p>

      {/* Sin ambigüedad posible: esto describe el presente. */}
      <p className="mt-3 rounded-lg border border-quiet bg-quiet-soft px-3 py-2 text-[11px] leading-relaxed text-quiet-ink">
        {t("season.notForecast")}
      </p>
    </section>
  );
}
