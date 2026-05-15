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
  // Additive migration: tokenVersion underpins "sign out everywhere".
  // Existing tokens stay valid (default 0); incrementing the column
  // server-side invalidates every JWT issued before the bump because
  // the verifier requires payload.tokenVersion === user.tokenVersion.
  await pool.query(`
    ALTER TABLE "AEVIONUser"
    ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0
  `);
  ensuredUsersTable = true;
}
