"use client";

import Link from "next/link";
import {
  joinPhrases,
  momentumPhrase,
  scorePhrase,
} from "@/lib/editorial-phrases";
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

  /**
   * Los dos puestos, dichos. Siguen visibles porque el orden combinado no se
   * puede auditar de otra forma —y sin poder auditarlo es un ranking que hay
   * que creerse— pero como texto y no como badge: esto es el modo editorial.
   */
  const ranks = (color: SeasonPaletteData["colors"][number]) => ({
    es: `#${color.scoreRank} por score, #${color.momentumRank} por momentum`,
    en: `#${color.scoreRank} by score, #${color.momentumRank} by momentum`,
  });

  return (
    <section>
      <h2 className="font-serif text-3xl tracking-tight text-ink">
        {t("season.title")}
      </h2>
      <p className="mt-1 text-xs text-muted">{t("season.basis")}</p>

      {/* El líder es una declaración: ocupa un campo entero. */}
      <div
        className="mt-6 flex min-h-64 flex-col justify-end rounded-sm p-6 sm:min-h-80 sm:p-10"
        style={{ backgroundColor: lider.hex }}
      >
        <span
          className={`tabular text-[11px] tracking-[0.12em] uppercase ${
            lider.dark ? "text-white/75" : "text-ink/55"
          }`}
        >
          {t("season.leader")} · {lider.hex}
        </span>
        <Link
          href={`/trends/${lider.trendId}`}
          className={`mt-2 font-serif text-5xl leading-none tracking-tight sm:text-6xl ${
            lider.dark ? "text-white" : "text-ink"
          }`}
        >
          {pick(lider.name)}
        </Link>
        <p
          className={`tabular mt-4 max-w-md text-sm leading-relaxed ${
            lider.dark ? "text-white/80" : "text-ink/65"
          }`}
        >
          {pick(
            joinPhrases([
              scorePhrase(lider.score),
              momentumPhrase(lider.momentum7d),
              ranks(lider),
            ]),
          )}
        </p>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {resto.map((color) => (
          <li key={color.trendId}>
            <Link href={`/trends/${color.trendId}`} className="group block">
              <span
                className="block aspect-4/3 w-full rounded-sm"
                style={{ backgroundColor: color.hex }}
              />
              <span className="mt-3 block font-serif text-xl text-ink group-hover:text-lavender-ink">
                {pick(color.name)}
              </span>
              <span className="tabular mt-1 block text-xs leading-relaxed text-muted">
                {pick(
                  joinPhrases([
                    scorePhrase(color.score),
                    momentumPhrase(color.momentum7d),
                  ]),
                )}
              </span>
              <span className="tabular mt-0.5 block text-[11px] text-faint">
                {pick(ranks(color))}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-ink-soft italic">
        {pick(data.line)}
      </p>

      {/* Sin ambigüedad posible: esto describe el presente. */}
      <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-faint">
        {t("season.notForecast")}
      </p>
    </section>
  );
}
