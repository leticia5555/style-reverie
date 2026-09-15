"use client";

import { useI18n, type Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">{t("lang.toggle")}</span>
      <div className="flex rounded-full border border-line-strong bg-canvas p-0.5">
        {OPTIONS.map((option) => {
          const active = option.value === lang;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLang(option.value)}
              aria-pressed={active}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] transition-colors ${
                active
                  ? "bg-lavender-soft text-lavender-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
