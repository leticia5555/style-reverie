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

/** Cinco pasteles de marca, repartidos por el id para que no bailen. */
const TINTS = [
  "bg-lavender-soft text-lavender-ink",
  "bg-rose-soft text-rose-ink",
  "bg-sage-soft text-sage-ink",
  "bg-cream-soft text-cream-ink",
  "bg-quiet-soft text-quiet-ink",
];

export function tintFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function TrendPhoto({
  image,
  name,
  trendId,
  sizes,
  priority = false,
  /** Tamaño del nombre en el placeholder; la tira del terminal es diminuta. */
  compact = false,
  className = "",
}: {
  image: TrendImage | null;
  name: Localized;
  trendId: string;
  sizes: string;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();

  if (!image) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden ${tintFor(trendId)} ${className}`}
      >
        <span
          className={`px-3 text-center font-serif leading-tight ${
            compact ? "text-[10px]" : "text-base sm:text-lg"
          }`}
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
