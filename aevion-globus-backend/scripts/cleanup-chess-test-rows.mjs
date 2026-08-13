#!/usr/bin/env node
/**
 * Уборка синтетических строк из шахматных таблиц прода.
 *
 * ЗАЧЕМ. 13.08.2026 на публичной Chessy-таблице первыми двумя строками стояли
 * `WalletProd1` и `WalletProd2` — следы проверки выплат, сделанной прямо на
 * боевой базе 17 июля. Рядом нашлись их рейтинги и партия, а также «активная»
 * партия `prodcheck_*` от 16 июля, которая так и висит незакрытой месяц.
 * Настоящих игроков среди них нет ни одного.
 *
 * КАК УСТРОЕНО, чтобы не задеть живое:
 *   * удаляются ТОЛЬКО перечисленные ниже идентификаторы, никаких шаблонов
 *     вроде `LIKE 'test%'` — под такой шаблон однажды попадёт живой человек;
 *   * по умолчанию СУХОЙ ПРОГОН: показывает, что нашёл, и ничего не трогает;
 *   * удаление только с флагом --apply и внутри транзакции;
 *   * после удаления печатает остаток по каждой таблице.
 *
 * Запуск:
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" node scripts/cleanup-chess-test-rows.mjs'
 *   ... то же с --apply, чтобы удалить
 */

import pg from "pg";

const TEST_USERS = ["wprod_p1", "wprod_p2", "prodcheck_p1", "prodcheck_p2"];
const APPLY = process.argv.includes("--apply");

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
await c.connect();

const plan = [
  { table: "CyberWallet", where: `"userId" = ANY($1)`, params: [TEST_USERS] },
  { table: "CyberRating", where: `"userId" = ANY($1)`, params: [TEST_USERS] },
  { table: "CyberWalletAward", where: `"userId" = ANY($1)`, params: [TEST_USERS] },
  { table: "CyberMatch", where: `"whiteUserId" = ANY($1) OR "blackUserId" = ANY($1)`, params: [TEST_USERS] },
];

console.log(`\n${APPLY ? "УДАЛЕНИЕ" : "СУХОЙ ПРОГОН"} — синтетические строки: ${TEST_USERS.join(", ")}\n`);

let total = 0;
for (const p of plan) {
  const r = await c.query(`SELECT count(*)::int AS n FROM "${p.table}" WHERE ${p.where}`, p.params);
  total += r.rows[0].n;
  console.log(`  ${p.table}: подходит ${r.rows[0].n}`);
}

if (!APPLY) {
  console.log(`\nВсего к удалению: ${total}. Ничего не тронуто — запустите с --apply.\n`);
  await c.end();
  process.exit(0);
}

await c.query("BEGIN");
try {
  for (const p of plan) {
    const r = await c.query(`DELETE FROM "${p.table}" WHERE ${p.where}`, p.params);
    console.log(`  ${p.table}: удалено ${r.rowCount}`);
  }
  await c.query("COMMIT");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("откат, ничего не удалено:", e.message);
  await c.end();
  process.exit(1);
}

console.log("\nОстаток в таблицах:");
for (const t of ["CyberWallet", "CyberRating", "CyberWalletAward", "CyberMatch", "CyberTournament", "CyberDailyEntry"]) {
  const r = await c.query(`SELECT count(*)::int AS n FROM "${t}"`);
  console.log(`  ${t}: ${r.rows[0].n}`);
}
await c.end();
console.log("");
