"use client";

import type { ReactNode } from "react";

/**
 * Estado vacío con forma, no un hueco con texto centrado. Lleva un bloque
 * pastel que ocupa el sitio del contenido que falta, para que la página no
 * parezca rota mientras no hay nada que enseñar.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <span
        className="mx-auto flex h-16 w-24 items-end gap-1 overflow-hidden rounded-lg"
        aria-hidden
      >
        {[0.35, 0.6, 0.45, 0.8, 0.55].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-t-sm bg-lavender-soft"
            style={{ height: `${height * 100}%` }}
          />
        ))}
      </span>
      <p className="mt-5 text-sm text-ink-soft">{title}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
