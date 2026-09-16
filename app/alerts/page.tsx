import { AlertsView } from "@/components/AlertsView";
import {
  ALERT_MAX_SCORE,
  ALERT_MIN_MOMENTUM,
  getAlerts,
  getTrendSummaries,
} from "@/lib/trends";

export const metadata = {
  title: "Alertas de emergentes — Style Reverie",
};

export default function AlertsPage() {
  const alerts = getAlerts();

  /**
   * Las que suben y siguen por debajo de 60 pero aún no llegan al umbral de
   * momentum. Van aparte y en segundo plano: la alerta es la regla, esto es
   * el contexto de lo que está a punto de entrar.
   */
  const watchlist = getTrendSummaries()
    .filter(
      (row) =>
        row.score < ALERT_MAX_SCORE &&
        row.momentum7d > 0 &&
        row.momentum7d < ALERT_MIN_MOMENTUM,
    )
    .sort((a, b) => b.momentum7d - a.momentum7d);

  return <AlertsView alerts={alerts} watchlist={watchlist} />;
}
