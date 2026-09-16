"use client";

import { useI18n } from "@/lib/i18n";

/**
 * Etiqueta de origen. Desaparece solo cuando TODO lo que muestra la página es
 * real: basta un día mock en una tendencia para que siga avisando.
 */
export function SampleDataBadge({
  state = "mock",
  long = false,
}: {
  state?: "mock" | "mixed" | "real";
  long?: boolean;
}) {
  const { t } = useI18n();
  if (state === "real") return null;

  const mixed = state === "mixed";
  const label = mixed ? t("badge.mixed") : t("badge.sample");
  const title = mixed ? t("badge.mixedLong") : t("badge.sampleLong");

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.08em] uppercase ${
        mixed
          ? "border-lavender bg-lavender-soft text-lavender-ink"
          : "border-cream bg-cream-soft text-cream-ink"
      }`}
      title={title}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${mixed ? "bg-lavender-ink/70" : "bg-cream-ink/70"}`}
        aria-hidden
      />
      {long ? title : label}
    </span>
  );
}
