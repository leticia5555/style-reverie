import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OcasionView } from "@/components/OcasionView";
import { getOcasion, ocasionSlugs } from "@/lib/ocasiones";

export function generateStaticParams() {
  return ocasionSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/ocasiones/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const ocasion = getOcasion(slug);
  return {
    title: ocasion ? `${ocasion.name.es} — Style Reverie` : "Style Reverie",
    description: ocasion?.tagline.es,
  };
}

export default async function OcasionPage({
  params,
}: PageProps<"/ocasiones/[slug]">) {
  const { slug } = await params;
  const ocasion = getOcasion(slug);
  if (!ocasion) notFound();

  return <OcasionView ocasion={ocasion} />;
}
