"use client";

import { useI18n } from "@/lib/i18n";

/** Etiqueta permanente: todo lo que se ve hoy es mock. */
export function SampleDataBadge({ long = false }: { long?: boolean }) {
  const { t } = useI18n();

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-cream bg-cream-soft px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-cream-ink uppercase"
      title={t("badge.sampleLong")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-cream-ink/70" aria-hidden />
      {long ? t("badge.sampleLong") : t("badge.sample")}
    </span>
  );
}
