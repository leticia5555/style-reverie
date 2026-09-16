"use client";

import Link from "next/link";
import { ShoppingTiers } from "@/components/ShoppingTiers";
import { TrendPhoto } from "@/components/TrendPhoto";
import {
  joinPhrases,
  momentumPhrase,
  risingPhrase,
  scorePhrase,
  sourcesPhrase,
  yoyPhrase,
} from "@/lib/editorial-phrases";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import type { Insight } from "@/lib/insights";
import type { ArchiveEntry } from "@/lib/edicion-archive";
import type { Edicion, EdicionPick } from "@/lib/edicion";

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

/**
 * Una de las cinco prendas de la edición.
 *
 * Bloque grande con foto, no una fila. La foto y el texto se alternan de lado
 * y la columna de la foto es más ancha que la del texto: una retícula pareja
 * de cinco bloques iguales vuelve a ser una tabla con fotos, que es justo lo
 * que este modo no es.
 *
 * Los números van dentro de una frase —"subiendo 3.9 puntos esta semana"— en
 * vez de en badges sueltos. La misma información, leída y no descifrada.
 */
function Pick({
  pick,
  index,
  image,
}: {
  pick: EdicionPick;
  index: number;
  image: TrendImage | null;
}) {
  const { t, pick: tr } = useI18n();
  const { summary } = pick;
  const flipped = index % 2 === 1;

  const numbers = joinPhrases([
    scorePhrase(summary.score),
    momentumPhrase(summary.momentum7d),
    yoyPhrase(summary.yoyPct),
  ]);
  const support = joinPhrases([
    risingPhrase(pick.risingDays),
    sourcesPhrase(summary.sourceCount, summary.sourceTotal),
  ]);

  return (
    <article className="border-t border-line pt-14 first:border-t-0 first:pt-0">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
        <div
          className={`lg:col-span-7 ${flipped ? "lg:order-2 lg:col-start-6" : ""}`}
        >
          {/* 4:5, el formato de la foto de moda: vertical sin llegar a tira. */}
          <div className="relative aspect-4/5 w-full overflow-hidden rounded-sm bg-quiet-soft sm:aspect-3/2 lg:aspect-4/5">
            <TrendPhoto
              image={image}
              name={summary.name}
              category={summary.category}
                        swatch={summary.swatch}
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority={index === 0}
            />
          </div>
        </div>

        <div className={`lg:col-span-5 ${flipped ? "lg:order-1" : ""}`}>
          <p className="eyebrow">
            {t("edicion.pick")} {String(index + 1).padStart(2, "0")} ·{" "}
            {t(`category.${summary.category}`)}
          </p>
          <h2 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">
            <Link
              href={`/trends/${summary.id}`}
              className="hover:text-lavender-ink"
            >
              {tr(summary.name)}
            </Link>
          </h2>

          <p className="mt-5 text-base leading-relaxed text-ink-soft">
            {tr(pick.description)}
          </p>

          <p className="mt-5 font-serif text-lg leading-relaxed text-ink">
            {tr(pick.reason)}
          </p>
          {pick.note ? (
            <p className="mt-3 text-sm leading-relaxed text-muted italic">
              {tr(pick.note)}
            </p>
          ) : null}

          <p className="tabular mt-6 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
            {tr(numbers)} {tr(support)}
          </p>

          <div className="mt-6">
            <ShoppingTiers shopping={pick.shopping} layout="editorial" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function EdicionView({
  edicion,
  archive,
  isCurrent,
  insight,
  images = {},
}: {
  edicion: Edicion;
  archive: ArchiveEntry[];
  isCurrent: boolean;
  insight: Insight;
  images?: Record<string, TrendImage>;
}) {
  const { t, pick: tr } = useI18n();
  const dates = useDates();

  const cover = edicion.picks[0];
  const coverImage = cover ? (images[cover.summary.id] ?? null) : null;

  return (
    <div>
      {/*
        Portada: una imagen que manda y un titular grande. Sale a sangre por
        los lados —de ahí los márgenes negativos— porque el contenedor de la
        app tiene padding y una portada con margen blanco alrededor no es una
        portada.
      */}
      <header className="-mx-5 md:-mx-8">
        <div className="relative h-[58vh] min-h-[380px] w-full overflow-hidden bg-quiet-soft">
          {cover ? (
            <TrendPhoto
              image={coverImage}
              name={cover.summary.name}
              category={cover.summary.category}
                        swatch={cover.summary.swatch}
              sizes="100vw"
              priority
            />
          ) : null}
        </div>

        <div className="mx-auto max-w-4xl px-5 md:px-8">
          <p className="eyebrow mt-8">
            {isCurrent ? t("edicion.current") : t("edicion.of")}
            {" · "}
            {edicion.curated ? t("edicion.curated") : t("edicion.auto")}
          </p>
          <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {dates.long(edicion.date)}
          </h1>
          <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-ink-soft sm:text-2xl">
            {tr(edicion.intro)}
          </p>
          {insight.line ? (
            <p className="mt-4 max-w-2xl text-sm text-muted">
              {tr(insight.line)}
            </p>
          ) : null}
          {isCurrent ? null : (
            <Link
              href="/edicion"
              className="mt-4 inline-block text-xs text-lavender-ink hover:underline"
            >
              {t("edicion.backToCurrent")} →
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto mt-20 max-w-5xl space-y-14">
        {edicion.picks.map((pick, index) => (
          <Pick
            key={pick.summary.id}
            pick={pick}
            index={index}
            image={images[pick.summary.id] ?? null}
          />
        ))}
      </div>

      <section className="mx-auto mt-24 max-w-4xl border-t border-line-strong pt-8">
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
                  ) : entry.frozen ? (
                    <span
                      className="shrink-0 text-[11px] tracking-[0.08em] text-muted uppercase"
                      title={t("edicion.frozenLong")}
                    >
                      {t("edicion.frozen")}
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
