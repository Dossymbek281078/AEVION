import pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let pool: PgPoolInstance | null = null;

/** Единый пул Postgres для всех роутов (меньше соединений, проще отладка). */
export function getPool(): PgPoolInstance {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Short timeout so the store can flip to in-memory quickly when the
      // DB is down — avoids blocking /health and first /multi-agent for tens
      // of seconds.
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000,
    });
    // Prevent unhandled rejections when PG is unreachable / auth fails —
    // the store layer observes failures via ensureQCoreTables instead.
    pool.on("error", (err: Error) => {
      console.warn("[pg pool] idle client error:", err?.message || err);
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
