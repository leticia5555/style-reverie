"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrendPhoto } from "@/components/TrendPhoto";
import { useI18n } from "@/lib/i18n";
import type { TrendImage } from "@/lib/trend-image";
import type { Category, Localized } from "@/lib/types";

export type CuratorRow = {
  id: string;
  name: Localized;
  category: Category;
  swatch?: string;
  /** Lo que se ve hoy en la app: curada, del feed, o nada. */
  current: TrendImage | null;
};

/**
 * Curar la foto de una tendencia sin editar JSON.
 *
 * El formulario guarda en la base, no en `content/`: ese directorio se lee
 * durante el build y en Vercel el disco es de solo lectura. El servidor pide
 * la URL antes de aceptarla y, si el host es nuevo, lo aprueba — las curadas
 * se sirven por /api/image, así que funciona el mismo día.
 */
function Row({ row }: { row: CuratorRow }) {
  const { t, pick } = useI18n();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [credit, setCredit] = useState("");
  const [creditUrl, setCreditUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const complete = url.trim() && credit.trim() && creditUrl.trim();

  async function send(action: "save" | "remove") {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "remove"
            ? { trendId: row.id, action: "remove" }
            : { trendId: row.id, imageUrl: url, credit, creditUrl },
        ),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        hostApproved?: boolean;
        host?: string;
      };
      if (!response.ok) {
        setError(body.error ?? t("curator.failed"));
        return;
      }
      if (body.hostApproved) {
        setNote(`${t("curator.hostApproved")} ${body.host}`);
      }
      setUrl("");
      setCredit("");
      setCreditUrl("");
      router.refresh();
    } catch {
      setError(t("curator.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-5 border-t border-line py-6 sm:grid-cols-[160px_minmax(0,1fr)]">
      <div>
        {/* Lo que se ve hoy, al tamaño en que se va a ver. */}
        <div className="relative aspect-4/5 w-full overflow-hidden rounded-sm">
          <TrendPhoto
            image={row.current}
            name={row.name}
            category={row.category}
            swatch={row.swatch}
            sizes="160px"
          />
        </div>
        <p className="eyebrow mt-2">
          {row.current
            ? row.current.from === "db"
              ? t("curator.fromPanel")
              : row.current.from === "curated"
                ? t("curator.fromContent")
                : t("curator.fromFeed")
            : t("curator.none")}
        </p>
      </div>

      <div className="min-w-0">
        <h3 className="font-serif text-2xl leading-tight text-ink">
          {pick(row.name)}
        </h3>
        <p className="eyebrow mt-1">
          {t(`category.${row.category}`)} · {row.id}
        </p>

        <div className="mt-4 space-y-2">
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t("curator.urlPlaceholder")}
            className="w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-lavender-ink"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={credit}
              onChange={(event) => setCredit(event.target.value)}
              placeholder={t("curator.creditPlaceholder")}
              className="w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-lavender-ink"
            />
            <input
              type="url"
              value={creditUrl}
              onChange={(event) => setCreditUrl(event.target.value)}
              placeholder={t("curator.creditUrlPlaceholder")}
              className="w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-lavender-ink"
            />
          </div>
        </div>

        {/* Vista previa en crudo: si no carga aquí, tampoco va a cargar allá. */}
        {url.trim() ? (
          <div className="mt-3 flex items-start gap-3">
            <span className="relative block h-24 w-20 shrink-0 overflow-hidden rounded-sm bg-quiet-soft">
              <Image
                src={`/api/image?src=${encodeURIComponent(url.trim())}`}
                alt=""
                fill
                sizes="80px"
                unoptimized
                className="object-cover"
              />
            </span>
            <p className="text-xs leading-relaxed text-muted">
              {t("curator.previewNote")}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => send("save")}
            disabled={busy || !complete}
            className="rounded-full border border-line-strong px-4 py-1.5 text-xs text-ink-soft hover:border-lavender-ink hover:text-lavender-ink disabled:opacity-50"
          >
            {busy ? t("curator.checking") : t("curator.save")}
          </button>
          {row.current?.from === "db" ? (
            <button
              type="button"
              onClick={() => send("remove")}
              disabled={busy}
              className="text-xs text-faint hover:text-rose-ink disabled:opacity-50"
            >
              {t("curator.remove")}
            </button>
          ) : null}
        </div>

        {error ? <p className="mt-2 text-xs text-rose-ink">{error}</p> : null}
        {note ? <p className="mt-2 text-xs text-sage-ink">{note}</p> : null}
      </div>
    </li>
  );
}

export function ImageCurator({
  rows,
  approvedHosts,
}: {
  rows: CuratorRow[];
  approvedHosts: string[];
}) {
  const { t } = useI18n();
  const [onlyMissing, setOnlyMissing] = useState(true);
  const missing = rows.filter((row) => !row.current);
  const visible = onlyMissing ? missing : rows;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">
          {missing.length} {t("curator.missing")} · {rows.length} {t("curator.total")}
        </p>
        <button
          type="button"
          onClick={() => setOnlyMissing(!onlyMissing)}
          className="text-xs text-lavender-ink underline-offset-2 hover:underline"
        >
          {onlyMissing ? t("curator.showAll") : t("curator.showMissing")}
        </button>
      </div>

      {approvedHosts.length ? (
        <p className="mt-2 text-xs text-muted">
          {t("curator.approvedHosts")}: {approvedHosts.join(" · ")}
        </p>
      ) : null}

      <ul className="mt-2">
        {visible.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </ul>

      {!visible.length ? (
        <p className="mt-8 text-sm text-muted">{t("curator.allDone")}</p>
      ) : null}
    </div>
  );
}
