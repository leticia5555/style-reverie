"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { CandidateRow } from "@/lib/sources/discovery";

/**
 * Candidatas detectadas en prensa que el catálogo todavía no tiene.
 *
 * Mientras el catálogo de muestra siga desconectado de lo que la prensa
 * escribe —de 130 titulares cruzan dos— esta lista es la materia prima del
 * catálogo, no una nota al pie. Por eso cada fila trae con qué juzgarla sin
 * salir de la página: cuántos titulares distintos la mencionan, cuáles son y
 * desde cuándo aparece.
 *
 * Promover es una decisión humana: el botón existe para que se vea dónde va a
 * estar, y no hace nada todavía. Un botón que promete y no cumple es peor que
 * uno desactivado, así que va deshabilitado y dice por qué.
 */

/** Cuántos titulares se ven sin desplegar: bastan para juzgar de un vistazo. */
const VISIBLE_EVIDENCE = 4;

type Category =
  | "category.prenda"
  | "category.color"
  | "category.textura"
  | "category.silueta"
  | "category.accesorio"
  | "category.estilo";

function CandidateCard({ candidate }: { candidate: CandidateRow }) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const fecha = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(
      lang === "es" ? "es-MX" : "en-US",
      { day: "numeric", month: "short", timeZone: "UTC" },
    );

  const evidence = expanded
    ? candidate.evidence
    : candidate.evidence.slice(0, VISIBLE_EVIDENCE);
  const hidden = candidate.evidence.length - evidence.length;

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      {/*
        En 390px el nombre y el contador se peleaban por el mismo renglón: el
        título se partía en dos y se montaba encima de las menciones. Debajo
        de sm van apilados, y cada dato del eyebrow es indivisible para que
        "16 SEP" no acabe en dos líneas.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <p className="font-serif text-xl leading-tight text-ink">
            {candidate.name_es}
          </p>
          <p className="eyebrow mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
            <span className="whitespace-nowrap">
              {candidate.category
                ? t(`category.${candidate.category}` as Category)
                : t("candidates.uncategorized")}
            </span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">
              {t("candidates.since")} {fecha(candidate.first_seen)}
            </span>
            {candidate.last_seen !== candidate.first_seen ? (
              <>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">
                  {t("candidates.lastSeen")} {fecha(candidate.last_seen)}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
          <span className="text-right">
            <span className="tabular block font-serif text-2xl leading-none text-ink">
              {candidate.mentions}
            </span>
            <span className="eyebrow mt-1 block">
              {candidate.mentions === 1
                ? t("candidates.mention")
                : t("candidates.mentions")}
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
        <div className="mt-3 border-t border-line pt-3">
          <p className="eyebrow">{t("candidates.headlines")}</p>
          <ul className="mt-2 space-y-1.5">
            {evidence.map((item) => (
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

          {hidden > 0 || expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs text-muted underline-offset-2 hover:text-lavender-ink hover:underline"
            >
              {expanded
                ? t("candidates.showLess")
                : `${t("candidates.showAll")} (${candidate.evidence.length})`}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CandidatesSection({
  candidates,
}: {
  candidates: CandidateRow[];
}) {
  const { t } = useI18n();
  if (!candidates.length) return null;

  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl tracking-tight text-ink">
        {t("candidates.title")}
      </h2>
      <p className="mt-1 text-xs text-muted">{t("candidates.note")}</p>
      <p className="eyebrow mt-2">
        {candidates.length} · {t("candidates.rank")}
      </p>

      <ul className="mt-4 space-y-3">
        {candidates.map((candidate) => (
          <CandidateCard key={candidate.slug} candidate={candidate} />
        ))}
      </ul>
    </section>
  );
}
