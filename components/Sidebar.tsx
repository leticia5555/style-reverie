"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type NavHref =
  | "/trending"
  | "/compare"
  | "/alerts"
  | "/editorial"
  | "/edicion"
  | "/fashion-week"
  | "/ocasiones"
  | "/paleta";

type NavLink = { href: NavHref; key: TranslationKey };

/**
 * Dos secciones: los datos crudos del catálogo y lo que se lee como revista.
 * Son dos modos de uso distintos y mezclarlos en una lista los aplanaba.
 */
const DATA_LINKS: NavLink[] = [
  { href: "/trending", key: "nav.trending" },
  { href: "/compare", key: "nav.compare" },
  { href: "/alerts", key: "nav.alerts" },
  { href: "/paleta", key: "nav.paleta" },
];

const EDITORIAL_LINKS: NavLink[] = [
  { href: "/edicion", key: "nav.edicion" },
  { href: "/fashion-week", key: "nav.fashionWeek" },
  { href: "/ocasiones", key: "nav.ocasiones" },
  { href: "/editorial", key: "nav.editorial" },
];

const SOON_LINKS: TranslationKey[] = ["nav.heatmap"];

export function Sidebar() {
  const pathname = usePathname();
  const { t, lang } = useI18n();

  return (
    <aside className="flex w-full shrink-0 flex-col justify-between border-line bg-surface md:h-dvh md:w-60 md:border-r lg:w-64">
      <div>
        <div className="border-b border-line px-6 py-6">
          <Link href="/trending" className="block">
            <span className="font-serif text-xl tracking-tight text-ink">
              Style Reverie
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted">
              {t("brand.tagline")}
            </span>
          </Link>
        </div>

        <nav className="px-3 py-5">
          <p className="eyebrow px-3 pb-2">{t("nav.section")}</p>
          <ul className="space-y-0.5">
            {DATA_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href === "/trending" && pathname.startsWith("/trends/"));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-lavender-soft font-medium text-lavender-ink"
                        : "text-ink-soft hover:bg-quiet-soft"
                    }`}
                  >
                    {t(link.key)}
                    {active ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-lavender"
                        aria-hidden
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="eyebrow px-3 pt-6 pb-2">{t("nav.sectionEdicion")}</p>
          <ul className="space-y-0.5">
            {EDITORIAL_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-lavender-soft font-medium text-lavender-ink"
                        : "text-ink-soft hover:bg-quiet-soft"
                    }`}
                  >
                    {t(link.key)}
                    {active ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-lavender"
                        aria-hidden
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="eyebrow px-3 pt-6 pb-2">{t("nav.sectionSoon")}</p>
          <ul className="space-y-0.5">
            {SOON_LINKS.map((key) => (
              <li
                key={key}
                className="cursor-default rounded-lg px-3 py-2 text-sm text-faint"
              >
                {t(key)}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line px-5 py-5">
        <LanguageToggle />
        <p className="mt-4 text-[11px] leading-relaxed text-faint">
          Style Reverie · $9 / {lang === "es" ? "mes" : "mo"}
        </p>
      </div>
    </aside>
  );
}
