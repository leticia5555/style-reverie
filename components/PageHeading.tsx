"use client";

import { useI18n, type TranslationKey } from "@/lib/i18n";

export function PageHeading({
  titleKey,
  subtitleKey,
}: {
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
}) {
  const { t } = useI18n();

  return (
    <header className="mb-8">
      <h1 className="font-serif text-4xl tracking-tight text-ink">
        {t(titleKey)}
      </h1>
      {subtitleKey ? (
        <p className="mt-2 max-w-2xl text-sm text-muted">{t(subtitleKey)}</p>
      ) : null}
    </header>
  );
}
