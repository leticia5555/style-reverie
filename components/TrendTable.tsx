"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Delta } from "@/components/Delta";
import { FilterChips } from "@/components/FilterChips";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { Sparkline } from "@/components/Sparkline";
import { useI18n } from "@/lib/i18n";
import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import { SOURCES, CATEGORIES, LIFECYCLES } from "@/lib/types";
import type { Category, Lifecycle, TrendSummary } from "@/lib/types";

type SortKey = "score" | "momentum7d" | "yoyPct" | "name";

export function TrendTable({ rows }: { rows: TrendSummary[] }) {
  const { t, pick, lang } = useI18n();
  const [category, setCategory] = useState<Category | "all">("all");
  const [lifecycle, setLifecycle] = useState<Lifecycle | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "score",
    desc: true,
  });

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (category !== "all" && row.category !== category) return false;
      if (lifecycle !== "all" && row.lifecycle !== lifecycle) return false;
      if (needle) {
        const haystack = `${row.name.es} ${row.name.en}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const direction = sort.desc ? -1 : 1;
      if (sort.key === "name") {
        return pick(a.name).localeCompare(pick(b.name), lang) * direction * -1;
      }
      return (a[sort.key] - b[sort.key]) * direction;
    });
  }, [rows, category, lifecycle, query, sort, pick, lang]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: key !== "name" },
    );

  const hasFilters = category !== "all" || lifecycle !== "all" || query !== "";

  const sortArrow = (key: SortKey) =>
    sort.key === key ? (sort.desc ? "↓" : "↑") : "";

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 py-4">
        <FilterChips
          label={t("common.category")}
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: t("common.all") },
            ...CATEGORIES.map((value) => ({
              value,
              label: t(`category.${value}`),
            })),
          ]}
        />
        <FilterChips
          label={t("common.lifecycle")}
          value={lifecycle}
          onChange={setLifecycle}
          options={[
            { value: "all", label: t("common.all") },
            ...LIFECYCLES.map((value) => ({
              value,
              label: t(`lifecycle.${value}`),
            })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("common.search")}
            aria-label={t("common.search")}
            className="w-full max-w-xs rounded-full border border-line-strong bg-canvas px-4 py-1.5 text-sm text-ink placeholder:text-faint focus:border-lavender focus:outline-none sm:w-64"
          />
          <span className="tabular text-xs text-muted">
            {visible.length} / {rows.length} {t("trending.count")}
          </span>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setLifecycle("all");
                setQuery("");
              }}
              className="text-xs text-lavender-ink underline underline-offset-4 hover:text-ink"
            >
              {t("common.reset")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong text-left">
              <Th onClick={() => toggleSort("name")} className="w-[30%]">
                {t("trending.trend")} {sortArrow("name")}
              </Th>
              <Th align="right" onClick={() => toggleSort("score")}>
                {t("common.score")} {sortArrow("score")}
              </Th>
              <Th className="w-24">90d</Th>
              <Th>{t("common.lifecycle")}</Th>
              <Th align="right" onClick={() => toggleSort("momentum7d")}>
                {t("common.momentum7d")} {sortArrow("momentum7d")}
              </Th>
              <Th align="right" onClick={() => toggleSort("yoyPct")}>
                {t("common.yoy")} {sortArrow("yoyPct")}
              </Th>
              <Th align="right">{t("common.sources")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-line transition-colors last:border-0 hover:bg-lavender-soft/40"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/trends/${row.id}`}
                    className="block font-medium text-ink group-hover:text-lavender-ink"
                  >
                    {pick(row.name)}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted">
                    {t(`category.${row.category}`)} · {row.season}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="tabular text-base font-medium text-ink">
                    {row.score.toFixed(1)}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <Sparkline
                    values={row.spark}
                    color={LIFECYCLE_STYLES[row.lifecycle].hex}
                  />
                </td>
                <td className="py-3 pr-4">
                  <LifecycleBadge lifecycle={row.lifecycle} />
                </td>
                <td className="py-3 pr-4 text-right">
                  <Delta value={row.momentum7d} />
                </td>
                <td className="py-3 pr-4 text-right">
                  <Delta value={row.yoyPct} suffix="%" decimals={0} />
                </td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex gap-0.5" aria-hidden>
                      {SOURCES.map((source, index) => (
                        <span
                          key={source}
                          className={`h-1.5 w-1.5 rounded-full ${
                            index < row.sourceCount
                              ? "bg-lavender"
                              : "bg-line-strong"
                          }`}
                        />
                      ))}
                    </span>
                    <span className="tabular text-xs text-muted">
                      {row.sourceCount}/{SOURCES.length}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {t("trending.empty")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      scope="col"
      className={`pb-2 font-normal ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="eyebrow transition-colors hover:text-ink"
        >
          {children}
        </button>
      ) : (
        <span className="eyebrow">{children}</span>
      )}
    </th>
  );
}
