import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Db } from "@/lib/db/client";

/**
 * Migración, separada del cliente porque lee del disco. lib/db/client.ts lo
 * importa media app y tiene que quedarse sin dependencias de node:.
 */
export function readSchema(): string {
  return readFileSync(resolve(process.cwd(), "lib/db/schema.sql"), "utf8");
}

/**
 * Parte el esquema en sentencias sueltas. Ni Neon ni PGlite aceptan varias
 * sentencias en un mismo statement preparado, así que hay que mandarlas una a
 * una. Se quitan antes los comentarios de línea, que sí pueden llevar punto y
 * coma dentro.
 */
export function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Aplica el esquema. Es idempotente: todo es create ... if not exists. */
export async function migrate(db: Db): Promise<void> {
  for (const statement of splitStatements(readSchema())) {
    await db.query(statement);
  }
}
