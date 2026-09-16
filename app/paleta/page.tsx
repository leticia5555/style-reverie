import { PaletaView } from "@/components/PaletaView";
import { paletaInsight } from "@/lib/insights";
import { getPaleta, getSeasonPalette } from "@/lib/paleta";
import { getCatalog } from "@/lib/trends";

/**
 * Lee el catálogo de Postgres, que el cron reescribe cada día. Sin esto la
 * página se congelaba en el build y no volvía a cambiar nunca: el deploy
 * pasaba a ser la única forma de ver dato nuevo.
 */
export const revalidate = 300;

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
