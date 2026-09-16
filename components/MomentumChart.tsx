"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import type { Forecast } from "@/lib/forecast";
import type { ChartRow } from "@/lib/origin";
import type { Lifecycle } from "@/lib/types";

type Point = { date: string; score: number };
type Row = {
  date: string;
  score: number | null;
  forecast: number | null;
  mock: number | null;
  real: number | null;
};

export function MomentumChart({
  series,
  lifecycle,
  forecast,
  split,
}: {
  series: Point[];
  lifecycle: Lifecycle;
  forecast?: Forecast | null;
  /** Corte mock→real. null cuando toda la serie tiene el mismo origen. */
  split?: { rows: ChartRow[]; firstRealDate: string } | null;
}) {
  const { t, lang } = useI18n();
  const color = LIFECYCLE_STYLES[lifecycle].hex;
  const locale = lang === "es" ? "es-ES" : "en-GB";

  const lastReal = series[series.length - 1];

  /**
   * Histórico y estimación en el mismo eje, en columnas distintas. El último
   * día real lleva también valor de estimación para que la punteada arranque
   * pegada a la línea y no flotando.
   */
  const byDate = new Map(split?.rows.map((row) => [row.date, row]) ?? []);

  const rows: Row[] = [
    ...series.map((point, index) => {
      const partido = byDate.get(point.date);
      return {
        date: point.date,
        // Con corte, la serie se dibuja en dos columnas en vez de una.
        score: split ? null : point.score,
        mock: partido?.mock ?? null,
        real: partido?.real ?? null,
        forecast: forecast && index === series.length - 1 ? point.score : null,
      };
    }),
    ...(forecast?.points ?? []).map((point) => ({
      date: point.date,
      score: null,
      mock: null,
      real: null,
      forecast: point.forecast,
    })),
  ];

  // Dominio redondeado a múltiplos de 5 para que las marcas del eje queden parejas.
  const scores = [
    ...series.map((point) => point.score),
    ...(forecast?.points ?? []).map((point) => point.forecast),
  ];
  const min = Math.max(0, Math.floor((Math.min(...scores) - 4) / 5) * 5);
  const max = Math.min(100, Math.ceil((Math.max(...scores) + 4) / 5) * 5);

  const formatDate = (value: string, long = false) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: long ? "long" : "short",
      timeZone: "UTC",
    });

  return (
    <div className="w-full">
      {split ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span
            className="inline-block h-0.5 w-5 opacity-35"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {t("origin.mockSegment")}
          <span className="text-faint">·</span>
          {t("origin.realSince")}{" "}
          <span className="text-ink-soft">
            {formatDate(split.firstRealDate, true)}
          </span>
        </p>
      ) : null}
      {forecast ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span
            className="inline-block h-0 w-5 border-t border-dashed"
            style={{ borderColor: color }}
            aria-hidden
          />
          {t("detail.forecast")}
          <span className="tabular text-ink-soft">
            {forecast.target.toFixed(1)}
          </span>
          <span className="text-faint">·</span>
          <span className="text-faint">{t("detail.forecastNote")}</span>
        </p>
      ) : null}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <defs>
              <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
                const row = payload[0].payload as Row;
                const medido = row.score ?? row.real ?? row.mock;
                const isForecast = medido === null || medido === undefined;
                const value = isForecast ? row.forecast : medido;
                if (value === null || value === undefined) return null;
                return (
                  <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs shadow-sm">
                    <p className="text-muted">
                      {formatDate(String(label), true)}
                    </p>
                    <p className="tabular mt-0.5 text-sm font-medium text-ink">
                      {value.toFixed(1)}
                    </p>
                    {isForecast ? (
                      <p className="mt-0.5 text-[11px] text-faint">
                        {t("detail.forecast")}
                      </p>
                    ) : row.mock !== null && row.real === null ? (
                      <p className="mt-0.5 text-[11px] text-faint">
                        {t("origin.mockPoint")}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            {split ? (
              <>
                {/* Tramo mock: mismo trazo, atenuado. No es otro dato, es el
                      mismo dato medido de otra manera. */}
                <Area
                  type="monotone"
                  dataKey="mock"
                  stroke={color}
                  strokeOpacity={0.35}
                  strokeWidth={1.75}
                  fill="url(#scoreFill)"
                  fillOpacity={0.4}
                  dot={false}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="real"
                  stroke={color}
                  strokeWidth={1.75}
                  fill="url(#scoreFill)"
                  dot={false}
                  connectNulls={false}
                />
                <ReferenceLine
                  x={split.firstRealDate}
                  stroke="#dcd6e3"
                  strokeDasharray="2 3"
                />
              </>
            ) : null}
            <Area
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={1.75}
              fill="url(#scoreFill)"
              dot={false}
              activeDot={{
                r: 3.5,
                fill: color,
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
              connectNulls={false}
            />
            {forecast ? (
              <>
                {/* Marca dónde acaba lo medido y empieza lo estimado. */}
                <ReferenceLine
                  x={lastReal.date}
                  stroke="#dcd6e3"
                  strokeDasharray="2 3"
                />
                <Line
                  type="linear"
                  dataKey="forecast"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{
                    r: 3.5,
                    fill: "#ffffff",
                    stroke: color,
                    strokeWidth: 2,
                  }}
                  connectNulls
                />
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
