"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { LIFECYCLE_STYLES } from "@/lib/lifecycle";
import type { Lifecycle } from "@/lib/types";

type Point = { date: string; score: number };

export function MomentumChart({
  series,
  lifecycle,
}: {
  series: Point[];
  lifecycle: Lifecycle;
}) {
  const { lang } = useI18n();
  const color = LIFECYCLE_STYLES[lifecycle].hex;
  const locale = lang === "es" ? "es-ES" : "en-GB";

  // Dominio redondeado a múltiplos de 5 para que las marcas del eje queden parejas.
  const scores = series.map((point) => point.score);
  const min = Math.max(0, Math.floor((Math.min(...scores) - 4) / 5) * 5);
  const max = Math.min(100, Math.ceil((Math.max(...scores) + 4) / 5) * 5);

  const formatDate = (value: string, long = false) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: long ? "long" : "short",
      timeZone: "UTC",
    });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={series}
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
              return (
                <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs shadow-sm">
                  <p className="text-muted">{formatDate(String(label), true)}</p>
                  <p className="tabular mt-0.5 text-sm font-medium text-ink">
                    {Number(payload[0].value).toFixed(1)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={1.75}
            fill="url(#scoreFill)"
            dot={false}
            activeDot={{ r: 3.5, fill: color, stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
