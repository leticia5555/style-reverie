import { OcasionesIndex } from "@/components/OcasionesIndex";
import { ocasionesInsight } from "@/lib/insights";
import { listOcasiones } from "@/lib/ocasiones";

export const metadata = { title: "Ocasiones — Style Reverie" };

export default function OcasionesPage() {
  const ocasiones = listOcasiones();
  return (
    <OcasionesIndex
      ocasiones={ocasiones}
      insight={ocasionesInsight(ocasiones)}
    />
  );
}
