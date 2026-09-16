import Link from "next/link";
import { AdminLogin } from "@/components/AdminLogin";
import { PageLede } from "@/components/PageLede";
import { isAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Style Reverie",
};

export default async function AdminPage() {
  const signedIn = await isAdminSession();

  return (
    <div className="mx-auto max-w-2xl">
      <PageLede titleKey="admin.title" subtitleKey="admin.subtitle" />
      <div className="mt-6">
        <AdminLogin
          signedIn={signedIn}
          configured={Boolean(process.env.ADMIN_PASSWORD)}
        />
      </div>

      {signedIn ? (
        <nav className="mt-6 border-t border-line pt-4">
          <Link
            href="/admin/imagenes"
            className="text-sm text-lavender-ink hover:underline"
          >
            Fotos de tendencias →
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
