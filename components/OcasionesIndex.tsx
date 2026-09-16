"use client";

import Link from "next/link";
import { TrendPhoto } from "@/components/TrendPhoto";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import { ACCENT_STYLE } from "@/lib/ocasiones-accent";
import type { Insight } from "@/lib/insights";
import type { Ocasion } from "@/lib/ocasiones";

export function OcasionesIndex({
  ocasiones,
  insight,
  images = {},
}: {
  ocasiones: Ocasion[];
  insight: Insight;
  /** slug de ocasión → foto de una de sus tendencias. */
  images?: Record<string, TrendImage>;
}) {
  const { t, pick } = useI18n();
  const lead = ocasiones[0];

  return (
    <div>
      <header className="-mx-5 md:-mx-8">
        <div className="relative h-[52vh] min-h-[340px] w-full overflow-hidden bg-quiet-soft">
          {lead ? (
            <TrendPhoto
              image={images[lead.slug] ?? null}
              name={lead.name}
              trendId={lead.slug}
              sizes="100vw"
              priority
            />
          ) : null}
        </div>
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <h1 className="mt-8 font-serif text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {t("oc.title")}
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-xl leading-relaxed text-ink-soft">
            {t("oc.subtitle")}
          </p>
          {insight.line ? (
            <p className="mt-4 max-w-2xl text-sm text-muted">
              {pick(insight.line)}
            </p>
          ) : null}
          <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-faint">
            {t("oc.curated")}
          </p>
        </div>
      </header>

      {/* Asimétrica: la primera ocupa el ancho, el resto van a dos. */}
      <ul className="mx-auto mt-20 grid max-w-5xl gap-12 sm:grid-cols-2 sm:gap-x-10">
        {ocasiones.map((ocasion, index) => {
          const accent = ACCENT_STYLE[ocasion.accent];
          const wide = index === 0;
          return (
            <li key={ocasion.slug} className={wide ? "sm:col-span-2" : ""}>
              <Link href={`/ocasiones/${ocasion.slug}`} className="group block">
                <div
                  className={`relative w-full overflow-hidden rounded-sm bg-quiet-soft ${
                    wide ? "aspect-3/2 sm:aspect-21/9" : "aspect-4/5"
                  }`}
                >
                  <TrendPhoto
                    image={images[ocasion.slug] ?? null}
                    name={ocasion.name}
                    trendId={ocasion.slug}
                    sizes={wide ? "100vw" : "(max-width: 640px) 100vw, 45vw"}
                  />
                </div>

                <span
                  className={`mt-4 block h-1 w-12 rounded-full ${accent.bar}`}
                  aria-hidden
                />
                <h2
                  className={`mt-3 font-serif leading-[1.05] tracking-tight text-ink group-hover:text-lavender-ink ${
                    wide ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"
                  }`}
                >
                  {pick(ocasion.name)}
                </h2>
                <p className="mt-2 font-serif text-lg leading-snug text-ink-soft italic">
                  {pick(ocasion.tagline)}
                </p>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
                  {pick(ocasion.intro)}
                </p>
                <p className="eyebrow mt-4">
                  {ocasion.trends.length} {t("oc.count")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
