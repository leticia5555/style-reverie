"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageLede } from "@/components/PageLede";
import { useI18n } from "@/lib/i18n";
import type { Insight } from "@/lib/insights";
import type { Article, EditorialCache, FeedKey } from "@/lib/editorial";
import type { Localized } from "@/lib/types";

type MentionRow = { trendId: string; count: number; name: Localized };

/** Cada fuente tiene su pastel; el placeholder lo usa cuando no hay foto. */
const SOURCE_TINT: Record<FeedKey, { bg: string; ink: string }> = {
  vogue: { bg: "bg-lavender-soft", ink: "text-lavender-ink" },
  wwd: { bg: "bg-rose-soft", ink: "text-rose-ink" },
  bof: { bg: "bg-sage-soft", ink: "text-sage-ink" },
  whowhatwear: { bg: "bg-cream-soft", ink: "text-cream-ink" },
};

/**
 * Miniatura 3:4. Las fotos de moda son verticales y un cuadro apaisado las
 * recortaba de más; el retrato respeta la foto y es el formato de la fuente.
 * El anclaje va arriba porque cuando aun así hay que recortar, lo que sobra
 * está abajo — nunca la cara.
 *
 * Llega con imageUrl ya filtrada por el servidor: si el feed sirviera desde un
 * CDN que no está en next.config.ts, next/image lanzaría en runtime y tumbaría
 * la página, así que esas vienen en null y caen al placeholder.
 */
const THUMB_WIDTH = 140;
function Thumb({ article }: { article: Article }) {
  const tint = SOURCE_TINT[article.source];
  const usable = Boolean(article.imageUrl);

  return (
    <div
      style={{ width: THUMB_WIDTH }}
      className={`relative aspect-3/4 shrink-0 overflow-hidden rounded-xl ${
        usable ? "bg-quiet-soft" : tint.bg
      }`}
    >
      {usable ? (
        <Image
          src={article.imageUrl!}
          alt=""
          fill
          sizes={`${THUMB_WIDTH}px`}
          className="object-cover object-top"
        />
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] font-medium tracking-[0.12em] uppercase ${tint.ink} opacity-70`}
        >
          {article.sourceName}
        </span>
      )}
    </div>
  );
}

/** Fecha corta y absoluta: es lo que se pinta en el servidor. */
function absoluteDate(iso: string, lang: "es" | "en"): string {
  return new Date(iso).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

function timeAgo(iso: string | null, lang: "es" | "en"): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    numeric: "auto",
  });
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/**
 * La hora relativa depende de cuándo se mire, y la página se prerenderiza:
 * calcularla en el servidor y otra vez al hidratar daba textos distintos. El
 * HTML sale con la fecha absoluta y el cliente la cambia a relativa al montar.
 */
const noopSubscribe = () => () => {};

function RelativeTime({ iso }: { iso: string }) {
  const { lang } = useI18n();
  // false en el servidor, true en el cliente: sin efecto ni setState.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <span className="text-[11px] text-faint">
      {mounted ? timeAgo(iso, lang) : absoluteDate(iso, lang)}
    </span>
  );
}

function ArticleRow({
  article,
  names,
}: {
  article: Article;
  names: Map<string, Localized>;
}) {
  const { pick } = useI18n();

  return (
    <li className="border-b border-line py-4 last:border-0">
      <div className="flex items-start gap-4">
        <Thumb article={article} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="eyebrow">{article.sourceName}</span>
            {article.publishedAt ? (
              <RelativeTime iso={article.publishedAt} />
            ) : null}
          </div>
          <h3 className="mt-1.5 text-[15px] leading-snug font-medium text-ink">
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-lavender-ink hover:underline"
            >
              {article.title}
            </a>
          </h3>
          {article.snippet ? (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
              {article.snippet}
            </p>
          ) : null}
          {article.matches.length ? (
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {article.matches.map((match) => {
                const name = names.get(match.trendId);
                return (
                  <li key={match.trendId}>
                    <Link
                      href={`/trends/${match.trendId}`}
                      title={match.keyword}
                      className="inline-flex rounded-full border border-lavender bg-lavender-soft px-2.5 py-0.5 text-[11px] text-lavender-ink hover:bg-lavender/25"
                    >
                      {name ? pick(name) : match.trendId}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function EditorialView({
  cache,
  mentions,
  names,
  insight,
}: {
  cache: EditorialCache;
  mentions: MentionRow[];
  names: [string, Localized][];
  insight: Insight;
}) {
  const { t, pick } = useI18n();
  const [source, setSource] = useState<string>("all");
  const [onlyMatched, setOnlyMatched] = useState(false);

  const nameMap = useMemo(() => new Map(names), [names]);

  const visible = cache.articles.filter((article) => {
    if (source !== "all" && article.source !== source) return false;
    if (onlyMatched && !article.matches.length) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageLede
        titleKey="editorial.title"
        subtitleKey="editorial.subtitle"
        insight={insight}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-xs text-muted">
          {t("editorial.fetchedAt")}{" "}
          <span className="text-ink-soft">
            {cache.fetchedAt ? (
              <RelativeTime iso={cache.fetchedAt} />
            ) : (
              t("editorial.never")
            )}
          </span>{" "}
          · {t("editorial.refreshNote")}
        </p>
        <p className="tabular text-xs text-muted">
          {cache.articles.length} {t("editorial.articles")}
        </p>
      </div>

      {cache.articles.length ? (
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          {t("editorial.matchNote")}
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <button
              type="button"
              onClick={() => setSource("all")}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                source === "all"
                  ? "border-ink bg-ink text-canvas"
                  : "border-line-strong text-ink-soft hover:bg-quiet-soft"
              }`}
            >
              {t("common.all")}
            </button>
            {cache.feeds.map((feed) => (
              <button
                key={feed.key}
                type="button"
                disabled={!feed.count}
                onClick={() => setSource(feed.key)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  source === feed.key
                    ? "border-ink bg-ink text-canvas"
                    : "border-line-strong text-ink-soft hover:bg-quiet-soft"
                }`}
              >
                {feed.name}
                <span className="tabular ml-1.5 text-[10px] opacity-70">
                  {feed.ok ? feed.count : "—"}
                </span>
              </button>
            ))}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={onlyMatched}
                onChange={(event) => setOnlyMatched(event.target.checked)}
                className="accent-lavender"
              />
              {t("editorial.onlyMatched")}
            </label>
          </div>

          {visible.length ? (
            <ul>
              {visible.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  names={nameMap}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t("editorial.empty")}
              hint={t("editorial.emptyHow")}
            />
          )}
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="eyebrow">{t("editorial.sources")}</h2>
            <ul className="mt-2 space-y-1.5">
              {cache.feeds.map((feed) => (
                <li
                  key={feed.key}
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-ink-soft">{feed.name}</span>
                  {feed.ok ? (
                    <span className="tabular text-muted">{feed.count}</span>
                  ) : (
                    <span
                      className="text-rose-ink"
                      title={feed.error ?? undefined}
                    >
                      {t("editorial.failed")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="eyebrow">{t("editorial.mentions")}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-faint">
              {t("editorial.mentionsNote")}
            </p>
            {mentions.length ? (
              <ul className="mt-2 space-y-1.5">
                {mentions.map((row) => (
                  <li key={row.trendId}>
                    <Link
                      href={`/trends/${row.trendId}`}
                      className="flex items-baseline justify-between gap-2 text-xs text-ink-soft hover:text-lavender-ink"
                    >
                      <span className="min-w-0 truncate">{pick(row.name)}</span>
                      <span className="tabular shrink-0 text-muted">
                        {row.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted">
                {t("editorial.noMentions")}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
