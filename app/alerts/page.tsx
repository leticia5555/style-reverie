import { AlertsView } from "@/components/AlertsView";
import { isAdminSession } from "@/lib/admin-session";
import { trendImages } from "@/lib/trend-image";
import { getDb } from "@/lib/db/client";
import { alertsInsight } from "@/lib/insights";
import { listCandidates } from "@/lib/sources/discovery";
import {
  ALERT_MAX_SCORE,
  ALERT_MIN_MOMENTUM,
  getAlerts,
  getCatalog,
  getTrendSummaries,
} from "@/lib/trends";

export const metadata = {
  title: "Alertas de emergentes — Style Reverie",
};

/**
 * Esta página se servía prerenderizada desde el build, y las candidatas salen
 * de la base: una corrida de descubrimiento escribía 25 filas y la página
 * seguía enseñando las de la última vez que se compiló, sin forma de notarlo.
 *
 * Va dinámica y no con revalidate porque es la superficie de diagnóstico: uno
 * corre /api/admin/discover y entra aquí a ver qué salió. Con ISR habría que
 * cargar dos veces y esperar la ventana, que es justo la confusión que
 * provocó esto.
 */
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { trends } = await getCatalog();
  const alerts = getAlerts(trends);

  // Sin base o con la tabla recién creada, la sección simplemente no aparece.
  const db = getDb();
  const candidates = db ? await listCandidates(db).catch(() => []) : [];
  const admin = await isAdminSession();

  /**
   * Las que suben y siguen por debajo de 60 pero aún no llegan al umbral de
   * momentum. Van aparte y en segundo plano: la alerta es la regla, esto es
   * el contexto de lo que está a punto de entrar.
   */
  const watchlist = getTrendSummaries(trends)
    .filter(
      (row) =>
        row.score < ALERT_MAX_SCORE &&
        row.momentum7d > 0 &&
        row.momentum7d < ALERT_MIN_MOMENTUM,
    )
    .sort((a, b) => b.momentum7d - a.momentum7d);

  const images = Object.fromEntries(
    await trendImages([...alerts.map((a) => a.id), ...watchlist.map((w) => w.id)]),
  );

  return (
    <AlertsView
      alerts={alerts}
      watchlist={watchlist}
      insight={alertsInsight(trends)}
      candidates={candidates}
      isAdmin={admin}
      images={images}
    />
  );
}
