import { ocasionImages } from "@/lib/collection-image";
import { OcasionesIndex } from "@/components/OcasionesIndex";
import { ocasionesInsight } from "@/lib/insights";
import { listOcasiones } from "@/lib/ocasiones";

export const metadata = { title: "Ocasiones — Style Reverie" };

export default async function OcasionesPage() {
  const ocasiones = listOcasiones();
  const images = await ocasionImages(ocasiones);

  return (
    <OcasionesIndex
      images={images}
      ocasiones={ocasiones}
      insight={ocasionesInsight(ocasiones)}
    />
  );
}
