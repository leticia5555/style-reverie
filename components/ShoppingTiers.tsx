"use client";

import { useI18n } from "@/lib/i18n";
import { SHOP_TIERS, type ShopLink, type ShopTier } from "@/lib/types";

const TIER_STYLE: Record<ShopTier, string> = {
  budget: "border-sage bg-sage-soft text-sage-ink",
  mid: "border-lavender bg-lavender-soft text-lavender-ink",
  invest: "border-rose bg-rose-soft text-rose-ink",
};

const TIER_LABEL: Record<ShopTier, "detail.budget" | "detail.mid" | "detail.invest"> = {
  budget: "detail.budget",
  mid: "detail.mid",
  invest: "detail.invest",
};

export function ShoppingTiers({
  shopping,
}: {
  shopping: Record<ShopTier, ShopLink[]>;
}) {
  const { t, pick, lang } = useI18n();

  /**
   * MXN y USD comparten el símbolo $, así que el código de moneda siempre va
   * visible: en México la diferencia entre $899 MXN y $899 USD no es sutil.
   */
  const money = (link: ShopLink) => {
    const amount = new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
      style: "currency",
      currency: link.currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: link.currency === "MXN" ? 0 : 2,
    }).format(link.price);
    return `${amount} ${link.currency}`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {SHOP_TIERS.map((tier) => (
        <section
          key={tier}
          className="rounded-xl border border-line bg-surface p-4"
        >
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.08em] uppercase ${TIER_STYLE[tier]}`}
          >
            {t(TIER_LABEL[tier])}
          </span>
          <ul className="mt-3 space-y-3">
            {shopping[tier].map((link) => (
              <li key={`${link.retailer}-${link.label.es}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink group-hover:text-lavender-ink">
                      {link.retailer}
                    </span>
                    <span className="tabular text-sm whitespace-nowrap text-ink-soft">
                      {money(link)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {pick(link.label)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
