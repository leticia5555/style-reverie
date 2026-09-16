import { EdicionView } from "@/components/EdicionView";
import { currentEdicionDate, getEdicion } from "@/lib/edicion";
import { getDb } from "@/lib/db/client";
import { listArchive } from "@/lib/edicion-archive";
import { getCatalog } from "@/lib/trends";
import { edicionInsight } from "@/lib/insights";

export const metadata = { title: "Edición semanal — Style Reverie" };

export default async function EdicionPage() {
  const { trends } = await getCatalog();
  // La edición en curso siempre se calcula en vivo; las pasadas se leen
  // congeladas desde la base.
  const date = currentEdicionDate(trends);
  const edicion = getEdicion(date, trends)!;
  const archive = await listArchive(getDb(), trends);

  return (
    <EdicionView
      edicion={edicion}
      archive={archive}
      isCurrent
      insight={edicionInsight(edicion.picks)}
    />
  );
}
