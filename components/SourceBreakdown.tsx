"use client";

import { Delta } from "@/components/Delta";
import { useI18n } from "@/lib/i18n";
import type { SourceBreakdownRow } from "@/lib/scoring";

export function SourceBreakdown({
  rows,
  score,
}: {
  rows: SourceBreakdownRow[];
  score: number;
}) {
  const { t } = useI18n();
  const maxContribution = Math.max(...rows.map((row) => row.contribution));

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line-strong text-left">
          <th scope="col" className="eyebrow pb-2 font-normal">
            {t("detail.source")}
          </th>
          <th scope="col" className="eyebrow pb-2 text-right font-normal">
            {t("detail.signal")}
          </th>
          <th scope="col" className="eyebrow pb-2 text-right font-normal">
            {t("detail.change7d")}
          </th>
          <th scope="col" className="eyebrow pb-2 text-right font-normal">
            {t("detail.weight")}
          </th>
          <th scope="col" className="eyebrow pb-2 text-right font-normal">
            {t("detail.contribution")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.source} className="border-b border-line last:border-0">
            <td className="py-2.5 pr-4">
              <span className="text-ink">{t(`source.${row.source}`)}</span>
              <span className="mt-1 block h-1 w-full max-w-40 rounded-full bg-line">
                <span
                  className="block h-1 rounded-full bg-lavender"
                  style={{
                    width: `${(row.contribution / maxContribution) * 100}%`,
                  }}
                />
              </span>
            </td>
            <td className="tabular py-2.5 pr-4 text-right text-ink">
              {row.value.toFixed(1)}
            </td>
            <td className="py-2.5 pr-4 text-right">
              <Delta value={row.change7d} />
            </td>
            <td className="tabular py-2.5 pr-4 text-right text-muted">
              {Math.round(row.weight * 100)}%
            </td>
            <td className="tabular py-2.5 text-right font-medium text-ink">
              {row.contribution.toFixed(1)}
            </td>
          </tr>
        ))}
        <tr>
          <td className="eyebrow py-2.5" colSpan={4}>
            {t("common.score")}
          </td>
          <td className="tabular py-2.5 text-right text-base font-medium text-ink">
            {score.toFixed(1)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
