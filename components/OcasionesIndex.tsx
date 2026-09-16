"use client";

import Link from "next/link";
import { PageLede } from "@/components/PageLede";
import { useI18n } from "@/lib/i18n";
import { ACCENT_STYLE } from "@/lib/ocasiones-accent";
import type { Insight } from "@/lib/insights";
import type { Ocasion } from "@/lib/ocasiones";

export function OcasionesIndex({
  ocasiones,
  insight,
}: {
  ocasiones: Ocasion[];
  insight: Insight;
}) {
  const { t, pick } = useI18n();

  return (
    <div className="mx-auto max-w-5xl">
      <PageLede
        titleKey="oc.title"
        subtitleKey="oc.subtitle"
        insight={insight}
      />
      <p className="text-[11px] leading-relaxed text-faint">{t("oc.curated")}</p>

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {ocasiones.map((ocasion) => {
          const accent = ACCENT_STYLE[ocasion.accent];
          return (
            <li key={ocasion.slug}>
              <Link
                href={`/ocasiones/${ocasion.slug}`}
                className="block h-full rounded-xl border border-line bg-surface p-5 transition-colors hover:border-lavender"
              >
                <span
                  className={`block h-1 w-12 rounded-full ${accent.bar}`}
                  aria-hidden
                />
                <h2 className="mt-3 font-serif text-3xl tracking-tight text-ink">
                  {pick(ocasion.name)}
                </h2>
                <p className="mt-1 font-serif text-lg text-ink-soft italic">
                  {pick(ocasion.tagline)}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
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
