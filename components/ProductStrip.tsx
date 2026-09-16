"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import type { AwinProduct } from "@/lib/sources/awin";
import { SHOP_TIERS, type ShopTier } from "@/lib/types";

const TIER_LABEL: Record<ShopTier, "detail.budget" | "detail.mid" | "detail.invest"> = {
  budget: "detail.budget",
  mid: "detail.mid",
  invest: "detail.invest",
};

/**
 * Tira de fotos de producto por nivel de precio.
 *
 * Solo entran productos cuya imagen la provee el propio retailer en su feed de
 * afiliados; eso ya lo filtró `lib/sources/awin.ts`. Si no queda ninguno, la
 * tira no se pinta: una fila de huecos grises no informa de nada y ensucia la
 * ficha. Por eso el componente devuelve null en vez de un estado vacío.
 */
export function ProductStrip({
  products,
}: {
  products: Record<ShopTier, AwinProduct[]>;
}) {
  const { t, lang } = useI18n();
  const total = SHOP_TIERS.reduce((sum, tier) => sum + products[tier].length, 0);
  if (!total) return null;

  const money = (product: AwinProduct) => {
    const amount = new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US", {
      style: "currency",
      currency: product.currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: product.currency === "MXN" ? 0 : 2,
    }).format(product.price);
    // MXN y USD comparten el símbolo $: el código va siempre visible.
    return `${amount} ${product.currency}`;
  };

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl tracking-tight text-ink">
        {t("product.title")}
      </h2>
      <p className="mt-1 text-xs text-muted">{t("product.note")}</p>

      <div className="mt-5 space-y-6">
        {SHOP_TIERS.filter((tier) => products[tier].length).map((tier) => (
          <div key={tier}>
            <p className="eyebrow">{t(TIER_LABEL[tier])}</p>
            <ul className="mt-2 flex snap-x gap-4 overflow-x-auto pb-2">
              {products[tier].map((product) => (
                <li key={product.id} className="w-40 shrink-0 snap-start">
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="group block"
                  >
                    <span className="relative block aspect-3/4 w-full overflow-hidden rounded-sm bg-quiet-soft">
                      <Image
                        src={product.imageUrl}
                        alt={product.title}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    </span>
                    <span className="mt-2 block text-xs text-ink group-hover:text-lavender-ink">
                      {product.retailer}
                    </span>
                    <span className="tabular mt-0.5 block text-xs text-muted">
                      {money(product)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
