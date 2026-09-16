import { PaletaView } from "@/components/PaletaView";
import { paletaInsight } from "@/lib/insights";
import { getPaleta } from "@/lib/paleta";

export const metadata = { title: "Paleta de temporada — Style Reverie" };

export default function PaletaPage() {
  return <PaletaView entries={getPaleta()} insight={paletaInsight()} />;
}
