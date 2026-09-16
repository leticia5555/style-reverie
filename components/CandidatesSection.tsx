"use client";

import { useI18n } from "@/lib/i18n";
import type { CandidateRow } from "@/lib/sources/discovery";

/**
 * Candidatas detectadas en prensa que el catálogo todavía no tiene.
 *
 * Promover es una decisión humana: el botón existe para que se vea dónde va a
 * estar, y no hace nada todavía. Un botón que promete y no cumple es peor que
 * uno desactivado, así que va deshabilitado y dice por qué.
 */
export function CandidatesSection({
  candidates,
}: {
  candidates: CandidateRow[];
}) {
  const { t, lang } = useI18n();
  if (!candidates.length) return null;

  const fecha = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(
      lang === "es" ? "es-MX" : "en-US",
      { day: "numeric", month: "short", timeZone: "UTC" },
    );

  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl tracking-tight text-ink">
        {t("candidates.title")}
      </h2>
      <p className="mt-1 text-xs text-muted">{t("candidates.note")}</p>

      <ul className="mt-4 space-y-3">
        {candidates.map((candidate) => (
          <li
            key={candidate.slug}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif text-xl text-ink">
                  {candidate.name_es}
                </p>
                <p className="eyebrow mt-1">
                  {candidate.category
                    ? t(
                        `category.${candidate.category}` as
                          | "category.prenda"
                          | "category.color"
                          | "category.textura"
                          | "category.silueta"
                          | "category.accesorio"
                          | "category.estilo",
                      )
                    : t("candidates.uncategorized")}{" "}
                  · {t("candidates.since")} {fecha(candidate.first_seen)}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-right">
                  <span className="tabular block font-serif text-2xl leading-none text-ink">
                    {candidate.mentions}
                  </span>
                  <span className="eyebrow mt-1 block">
                    {t("candidates.mentions")}
                  </span>
                </span>
                <button
                  type="button"
                  disabled
                  title={t("candidates.promoteSoon")}
                  className="cursor-not-allowed rounded-full border border-line-strong px-3 py-1.5 text-xs text-faint"
                >
                  {t("candidates.promote")}
                </button>
              </div>
            </div>

            {candidate.evidence.length ? (
              <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                {candidate.evidence.slice(0, 3).map((item) => (
                  <li key={item.link} className="text-xs leading-relaxed">
                    <span className="eyebrow">{item.source}</span>{" "}
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-soft hover:text-lavender-ink hover:underline"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
