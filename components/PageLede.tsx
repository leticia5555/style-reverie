"use client";

import type { ReactNode } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import type { Figure, Insight } from "@/lib/insights";

/**
 * Cabecera común: título, cifras grandes y la línea editorial del día.
 *
 * Ninguna página abre en frío con una tabla. La cifra es lo primero que se lee
 * y la línea dice qué pasó esta semana; ambas salen del dato, no están escritas
 * a mano, así que envejecen solas.
 */
export function PageLede({
  titleKey,
  subtitleKey,
  insight,
  children,
}: {
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
  insight?: Insight;
  children?: ReactNode;
}) {
  const { t, pick } = useI18n();

  return (
    <header className="mb-8">
      <h1 className="font-serif text-[2rem] leading-tight tracking-tight text-ink sm:text-4xl">
        {t(titleKey)}
      </h1>
      {subtitleKey ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {t(subtitleKey)}
        </p>
      ) : null}

      {insight?.figures.length ? (
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-5 sm:gap-x-12">
          {insight.figures.map((figure) => (
            <FigureItem key={`${figure.value}-${figure.label.es}`} figure={figure} />
          ))}
        </dl>
      ) : null}

      {insight?.line ? (
        <p className="mt-4 max-w-2xl font-serif text-lg leading-snug text-ink-soft italic sm:text-xl">
          {pick(insight.line)}
        </p>
      ) : null}

      {children}
    </header>
  );
}

function FigureItem({ figure }: { figure: Figure }) {
  const { pick } = useI18n();
  const color = figure.tone ? LIFECYCLE_STYLES[figure.tone].hex : undefined;

  return (
    <div>
      <dd
        className="tabular font-serif text-3xl leading-none sm:text-4xl"
        style={{ color: color ?? "var(--color-ink)" }}
      >
        {figure.value}
      </dd>
      <dt className="eyebrow mt-1.5">{pick(figure.label)}</dt>
    </div>
  );
}
