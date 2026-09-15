import type { Lifecycle } from "@/lib/types";

/**
 * El ciclo de vida nunca se asigna a mano: se deriva del score compuesto
 * y del momentum de 7 días.
 */
export const LIFECYCLE_THRESHOLDS = {
  /** Debajo de este score una tendencia todavía es nicho. */
  emergingMaxScore: 60,
  /** Score de saturación: mucha gente ya la lleva. */
  peakMinScore: 72,
  /** Puntos de score en 7 días para considerarla en ascenso. */
  risingMomentum: 1.5,
  /** Puntos de score en 7 días para considerarla en caída. */
  fallingMomentum: -1.5,
} as const;

export function deriveLifecycle(score: number, momentum7d: number): Lifecycle {
  const { emergingMaxScore, peakMinScore, risingMomentum, fallingMomentum } =
    LIFECYCLE_THRESHOLDS;

  // Cae de forma sostenida: salió de moda, sin importar cuán alta esté.
  if (momentum7d <= fallingMomentum) return "CAYENDO";

  // Alta y ya sin impulso: saturada.
  if (score >= peakMinScore && momentum7d < risingMomentum) return "PICO";

  // Sube rápido: nicho si todavía es pequeña, en ascenso si ya es masiva.
  if (momentum7d >= risingMomentum) {
    return score < emergingMaxScore ? "EMERGIENDO" : "SUBIENDO";
  }

  // Sube despacio.
  if (momentum7d > 0) {
    return score < emergingMaxScore ? "EMERGIENDO" : "SUBIENDO";
  }

  // Plana o cediendo poco, sin llegar a saturación.
  return score < emergingMaxScore ? "EMERGIENDO" : "CAYENDO";
}

/** Clases de Tailwind por ciclo: sage, lavanda, rosa, gris. */
export const LIFECYCLE_STYLES: Record<
  Lifecycle,
  { badge: string; dot: string; hex: string; soft: string }
> = {
  EMERGIENDO: {
    badge: "border-sage bg-sage-soft text-sage-ink",
    dot: "bg-sage-ink",
    hex: "#4a6f4e",
    soft: "#e9f1e9",
  },
  SUBIENDO: {
    badge: "border-lavender bg-lavender-soft text-lavender-ink",
    dot: "bg-lavender-ink",
    hex: "#63509a",
    soft: "#efeaf9",
  },
  PICO: {
    badge: "border-rose bg-rose-soft text-rose-ink",
    dot: "bg-rose-ink",
    hex: "#a44f65",
    soft: "#fbedf1",
  },
  CAYENDO: {
    badge: "border-quiet bg-quiet-soft text-quiet-ink",
    dot: "bg-quiet-ink",
    hex: "#6a6472",
    soft: "#f2f0f4",
  },
};
