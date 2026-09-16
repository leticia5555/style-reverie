import { EdicionView } from "@/components/EdicionView";
import { currentEdicionDate, getEdicion, listEdiciones } from "@/lib/edicion";

export const metadata = { title: "Edición semanal — Style Reverie" };

export default function EdicionPage() {
  const date = currentEdicionDate();
  const edicion = getEdicion(date)!;

  return (
    <EdicionView edicion={edicion} archive={listEdiciones()} isCurrent />
  );
}
