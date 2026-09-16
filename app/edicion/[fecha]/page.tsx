import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EdicionView } from "@/components/EdicionView";
import {
  currentEdicionDate,
  edicionDates,
} from "@/lib/edicion";
import { edicionInsight } from "@/lib/insights";
import { getDb } from "@/lib/db/client";
import { listArchive, resolveEdicion } from "@/lib/edicion-archive";
import { getCatalog } from "@/lib/trends";

export function generateStaticParams() {
  return edicionDates().map((fecha) => ({ fecha }));
}

export async function generateMetadata({
  params,
}: PageProps<"/edicion/[fecha]">): Promise<Metadata> {
  const { fecha } = await params;
  return { title: `Edición del ${fecha} — Style Reverie` };
}

export default async function EdicionArchivoPage({
  params,
}: PageProps<"/edicion/[fecha]">) {
  const { fecha } = await params;
  const { trends } = await getCatalog();
  const db = getDb();
  const resolved = await resolveEdicion(db, fecha, trends);
  if (!resolved) notFound();
  const { edicion } = resolved;
  const archive = await listArchive(db, trends);

  return (
    <EdicionView
      edicion={edicion}
      archive={archive}
      isCurrent={fecha === currentEdicionDate(trends)}
      insight={edicionInsight(edicion.picks)}
    />
  );
}
