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

function useIsActive() {
  const pathname = usePathname();
  return (href: NavHref) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/trending" && pathname.startsWith("/trends/"));
}

/**
 * En móvil la barra lateral se convierte en un encabezado compacto con la
 * navegación en una tira horizontal. Apilada ocupaba la primera pantalla
 * entera: había que bajar todo el menú antes de ver el primer dato.
 */
function MobileNav() {
  const { t } = useI18n();
  const isActive = useIsActive();
  const links = [...DATA_LINKS, ...EDITORIAL_LINKS];

  return (
    <div className="border-b border-line bg-surface md:hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <Link href="/trending" className="min-w-0">
          <span className="block truncate font-serif text-lg tracking-tight text-ink">
            Style Reverie
          </span>
        </Link>
        <LanguageToggle compact />
      </div>
      {/* Tira desplazable: cabe cualquier número de secciones sin menú oculto. */}
      <nav className="-mb-px overflow-x-auto">
        <ul className="flex w-max gap-1 px-5 pb-3">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-lavender-soft font-medium text-lavender-ink"
                      : "text-ink-soft"
                  }`}
                >
                  {t(link.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NavSection({
  label,
  links,
}: {
  label: TranslationKey;
  links: NavLink[];
}) {
  const { t } = useI18n();
  const isActive = useIsActive();

  return (
    <>
      <p className="eyebrow px-3 pb-2">{t(label)}</p>
      <ul className="space-y-0.5">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
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
    </>
  );
}

export function Sidebar() {
  const { t, lang } = useI18n();

  return (
    <>
      <MobileNav />

      <aside className="hidden w-full shrink-0 flex-col justify-between border-line bg-surface md:flex md:h-dvh md:w-60 md:border-r lg:w-64">
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
            <NavSection label="nav.section" links={DATA_LINKS} />
            <div className="pt-6">
              <NavSection label="nav.sectionEdicion" links={EDITORIAL_LINKS} />
            </div>

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
    </>
  );
}
