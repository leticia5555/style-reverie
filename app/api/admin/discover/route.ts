import { NextResponse } from "next/server";
import { authorizeOps } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { finishRun, startRun } from "@/lib/db/runs";
import { getEditorial } from "@/lib/editorial";
import { getCatalog } from "@/lib/trends";
import {
  describeStats,
  discoverCandidates,
  saveCandidates,
} from "@/lib/sources/discovery";

export const dynamic = "force-dynamic";
/** Varias tandas contra el modelo no caben en el límite por defecto. */
export const maxDuration = 300;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Corre SOLO el descubrimiento y devuelve su desglose.
 *
 * Existe para poder probarlo sin esperar al cron de las 9. Hace exactamente lo
 * mismo que el paso del cron —mismo filtro, mismas tandas, misma escritura en
 * trend_candidates y en signal_runs— así que lo que se vea aquí es lo que va a
 * pasar mañana, no una simulación.
 *
 * No sale a buscar titulares: lee el caché editorial, como manda la regla de
 * que ninguna fuente externa se llama en el camino del usuario. Si el caché
 * está viejo, `getEditorial` lo refresca por su cuenta.
 *
 * Se autoriza con CRON_SECRET, por cabecera o por ?secret= en la URL.
 */
export async function GET(request: Request) {
  const auth = authorizeOps(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "falta DATABASE_URL" }, { status: 503 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? today();
  const startedAt = Date.now();
  // Se marca como "discover" y no como "discovery": en la bitácora tiene que
  // distinguirse una prueba a mano de lo que hizo el cron por su cuenta.
  const runId = await startRun(db, "discover-manual");

  try {
    const cache = await getEditorial();
    const { trends, accumulating } = await getCatalog();
    const headlines = cache.articles.map((article) => ({
      id: article.id,
      title: article.title,
      snippet: article.snippet,
      sourceName: article.sourceName,
      link: article.link,
      publishedAt: article.publishedAt,
    }));

    const result = await discoverCandidates(headlines, [...trends, ...accumulating]);
    const breakdown = describeStats(result.stats);

    if (result.status !== "ok") {
      await finishRun(db, runId, result.status, 0, `${result.reason} · ${breakdown}`);
      return NextResponse.json(
        {
          status: result.status,
          reason: result.reason,
          breakdown,
          stats: result.stats,
          durationMs: Date.now() - startedAt,
        },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }

    const saved = await saveCandidates(db, result.candidates, date);
    await finishRun(
      db,
      runId,
      "ok",
      saved,
      result.reason ? `${breakdown} · ${result.reason}` : breakdown,
    );

    return NextResponse.json(
      {
        status: "ok",
        date,
        saved,
        breakdown,
        stats: result.stats,
        ...(result.reason ? { reason: result.reason } : {}),
        // Las candidatas de esta corrida, para poder juzgar la extracción sin
        // abrir /alerts: es lo que uno quiere ver al probar el prompt.
        candidates: result.candidates.map((candidate) => ({
          slug: candidate.slug,
          nameEs: candidate.nameEs,
          category: candidate.category,
          evidence: candidate.evidence,
        })),
        durationMs: Date.now() - startedAt,
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await finishRun(db, runId, "error", 0, detail);
    return NextResponse.json(
      { status: "error", error: detail, durationMs: Date.now() - startedAt },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
