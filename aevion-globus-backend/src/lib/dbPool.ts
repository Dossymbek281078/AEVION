import pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let pool: PgPoolInstance | null = null;

/** Единый пул Postgres для всех роутов (меньше соединений, проще отладка). */
export function getPool(): PgPoolInstance {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    // Без этого обработчика падение idle-клиента превращается в
    // unhandledRejection, которое роняет процесс Node.
    pool.on("error", (err: Error) => {
      console.error(
        "[dbPool] idle client error:",
        err instanceof Error ? err.message : String(err),
      );
    });
  }
  return pool;
}
