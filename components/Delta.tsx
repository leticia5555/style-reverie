/** Variación con signo: sage si sube, rosa oscuro si baja, gris si es plana. */
export function Delta({
  value,
  suffix = "",
  decimals = 1,
  className = "",
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const tone =
    value > 0.05
      ? "text-sage-ink"
      : value < -0.05
        ? "text-rose-ink"
        : "text-muted";
  const sign = value > 0.05 ? "+" : "";

  return (
    <span className={`tabular ${tone} ${className}`}>
      {sign}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
