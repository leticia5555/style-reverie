/**
 * Esqueletos de carga. Reproducen la forma real de cada página —cifras,
 * filas, tarjetas— para que el salto al contenido no mueva el layout.
 * Sin animación de brillo: el pulso basta y encaja con el tono editorial.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <span className={`block animate-pulse rounded bg-quiet-soft ${className}`} />
  );
}

export function LedeSkeleton({ figures = 4 }: { figures?: number }) {
  return (
    <div className="mb-8">
      <Bar className="h-9 w-64" />
      <Bar className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-y border-line py-5">
        {Array.from({ length: figures }).map((_, index) => (
          <div key={index}>
            <Bar className="h-8 w-12" />
            <Bar className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <Bar className="mt-4 h-6 w-80 max-w-full" />
    </div>
  );
}

export function RowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Bar className="h-4 flex-1" />
          <Bar className="h-4 w-12" />
          <Bar className="h-4 w-20" />
          <Bar className="hidden h-4 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="rounded-xl border border-line bg-surface p-5">
          <Bar className="h-6 w-40" />
          <Bar className="mt-3 h-3 w-full" />
          <Bar className="mt-2 h-3 w-4/5" />
          <Bar className="mt-4 h-2 w-full" />
        </div>
      ))}
    </div>
  );
}
