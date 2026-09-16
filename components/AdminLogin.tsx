"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * Entrada de admin. Una contraseña, la que está en ADMIN_PASSWORD.
 *
 * El formulario manda la contraseña una vez y el servidor devuelve la cookie;
 * la contraseña no se guarda en ningún sitio del navegador.
 */
export function AdminLogin({
  signedIn,
  configured,
}: {
  signedIn: boolean;
  configured: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t("admin.wrong"));
        return;
      }
      setPassword("");
      router.refresh();
    } catch {
      setError(t("admin.wrong"));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await fetch("/api/admin/login", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!configured) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-soft">
        {t("admin.notConfigured")}
      </p>
    );
  }

  if (signedIn) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-ink">{t("admin.signedIn")}</p>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="mt-3 rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:border-lavender-ink hover:text-lavender-ink disabled:opacity-50"
        >
          {t("admin.signOut")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-4">
      <label htmlFor="admin-password" className="eyebrow block">
        {t("admin.password")}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-w-0 flex-1 rounded-full border border-line-strong bg-canvas px-4 py-2 text-sm text-ink outline-none focus:border-lavender-ink"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-full border border-line-strong px-4 py-2 text-xs text-ink-soft hover:border-lavender-ink hover:text-lavender-ink disabled:opacity-50"
        >
          {t("admin.signIn")}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-ink">{error}</p> : null}
    </form>
  );
}
