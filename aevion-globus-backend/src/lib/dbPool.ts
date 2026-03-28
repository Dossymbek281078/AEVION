import pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let pool: PgPoolInstance | null = null;

/** Единый пул Postgres для всех роутов (меньше соединений, проще отладка). */
export function getPool(): PgPoolInstance {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}
