import { EdicionView } from "@/components/EdicionView";
import { currentEdicionDate, getEdicion, listEdiciones } from "@/lib/edicion";
import { edicionInsight } from "@/lib/insights";

export const metadata = { title: "Edición semanal — Style Reverie" };

export default function EdicionPage() {
  const date = currentEdicionDate();
  const edicion = getEdicion(date)!;

  return (
    <EdicionView
      edicion={edicion}
      archive={listEdiciones()}
      isCurrent
      insight={edicionInsight(edicion.picks)}
    />
  );
}
