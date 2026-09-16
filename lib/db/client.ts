import { Pool } from "@neondatabase/serverless";

/**
 * Interfaz mínima de base de datos. La implementación real es Neon en
 * producción, pero los tests inyectan PGlite —Postgres compilado a wasm— para
 * correr el esquema y las consultas de verdad sin depender de la red.
 */
export type Db = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
};

let override: Db | null = null;
let cached: Db | null | undefined;

/** Los tests inyectan aquí su PGlite. */
export function setDb(db: Db | null): void {
  override = db;
  cached = undefined;
}

/**
 * Devuelve el cliente, o null si no hay DATABASE_URL. Null no es un error: es
 * la señal de que hay que caer al seed en JSON.
 */
export function getDb(): Db | null {
  if (override) return override;
  if (cached !== undefined) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    cached = null;
    return null;
  }

  const pool = new Pool({ connectionString: url });

  cached = {
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    },
  };
  return cached;
}
