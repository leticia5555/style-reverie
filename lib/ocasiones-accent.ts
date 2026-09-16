/**
 * Estilos del pastel de cada ocasión. Va en su propio módulo, sin dependencias
 * de node: lib/ocasiones.ts lee archivos con fs y los componentes cliente
 * necesitan estos estilos como valor, no como tipo — importarlos desde allí
 * arrastraba node:fs al bundle del navegador y rompía el build.
 */
export const ACCENTS = ["lavender", "rose", "sage", "cream", "quiet"] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_STYLE: Record<Accent, { chip: string; bar: string }> = {
  lavender: {
    chip: "border-lavender bg-lavender-soft text-lavender-ink",
    bar: "bg-lavender",
  },
  rose: { chip: "border-rose bg-rose-soft text-rose-ink", bar: "bg-rose" },
  sage: { chip: "border-sage bg-sage-soft text-sage-ink", bar: "bg-sage" },
  cream: { chip: "border-cream bg-cream-soft text-cream-ink", bar: "bg-cream" },
  quiet: { chip: "border-quiet bg-quiet-soft text-quiet-ink", bar: "bg-quiet" },
};
