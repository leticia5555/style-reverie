"use client";

import Link from "next/link";
import { TrendPhoto } from "@/components/TrendPhoto";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
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

/**
 * Una colección, en bloque grande.
 *
 * La foto sale de las tendencias que la colección misma cita en sus looks: no
 * tenemos fotos de pasarela y no se bajan de donde no se puede. Cuando no hay
 * ninguna, la paleta de la colección ocupa ese sitio como campo de color —que
 * para una colección es tan identificativo como una foto.
 */
export function CollectionCard({
  collection,
  image,
  wide = false,
}: {
  collection: Collection;
  image: TrendImage | null;
  wide?: boolean;
}) {
  const { t, pick } = useI18n();

  return (
    <li className={wide ? "sm:col-span-2" : ""}>
      <Link href={`/fashion-week/${collection.slug}`} className="group block">
        <div
          className={`relative w-full overflow-hidden rounded-sm ${
            wide ? "aspect-3/2 sm:aspect-21/9" : "aspect-4/5"
          }`}
        >
          {image ? (
            <TrendPhoto
              image={image}
              name={{ es: collection.house, en: collection.house }}
              trendId={collection.slug}
              sizes={wide ? "100vw" : "(max-width: 640px) 100vw, 45vw"}
            />
          ) : (
            <span className="flex h-full w-full">
              {collection.palette.map((color) => (
                <span
                  key={color.hex}
                  className="flex-1"
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </span>
          )}
        </div>

        <p className="eyebrow mt-4">
          {collection.season} · {collection.city} · {collection.looks.length}{" "}
          {t("fw.looks")}
        </p>
        <h2
          className={`mt-2 font-serif leading-[1.05] tracking-tight text-ink group-hover:text-lavender-ink ${
            wide ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"
          }`}
        >
          {collection.house}
        </h2>
        <p className="mt-2 font-serif text-lg leading-snug text-lavender-ink italic">
          {pick(collection.headline)}
        </p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
          {pick(collection.summary)}
        </p>
      </Link>
    </li>
  );
}
