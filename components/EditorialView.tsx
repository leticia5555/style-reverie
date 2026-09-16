"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { useI18n } from "@/lib/i18n";
import type { Article, EditorialCache } from "@/lib/editorial";
import type { Localized } from "@/lib/types";

type MentionRow = { trendId: string; count: number; name: Localized };

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

function ArticleRow({
  article,
  names,
}: {
  article: Article;
  names: Map<string, Localized>;
}) {
  const { lang, pick } = useI18n();

  return (
    <li className="border-b border-line py-4 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="eyebrow">{article.sourceName}</span>
        {article.publishedAt ? (
          <span className="text-[11px] text-faint">
            {timeAgo(article.publishedAt, lang)}
          </span>
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
    </li>
  );
}

export function EditorialView({
  cache,
  mentions,
  names,
}: {
  cache: EditorialCache;
  mentions: MentionRow[];
  names: [string, Localized][];
}) {
  const { t, pick, lang } = useI18n();
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
      <PageHeading titleKey="editorial.title" subtitleKey="editorial.subtitle" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-xs text-muted">
          {t("editorial.fetchedAt")}{" "}
          <span className="text-ink-soft">
            {cache.fetchedAt
              ? timeAgo(cache.fetchedAt, lang)
              : t("editorial.never")}
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
            <div className="rounded-xl border border-line bg-surface px-4 py-10 text-center">
              <p className="text-sm text-ink-soft">{t("editorial.empty")}</p>
              <p className="mt-1.5 text-xs text-muted">
                {t("editorial.emptyHow")}
              </p>
            </div>
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
