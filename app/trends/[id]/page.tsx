export default async function TrendDetailPage({ params }: PageProps<"/trends/[id]">) {
  const { id } = await params;
  return <p className="text-muted">Detalle de {id} — en construcción.</p>;
}
