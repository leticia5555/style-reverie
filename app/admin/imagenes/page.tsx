import Link from "next/link";
import { ImageCurator, type CuratorRow } from "@/components/ImageCurator";
import { PageLede } from "@/components/PageLede";
import { isAdminSession } from "@/lib/admin-session";
import { listApprovedHosts } from "@/lib/curated-images";
import { getDb } from "@/lib/db/client";
import { getCatalog } from "@/lib/trends";
import { trendImages } from "@/lib/trend-image";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fotos de tendencias — Style Reverie" };

export default async function ImagenesPage() {
  const admin = await isAdminSession();
  if (!admin) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageLede titleKey="curator.title" subtitleKey="curator.subtitle" />
        <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm text-ink-soft">
          <Link href="/admin" className="text-lavender-ink hover:underline">
            /admin
          </Link>
        </p>
      </div>
    );
  }

  const { trends, accumulating } = await getCatalog();
  // Las promovidas también necesitan foto, y son las que más la necesitan:
  // llegan al catálogo sin nada.
  const all = [
    ...accumulating.map((trend) => ({
      id: trend.id,
      name: trend.name,
      category: trend.category,
      swatch: undefined as string | undefined,
    })),
    ...trends.map((trend) => ({
      id: trend.id,
      name: trend.name,
      category: trend.category,
      swatch: trend.swatch,
    })),
  ];

  const images = await trendImages(all.map((trend) => trend.id));
  const db = getDb();
  const approvedHosts = db ? await listApprovedHosts(db).catch(() => []) : [];

  const rows: CuratorRow[] = all.map((trend) => ({
    ...trend,
    current: images.get(trend.id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <PageLede titleKey="curator.title" subtitleKey="curator.subtitle" />
      <ImageCurator rows={rows} approvedHosts={approvedHosts} />
    </div>
  );
}
