"use client";

type Option<T extends string> = { value: T | "all"; label: string };

export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T | "all";
  onChange: (next: T | "all") => void;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="eyebrow shrink-0 pt-1">{label}</span>
      {/*
        En móvil los chips van en una tira desplazable en vez de envolver: con
        siete categorías y cinco ciclos, envolver comía media pantalla antes de
        llegar al primer dato. En pantalla ancha vuelven a envolver.
      */}
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-ink bg-ink text-canvas"
                  : "border-line-strong bg-canvas text-ink-soft hover:border-lavender hover:text-lavender-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
