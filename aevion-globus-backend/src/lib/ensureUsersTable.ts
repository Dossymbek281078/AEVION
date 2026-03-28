/** Structural type: avoids TS2709 with some `pg` typings where `Pool` is namespace-only. */
export type PgPoolLike = { query: (text: string, values?: unknown[]) => Promise<unknown> };

let ensuredUsersTable = false;

export async function ensureUsersTable(pool: PgPoolLike) {
  if (ensuredUsersTable) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AEVIONUser" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  ensuredUsersTable = true;
}
