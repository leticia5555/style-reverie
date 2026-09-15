import type { ReactNode } from "react";

export function StatTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-lg font-medium text-ink">{children}</p>
    </div>
  );
}
