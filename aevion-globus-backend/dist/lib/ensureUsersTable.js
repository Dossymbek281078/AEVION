"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUsersTable = ensureUsersTable;
let ensuredUsersTable = false;
async function ensureUsersTable(pool) {
    if (ensuredUsersTable)
        return;
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
