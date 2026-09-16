"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Delta } from "@/components/Delta";
import { EmptyState } from "@/components/EmptyState";
import { FilterChips } from "@/components/FilterChips";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { Sparkline } from "@/components/Sparkline";
import { TrendPhoto } from "@/components/TrendPhoto";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import { CATEGORIES, LIFECYCLES } from "@/lib/types";
import type { Category, Lifecycle, TrendSummary } from "@/lib/types";

type SortKey = "score" | "momentum7d" | "yoyPct" | "name";

export function TrendTable({
  rows,
  images = {},
}: {
  rows: TrendSummary[];
  /** trendId → foto. Se resuelve en el servidor; ver lib/trend-image.ts. */
  images?: Record<string, TrendImage>;
}) {
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

      {/* Tarjetas hasta lg, tabla a partir de ahí. */}
      {visible.length ? (
        <ul className="mt-6 space-y-3 lg:hidden">
          {visible.map((row) => (
            <TrendCard key={row.id} row={row} image={images[row.id] ?? null} />
          ))}
        </ul>
      ) : null}

      <div className="mt-6 hidden overflow-x-auto lg:block">
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
                  {/*
                    La miniatura es cuadrada y pequeña a propósito: el terminal
                    es una tabla y la foto aquí sirve para reconocer la fila de
                    un vistazo, no para mirarla. Mirarla es el modo editorial.
                  */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md">
                      <TrendPhoto
                        image={images[row.id] ?? null}
                        name={row.name}
                        category={row.category}
                        swatch={row.swatch}
                        sizes="40px"
                        compact
                      />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/trends/${row.id}`}
                        className="block font-medium text-ink group-hover:text-lavender-ink"
                      >
                        {pick(row.name)}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t(`category.${row.category}`)} · {row.season}
                      </span>
                    </div>
                  </div>
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
                  <SourceDots count={row.sourceCount} total={row.sourceTotal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t("trending.empty")}
            hint={t("trending.emptyHint")}
            action={
              <button
                type="button"
                onClick={() => {
                  setCategory("all");
                  setLifecycle("all");
                  setQuery("");
                }}
                className="rounded-full border border-line-strong px-4 py-1.5 text-xs text-ink-soft transition-colors hover:bg-quiet-soft"
              >
                {t("common.reset")}
              </button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

/** Los seis puntos de fuentes. Mismo componente en tabla y en tarjeta. */
function SourceDots({ count, total }: { count: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-1.5 rounded-full ${
              index < count ? "bg-lavender" : "bg-line-strong"
            }`}
          />
        ))}
      </span>
      <span className="tabular text-xs text-muted">
        {count}/{total}
      </span>
    </span>
  );
}

/**
 * Fila en formato tarjeta para pantallas estrechas. A 390px una tabla de siete
 * columnas obliga a scroll horizontal, que es la peor manera de leer un
 * ranking: se pierde la referencia de qué fila se está mirando.
 */
function TrendCard({
  row,
  image,
}: {
  row: TrendSummary;
  image: TrendImage | null;
}) {
  const { t, pick } = useI18n();

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <Link href={`/trends/${row.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md">
              <TrendPhoto
                image={image}
                name={row.name}
                category={row.category}
                        swatch={row.swatch}
                sizes="40px"
                compact
              />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-ink">{pick(row.name)}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t(`category.${row.category}`)} · {row.season}
              </p>
            </div>
          </div>
          <span className="tabular shrink-0 font-serif text-2xl leading-none text-ink">
            {row.score.toFixed(1)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <LifecycleBadge lifecycle={row.lifecycle} />
          <Sparkline
            values={row.spark}
            color={LIFECYCLE_STYLES[row.lifecycle].hex}
            width={88}
            height={24}
          />
        </div>

        <dl className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-3">
          <div className="flex items-baseline gap-1.5">
            <dt className="eyebrow">{t("common.momentum7d")}</dt>
            <dd className="text-sm">
              <Delta value={row.momentum7d} />
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="eyebrow">{t("common.yoy")}</dt>
            <dd className="text-sm">
              <Delta value={row.yoyPct} suffix="%" decimals={0} />
            </dd>
          </div>
          <div className="ml-auto">
            <SourceDots count={row.sourceCount} total={row.sourceTotal} />
          </div>
        </dl>
      </Link>
    </li>
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
      className={`pr-4 pb-2 font-normal last:pr-0 ${align === "right" ? "text-right" : "text-left"} ${className}`}
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
