"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { Collection } from "@/lib/fashion-week";

/** Tira de color de la paleta: es lo que identifica la colección de un vistazo. */
export function PaletteStrip({
  palette,
  height = "h-2",
}: {
  palette: Collection["palette"];
  height?: string;
}) {
  return (
    <span className={`flex w-full overflow-hidden rounded-full ${height}`}>
      {palette.map((color) => (
        <span
          key={color.hex}
          className="flex-1"
          style={{ backgroundColor: color.hex }}
        />
      ))}
    </span>
  );
}

export function CollectionCard({ collection }: { collection: Collection }) {
  const { t, pick } = useI18n();

  return (
    <li>
      <Link
        href={`/fashion-week/${collection.slug}`}
        className="block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-lavender"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">
            {collection.season} · {collection.city}
          </p>
          <p className="eyebrow">{collection.looks.length} {t("fw.looks")}</p>
        </div>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-ink">
          {collection.house}
        </h2>
        <p className="mt-1 font-serif text-lg text-lavender-ink italic">
          {pick(collection.headline)}
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
          {pick(collection.summary)}
        </p>
        <span className="mt-4 block">
          <PaletteStrip palette={collection.palette} />
        </span>
      </Link>
    </li>
  );
}
