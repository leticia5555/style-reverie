"use client";

import { useI18n } from "@/lib/i18n";
import { CATEGORIES, type Category, type Localized } from "@/lib/types";

export type PickerOption = {
  id: string;
  name: Localized;
  category: Category;
  score: number;
};

/**
 * Select nativo agrupado por categoría. Con 25 opciones un combobox propio no
 * aporta nada y sí cuesta accesibilidad y teclado.
 */
export function TrendPicker({
  label,
  value,
  options,
  accent,
  onChange,
}: {
  label: string;
  value: string;
  options: PickerOption[];
  accent: string;
  onChange: (id: string) => void;
}) {
  const { t, pick } = useI18n();

  return (
    <label className="block">
      <span className="eyebrow flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-line-strong bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-lavender focus:ring-2 focus:ring-lavender-soft"
      >
        {CATEGORIES.map((category) => {
          const group = options.filter((item) => item.category === category);
          if (!group.length) return null;
          return (
            <optgroup key={category} label={t(`category.${category}`)}>
              {group.map((item) => (
                <option key={item.id} value={item.id}>
                  {pick(item.name)} · {item.score.toFixed(1)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </label>
  );
}
