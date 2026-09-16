"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import type { Localized } from "@/lib/types";

/**
 * La foto de una tendencia, con su crédito.
 *
 * El crédito no es opcional ni decorativo: va sobre la foto, legible, y enlaza
 * al original. Una imagen prestada sin decir de quién es no se enseña, así que
 * `TrendImage` trae los tres campos o no hay imagen.
 *
 * Sin foto se pinta un pastel con el nombre. No es un hueco ni un icono de
 * "falta algo": es lo que hay que decir cuando no tenemos foto de esto.
 *
 * En `compact` —la miniatura de 40px del modo terminal— el crédito no se pinta
 * encima: a ese tamaño sería un borrón ilegible, que no es "visible". La
 * miniatura entera pasa a ser el enlace al original y el crédito viaja en su
 * nombre accesible, que es lo que sí se puede leer ahí (al pasar el ratón y
 * con lector de pantalla). Impreso y legible va en la ficha y en el modo
 * editorial, donde la foto tiene tamaño para sostenerlo.
 */

/**
 * El fondo cuando no hay foto.
 *
 * Un rectángulo plano a tamaño grande se lee como un hueco: la página parece
 * rota, no parece que falte una foto. Así que nunca es plano.
 *
 * - **Color**: su propio hex. Es la tendencia; no hay nada que sustituya mejor
 *   a una foto de un color que el color.
 * - **Lo demás**: un degradado suave derivado de la categoría, para que las
 *   prendas no se confundan con los accesorios de un vistazo.
 *
 * Los degradados se escriben con los tokens de marca, no con hex sueltos.
 */
type Category =
  | "prenda"
  | "color"
  | "textura"
  | "silueta"
  | "accesorio"
  | "estilo";

const CATEGORY_GRADIENT: Record<Category, string> = {
  prenda:
    "linear-gradient(150deg, var(--color-lavender-soft) 0%, var(--color-rose-soft) 100%)",
  color:
    "linear-gradient(150deg, var(--color-rose-soft) 0%, var(--color-cream-soft) 100%)",
  textura:
    "linear-gradient(150deg, var(--color-cream-soft) 0%, var(--color-sage-soft) 100%)",
  silueta:
    "linear-gradient(150deg, var(--color-quiet-soft) 0%, var(--color-lavender-soft) 100%)",
  accesorio:
    "linear-gradient(150deg, var(--color-sage-soft) 0%, var(--color-quiet-soft) 100%)",
  estilo:
    "linear-gradient(150deg, var(--color-lavender-soft) 0%, var(--color-cream-soft) 100%)",
};

/**
 * ¿El texto va oscuro o claro encima? Se mide la luminancia del color, que es
 * lo único que decide si algo se lee: un burdeos y un amarillo pueden tener el
 * mismo "peso" a ojo y necesitar tinta opuesta.
 */
function isDark(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6;
}

export function TrendPhoto({
  image,
  name,
  sizes,
  priority = false,
  /** Tamaño del nombre en el placeholder; la tira del terminal es diminuta. */
  compact = false,
  className = "",
  category = "prenda",
  swatch,
}: {
  image: TrendImage | null;
  name: Localized;
  sizes: string;
  priority?: boolean;
  compact?: boolean;
  className?: string;
  category?: Category;
  /** Hex de la tendencia, solo en las de categoría color. */
  swatch?: string;
}) {
  const { lang } = useI18n();

  if (!image) {
    // Una tendencia de color se pinta de su color; el resto, del degradado.
    const useSwatch = category === "color" && Boolean(swatch);
    const background = useSwatch
      ? swatch
      : CATEGORY_GRADIENT[category] ?? CATEGORY_GRADIENT.prenda;
    const dark = useSwatch && isDark(swatch as string);

    return (
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden ${className}`}
        style={{
          ...(useSwatch ? { background } : { backgroundImage: background }),
          // El nombre se mide contra el ancho de SU caja, no de la ventana:
          // el mismo componente se usa en una miniatura de 160px y en una
          // portada a sangre, y un tamaño fijo desbordaba la pequeña.
          containerType: "inline-size",
        }}
      >
        <span
          className={`px-[6%] text-center font-serif leading-[1.05] hyphens-auto ${
            dark ? "text-white" : "text-ink"
          }`}
          style={
            compact
              ? { fontSize: "10px" }
              : { fontSize: "clamp(0.85rem, 13cqw, 3.5rem)" }
          }
        >
          {name[lang]}
        </span>
      </div>
    );
  }

  const alt = image.alt ? image.alt[lang] : name[lang];
  const photo = (
    <Image
      src={image.url}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
      style={{ objectPosition: "top" }}
    />
  );

  if (compact) {
    return (
      <a
        href={image.creditUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`${alt} — ${image.credit}`}
        aria-label={`${alt} — ${image.credit}`}
        className={`relative block h-full w-full overflow-hidden ${className}`}
      >
        {photo}
      </a>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {photo}
      <a
        href={image.creditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-0 bottom-0 bg-canvas/85 px-2 py-1 text-[10px] tracking-wide text-ink-soft backdrop-blur-sm hover:text-lavender-ink"
      >
        {image.credit}
      </a>
    </div>
  );
}
