"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const LIVE_LINKS: { href: "/trending"; key: TranslationKey }[] = [
  { href: "/trending", key: "nav.trending" },
];

const SOON_LINKS: TranslationKey[] = [
  "nav.editorial",
  "nav.compare",
  "nav.heatmap",
  "nav.alerts",
];

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
            {LIVE_LINKS.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith("/trends");
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
