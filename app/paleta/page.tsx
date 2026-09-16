import { PaletaView } from "@/components/PaletaView";
import { paletaInsight } from "@/lib/insights";
import { getPaleta } from "@/lib/paleta";
import { getCatalog } from "@/lib/trends";

export const metadata = { title: "Paleta de temporada — Style Reverie" };

export default async function PaletaPage() {
  const { trends } = await getCatalog();
  return (
    <PaletaView entries={getPaleta(trends)} insight={paletaInsight(trends)} />
  );
}
