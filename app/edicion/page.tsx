import { EdicionView } from "@/components/EdicionView";
import { currentEdicionDate, getEdicion, listEdiciones } from "@/lib/edicion";
import { getCatalog } from "@/lib/trends";
import { edicionInsight } from "@/lib/insights";

export const metadata = { title: "Edición semanal — Style Reverie" };

export default async function EdicionPage() {
  const { trends } = await getCatalog();
  const date = currentEdicionDate(trends);
  const edicion = getEdicion(date, trends)!;

  return (
    <EdicionView
      edicion={edicion}
      archive={listEdiciones(trends)}
      isCurrent
      insight={edicionInsight(edicion.picks)}
    />
  );
}
