/**
 * Прогон SQL идемпотентности QGood на НАСТОЯЩЕМ движке Postgres (pglite,
 * тот же код Postgres, собранный в WASM) — а не проверка чтением.
 *
 * Проверяется ровно то, что стоит в src/routes/qgood.ts:
 *   — частичный уникальный индекс по "paymentRef" WHERE "paymentRef" IS NOT NULL;
 *   — INSERT ... ON CONFLICT ("paymentRef") WHERE ... DO NOTHING RETURNING "id".
 *
 * Запуск: node scripts/verify-qgood-idempotency-sql.mjs
 * Код выхода 0 — всё сошлось, 1 — нет.
 */
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "ПЛОХО"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// Схема — копия боевой в части, которая нас интересует.
await db.exec(`
  CREATE TABLE "QGoodDonation" (
    "id"          TEXT PRIMARY KEY,
    "campaignId"  TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "paymentRef"  TEXT
  );
`);

// 1. Сам индекс — создаётся ли он вообще таким синтаксисом.
try {
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "QGoodDonation_paymentRef_key"
      ON "QGoodDonation" ("paymentRef") WHERE "paymentRef" IS NOT NULL;
  `);
  check("частичный уникальный индекс создаётся", true);
} catch (e) {
  check("частичный уникальный индекс создаётся", false, e.message);
}

const insert = (id, ref) =>
  db.query(
    `INSERT INTO "QGoodDonation" ("id","campaignId","amountCents","paymentRef")
     VALUES ($1,'c1',5000,$2)
     ON CONFLICT ("paymentRef") WHERE "paymentRef" IS NOT NULL DO NOTHING
     RETURNING "id"`,
    [id, ref],
  );

// 2. Первая запись платежа проходит.
const first = await insert("d1", "pay_A");
check("первая запись платежа вставляется", first.rows.length === 1);

// 3. Тот же платёж второй раз — отбрасывается, RETURNING пуст.
const second = await insert("d2", "pay_A");
check("повтор того же платежа НЕ вставляется", second.rows.length === 0, `вернулось строк: ${second.rows.length}`);

// 4. Другой платёж проходит.
const other = await insert("d3", "pay_B");
check("другой платёж вставляется", other.rows.length === 1);

// 5. Записи без ссылки повторяться могут — частичный индекс их не трогает.
const cash1 = await insert("d4", null);
const cash2 = await insert("d5", null);
check("наличные без ссылки не блокируются", cash1.rows.length === 1 && cash2.rows.length === 1);

// 6. Итог: строк ровно 4, платёж pay_A записан один раз.
const { rows } = await db.query(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE "paymentRef" = 'pay_A')::int AS pay_a
  FROM "QGoodDonation"
`);
check("итог: 4 строки, платёж pay_A ровно один", rows[0].total === 4 && rows[0].pay_a === 1,
  `строк ${rows[0].total}, pay_A ${rows[0].pay_a}`);

// 7. Обратная проверка: без индекса повтор БЫ прошёл (то есть индекс и правда
//    то, что держит идемпотентность, а не совпадение).
await db.exec(`DROP INDEX "QGoodDonation_paymentRef_key";`);
const wouldPass = await db.query(
  `INSERT INTO "QGoodDonation" ("id","campaignId","amountCents","paymentRef")
   VALUES ('d6','c1',5000,'pay_A') RETURNING "id"`,
);
check("без индекса повтор прошёл бы — значит держит именно он", wouldPass.rows.length === 1);

const failed = checks.filter((c) => !c.ok);
console.log(`\nПройдено ${checks.length - failed.length} из ${checks.length}`);
process.exit(failed.length === 0 ? 0 : 1);
