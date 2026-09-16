"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SampleDataBadge } from "@/components/SampleDataBadge";
import { useI18n } from "@/lib/i18n";

/** Fecha de corte de los datos mock, fija para que el render sea estable. */
export const DATA_AS_OF = "2026-09-14";

/**
 * Rutas cuyos datos ya no son mock. Todo lo demás sigue llevando la etiqueta
 * de datos de muestra en la cabecera.
 */
const LIVE_ROUTES = ["/editorial"];

export function AppShell({ children }: { children: ReactNode }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const isLive = LIVE_ROUTES.some((route) => pathname.startsWith(route));
  const asOf = new Date(`${DATA_AS_OF}T12:00:00Z`).toLocaleDateString(
    lang === "es" ? "es-ES" : "en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  );

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas/90 px-5 py-3 backdrop-blur md:px-8">
          <p className="eyebrow">
            {t("common.updated")} · {asOf}
          </p>
          {isLive ? null : <SampleDataBadge />}
        </header>
        <main className="flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
