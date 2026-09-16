import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Contenido curado que vive en el repo y que se edita a mano. Se lee con fs
 * durante el build: todas las páginas que lo consumen se prerenderizan, así que
 * cambiar un archivo de content/ implica un nuevo deploy — que es justo el
 * flujo que queremos, el contenido pasa por git.
 */
const CONTENT_DIR = resolve(process.cwd(), "content");

export function contentPath(...parts: string[]): string {
  return join(CONTENT_DIR, ...parts);
}

/** Nombres de archivo .json de una carpeta de content/, sin extensión. */
export function listContent(folder: string): string[] {
  try {
    return readdirSync(contentPath(folder))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}

/** Lee un JSON de content/. Devuelve null si no existe o está mal formado. */
export function readContent<T>(folder: string, name: string): T | null {
  try {
    return JSON.parse(
      readFileSync(contentPath(folder, `${name}.json`), "utf8"),
    ) as T;
  } catch {
    return null;
  }
}
