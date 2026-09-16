import { PaletaView } from "@/components/PaletaView";
import { paletaInsight } from "@/lib/insights";
import { getPaleta, getSeasonPalette } from "@/lib/paleta";
import { getCatalog } from "@/lib/trends";

export const metadata = { title: "Paleta de temporada — Style Reverie" };

export default async function PaletaPage() {
  const { trends } = await getCatalog();
  const entries = getPaleta(trends);
  return (
    <PaletaView
      entries={entries}
      insight={paletaInsight(trends)}
      season={getSeasonPalette(entries)}
    />
  );
}
