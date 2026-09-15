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
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow w-full sm:w-auto">{label}</span>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
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
  );
}
