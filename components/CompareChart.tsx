"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";

/**
 * En el comparador el color identifica a la tendencia, no a su ciclo de vida:
 * si las dos estuvieran en el mismo ciclo, colorear por ciclo las volvería
 * indistinguibles. El ciclo se lee en el badge de cada columna.
 */
export const COMPARE_COLORS = { a: "#7a63b8", b: "#c0637f" } as const;

type Point = { date: string; a: number; b: number };

export function CompareChart({
  series,
  nameA,
  nameB,
}: {
  series: Point[];
  nameA: string;
  nameB: string;
}) {
  const { lang } = useI18n();
  const locale = lang === "es" ? "es-MX" : "en-US";

  const values = series.flatMap((point) => [point.a, point.b]);
  const min = Math.max(0, Math.floor((Math.min(...values) - 4) / 5) * 5);
  const max = Math.min(100, Math.ceil((Math.max(...values) + 4) / 5) * 5);

  const formatDate = (value: string, long = false) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: long ? "long" : "short",
      timeZone: "UTC",
    });

  return (
    <div className="w-full">
      {/* Leyenda propia: la de Recharts no deja fijar el orden A → B. */}
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        {[
          { name: nameA, color: COMPARE_COLORS.a },
          { name: nameB, color: COMPARE_COLORS.b },
        ].map((item) => (
          <li key={item.name} className="flex items-center gap-2">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            {item.name}
          </li>
        ))}
      </ul>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={series}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid stroke="#ecE9f0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatDate(value)}
              interval={14}
              tickLine={false}
              axisLine={{ stroke: "#ecE9f0" }}
              tick={{ fill: "#78727f", fontSize: 11 }}
              minTickGap={16}
            />
            <YAxis
              domain={[min, max]}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "#78727f", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: "#dcd6e3", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const a = Number(payload.find((p) => p.dataKey === "a")?.value);
                const b = Number(payload.find((p) => p.dataKey === "b")?.value);
                return (
                  <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs shadow-sm">
                    <p className="text-muted">
                      {formatDate(String(label), true)}
                    </p>
                    <dl className="mt-1.5 space-y-1">
                      {[
                        { name: nameA, value: a, color: COMPARE_COLORS.a },
                        { name: nameB, value: b, color: COMPARE_COLORS.b },
                      ].map((row) => (
                        <div key={row.name} className="flex items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                            aria-hidden
                          />
                          <dt className="max-w-40 truncate text-muted">
                            {row.name}
                          </dt>
                          <dd className="tabular ml-auto font-medium text-ink">
                            {row.value.toFixed(1)}
                          </dd>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 border-t border-line pt-1">
                        <dt className="text-faint">Δ</dt>
                        <dd className="tabular ml-auto text-ink-soft">
                          {Math.abs(a - b).toFixed(1)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="a"
              name={nameA}
              stroke={COMPARE_COLORS.a}
              strokeWidth={1.75}
              dot={false}
              activeDot={{
                r: 3.5,
                fill: COMPARE_COLORS.a,
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
            />
            <Line
              type="monotone"
              dataKey="b"
              name={nameB}
              stroke={COMPARE_COLORS.b}
              strokeWidth={1.75}
              dot={false}
              activeDot={{
                r: 3.5,
                fill: COMPARE_COLORS.b,
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
