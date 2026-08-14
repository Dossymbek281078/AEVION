#!/usr/bin/env node
/** Что именно лежит в шахматных таблицах — только чтение, для решения об уборке. */
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
await c.connect();

const show = async (label, sql) => {
  const r = await c.query(sql);
  console.log(`\n${label} (${r.rows.length}):`);
  for (const row of r.rows) console.log("   ", JSON.stringify(row));
};

await show("CyberWallet", `SELECT "userId","displayName","balance","earnedTotal" FROM "CyberWallet" ORDER BY "balance" DESC`);
await show("CyberRating", `SELECT "userId","speed","rating","games","wins","losses","draws" FROM "CyberRating"`);
await show(
  "CyberMatch",
  `SELECT "id","whiteUserId","blackUserId","status","result","createdAt" FROM "CyberMatch" ORDER BY "createdAt"`,
);

await c.end();
console.log("");
