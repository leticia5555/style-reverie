"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Signal = {
  value: number;
  rank: number;
  keyword: string;
  fetchedAt: string;
};

type State =
  | { phase: "loading" }
  | { phase: "ok"; signal: Signal | null }
  | { phase: "unavailable" };

/**
 * Señal de Pinterest de hoy. Se pide al montar y no en el render del servidor:
 * la ficha no puede quedarse esperando a una fuente externa.
 *
 * Nunca entra en la serie histórica. Pinterest no se persiste, así que no
 * existe un "ayer" que dibujar — y presentarlo junto a la curva insinuaría que
 * hay histórico donde no lo hay.
 */
export function PinterestSignal({ trendId }: { trendId: string }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pinterest/${trendId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setState(
          data.status === "ok"
            ? { phase: "ok", signal: data.signal }
            : { phase: "unavailable" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [trendId]);

  if (state.phase === "unavailable") return null;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl text-ink">{t("pinterest.title")}</h2>
        <p className="text-xs text-muted">{t("pinterest.note")}</p>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-5">
        {state.phase === "loading" ? (
          <span className="block h-12 w-56 animate-pulse rounded bg-quiet-soft" />
        ) : state.signal ? (
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="eyebrow">{t("pinterest.strength")}</p>
              <p className="tabular mt-1 font-serif text-4xl leading-none text-ink">
                {state.signal.value.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="eyebrow">{t("pinterest.rank")}</p>
              <p className="tabular mt-1 font-serif text-4xl leading-none text-ink">
                {state.signal.rank}
              </p>
            </div>
            <div className="min-w-0">
              <p className="eyebrow">{t("pinterest.keyword")}</p>
              <p className="mt-1.5 text-sm text-ink-soft">
                {state.signal.keyword}
              </p>
            </div>
            <p className="ml-auto text-[11px] text-faint">
              {new Date(state.signal.fetchedAt).toLocaleTimeString(
                lang === "es" ? "es-MX" : "en-US",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("pinterest.noMatch")}</p>
        )}
      </div>
    </section>
  );
}
