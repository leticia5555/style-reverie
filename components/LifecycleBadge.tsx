"use client";

import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import { useI18n } from "@/lib/i18n";
import type { Lifecycle } from "@/lib/types";

export function LifecycleBadge({
  lifecycle,
  size = "sm",
}: {
  lifecycle: Lifecycle;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  const style = LIFECYCLE_STYLES[lifecycle];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium tracking-[0.06em] uppercase ${style.badge} ${
        size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {t(`lifecycle.${lifecycle}`)}
    </span>
  );
}
