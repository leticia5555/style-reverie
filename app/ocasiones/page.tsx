import { OcasionesIndex } from "@/components/OcasionesIndex";
import { listOcasiones } from "@/lib/ocasiones";

export const metadata = { title: "Ocasiones — Style Reverie" };

export default function OcasionesPage() {
  return <OcasionesIndex ocasiones={listOcasiones()} />;
}
