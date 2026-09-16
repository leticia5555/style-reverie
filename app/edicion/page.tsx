import { trendImages } from "@/lib/trend-image";
import { EdicionView } from "@/components/EdicionView";
import { currentEdicionDate, getEdicion } from "@/lib/edicion";
import { getDb } from "@/lib/db/client";
import { listArchive } from "@/lib/edicion-archive";
import { getCatalog } from "@/lib/trends";
import { edicionInsight } from "@/lib/insights";

/**
 * Lee el catálogo de Postgres, que el cron reescribe cada día. Sin esto la
 * página se congelaba en el build y no volvía a cambiar nunca: el deploy
 * pasaba a ser la única forma de ver dato nuevo.
 */
export const revalidate = 300;

export const metadata = { title: "Edición semanal — Style Reverie" };

export default async function EdicionPage() {
  const { trends } = await getCatalog();
  // La edición en curso siempre se calcula en vivo; las pasadas se leen
  // congeladas desde la base.
  const date = currentEdicionDate(trends);
  const edicion = getEdicion(date, trends)!;
  const archive = await listArchive(getDb(), trends);

  const images = Object.fromEntries(
    trendImages(edicion.picks.map((pick) => pick.summary.id)),
  );

  return (
    <EdicionView
      images={images}
      edicion={edicion}
      archive={archive}
      isCurrent
      insight={edicionInsight(edicion.picks)}
    />
  );
}
