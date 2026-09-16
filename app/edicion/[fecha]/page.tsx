import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EdicionView } from "@/components/EdicionView";
import {
  currentEdicionDate,
  edicionDates,
  getEdicion,
  listEdiciones,
} from "@/lib/edicion";
import { edicionInsight } from "@/lib/insights";

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
  const edicion = getEdicion(fecha);
  if (!edicion) notFound();

  return (
    <EdicionView
      edicion={edicion}
      archive={listEdiciones()}
      isCurrent={fecha === currentEdicionDate()}
      insight={edicionInsight(edicion.picks)}
    />
  );
}
