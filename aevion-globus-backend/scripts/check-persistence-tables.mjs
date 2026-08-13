#!/usr/bin/env node
/**
 * Что лежит в базе после переноса — только чтение.
 *
 * Отвечает на вопрос, который диагностическая ручка не закрывает: она говорит
 * «подключились», а этот скрипт показывает, появились ли таблицы и сколько в
 * них строк. Ни одной операции записи здесь нет.
 *
 * Запуск:
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" node scripts/check-persistence-tables.mjs'
 */

import pg from "pg";

const TABLES = ["CyberTournament", "CyberDailyEntry", "CyberWallet", "CyberWalletAward", "CyberRating", "CyberMatch"];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан");
    process.exit(2);
  }
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  await c.connect();

  const found = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`,
    [TABLES],
  );
  const names = found.rows.map((r) => r.table_name);

  console.log("\nТаблицы шахматного хранилища в базе:\n");
  for (const t of TABLES) {
    if (!names.includes(t)) {
      console.log(`  —  ${t}: нет`);
      continue;
    }
    const n = await c.query(`SELECT count(*)::int AS n FROM "${t}"`);
    console.log(`  ✓  ${t}: строк ${n.rows[0].n}`);
  }

  await c.end();
  console.log("");
}

main().catch((e) => {
  console.error("не удалось:", e.message);
  process.exit(1);
});
