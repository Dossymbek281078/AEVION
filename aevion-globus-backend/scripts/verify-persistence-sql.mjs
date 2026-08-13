#!/usr/bin/env node
/**
 * Проверка SQL переноса хранилищ на НАСТОЯЩЕМ Postgres.
 *
 * Зачем. Запросы для CyberTournament / CyberDailyEntry написаны 13.08.2026 и до
 * этого скрипта ни разу не выполнялись сервером: локальной базы нет, а подделка
 * в тестах SQL не исполняет — она сверяет текст с образцом. То есть их
 * правильность была на веру.
 *
 * Безопасность — три слоя, потому что запускать это будут на боевой базе:
 *   1. Все имена таблиц с приставкой `_verify_` — с боевыми не пересекаются.
 *   2. Всё в ОДНОЙ транзакции, которая в конце всегда ROLLBACK. После скрипта
 *      в базе не остаётся ничего, даже если он упал посередине.
 *   3. Ни одного обращения к боевым таблицам: ни SELECT, ни DDL.
 *
 * Запуск:
 *   railway run node scripts/verify-persistence-sql.mjs      (переменные прода)
 *   DATABASE_URL=... node scripts/verify-persistence-sql.mjs (любая другая база)
 */

import pg from "pg";

const P = "_verify_"; // приставка, отделяющая нас от боевых таблиц

let pass = 0;
let fail = 0;
const ok = (label, extra) => { pass++; console.log(`  ✓ ${label}${extra ? "  " + extra : ""}`); };
const bad = (label, why) => { fail++; console.error(`  ✗ ${label}${why ? "  ↳ " + why : ""}`); };

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан. Запускать через `railway run` или с явной переменной.");
    process.exit(2);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  await client.connect();
  const version = (await client.query("select version()")).rows[0].version.split(",")[0];
  console.log(`\nПроверка SQL переноса на живой базе → ${version}\n`);

  await client.query("BEGIN");
  try {
    // ── Турниры: строка на турнир ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${P}CyberTournament" (
        "id"        TEXT PRIMARY KEY,
        "data"      JSONB NOT NULL,
        "savedAtMs" BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "${P}ct_savedat_idx" ON "${P}CyberTournament" ("savedAtMs" DESC);
    `);
    ok("турниры: таблица и индекс создаются");

    const upsertTournament = `
      INSERT INTO "${P}CyberTournament" ("id","data","savedAtMs") VALUES ($1,$2,$3)
      ON CONFLICT ("id") DO UPDATE SET "data"=EXCLUDED."data","savedAtMs"=EXCLUDED."savedAtMs"
      WHERE "${P}CyberTournament"."savedAtMs" <= EXCLUDED."savedAtMs"`;

    await client.query(upsertTournament, ["t1", JSON.stringify({ id: "t1", title: "Первый" }), 1000]);
    await client.query(upsertTournament, ["t2", JSON.stringify({ id: "t2", title: "Второй" }), 1000]);
    const two = await client.query(`SELECT count(*)::int AS n FROM "${P}CyberTournament"`);
    two.rows[0].n === 2 ? ok("турниры: две строки, разные объекты не мешают друг другу") : bad("турниры: ожидались 2 строки", `получено ${two.rows[0].n}`);

    // Свежая запись обновляет
    await client.query(upsertTournament, ["t1", JSON.stringify({ id: "t1", title: "Обновлённый" }), 2000]);
    const fresh = await client.query(`SELECT "data"->>'title' AS t, "savedAtMs" FROM "${P}CyberTournament" WHERE "id"='t1'`);
    fresh.rows[0].t === "Обновлённый" ? ok("турниры: свежая запись применяется") : bad("турниры: свежая запись не применилась", fresh.rows[0].t);

    // Опоздавшая — НЕ обновляет (ради этого условия всё и писалось)
    await client.query(upsertTournament, ["t1", JSON.stringify({ id: "t1", title: "Опоздавший" }), 1500]);
    const kept = await client.query(`SELECT "data"->>'title' AS t, "savedAtMs"::bigint AS ms FROM "${P}CyberTournament" WHERE "id"='t1'`);
    kept.rows[0].t === "Обновлённый" && Number(kept.rows[0].ms) === 2000
      ? ok("турниры: опоздавшая запись НЕ затирает свежую")
      : bad("турниры: опоздавшая запись затёрла свежую", `${kept.rows[0].t} / ${kept.rows[0].ms}`);

    // Чтение так, как читает код
    const readT = await client.query(`SELECT "data","savedAtMs" FROM "${P}CyberTournament"`);
    const parsed = readT.rows.every((r) => r.data && typeof r.data.id === "string" && Number.isFinite(Number(r.savedAtMs)));
    parsed ? ok("турниры: чтение отдаёт разобранный JSON и число") : bad("турниры: форма прочитанного не та");

    // ── Задача дня: строка на игрока ─────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${P}CyberDailyEntry" (
        "userId"    TEXT PRIMARY KEY,
        "entry"     JSONB,
        "stats"     JSONB,
        "savedAtMs" BIGINT NOT NULL
      );
    `);
    ok("задача дня: таблица создаётся");

    const upsertDaily = `
      INSERT INTO "${P}CyberDailyEntry" ("userId","entry","stats","savedAtMs") VALUES ($1,$2,$3,$4)
      ON CONFLICT ("userId") DO UPDATE SET
        "entry"=EXCLUDED."entry","stats"=EXCLUDED."stats","savedAtMs"=EXCLUDED."savedAtMs"
      WHERE "${P}CyberDailyEntry"."savedAtMs" <= EXCLUDED."savedAtMs"`;

    await client.query(upsertDaily, ["u1", JSON.stringify({ userId: "u1", streak: 5 }), JSON.stringify({ userId: "u1", totalSolved: 5 }), 1000]);
    // null в stats — код так пишет, когда у игрока есть строка в таблице, но нет статистики
    await client.query(upsertDaily, ["u2", JSON.stringify({ userId: "u2", streak: 1 }), null, 1000]);
    const dailyRows = await client.query(`SELECT "userId","entry","stats","savedAtMs" FROM "${P}CyberDailyEntry" ORDER BY "userId"`);
    dailyRows.rows.length === 2 && dailyRows.rows[1].stats === null
      ? ok("задача дня: строка на игрока, пустая статистика допустима")
      : bad("задача дня: форма строк не та", JSON.stringify(dailyRows.rows.map((r) => r.userId)));

    await client.query(upsertDaily, ["u1", JSON.stringify({ userId: "u1", streak: 99 }), null, 500]);
    const dailyKept = await client.query(`SELECT "entry"->>'streak' AS s FROM "${P}CyberDailyEntry" WHERE "userId"='u1'`);
    dailyKept.rows[0].s === "5" ? ok("задача дня: опоздавшая запись НЕ затирает свежую") : bad("задача дня: опоздавшая запись затёрла", dailyKept.rows[0].s);

    // ── Счётчики диагностики ─────────────────────────────────────────
    const cnt = await client.query(`SELECT count(*) AS n FROM "${P}CyberDailyEntry" WHERE "entry" IS NOT NULL`);
    Number.isFinite(Number(cnt.rows[0].n)) ? ok("счётчики: count(*) отдаёт число") : bad("счётчики: count(*) вернул не число");
  } catch (e) {
    bad("выполнение", e.message);
  } finally {
    await client.query("ROLLBACK");
    const left = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name LIKE '${P}%'`,
    );
    left.rows[0].n === 0
      ? ok("после отката временных таблиц не осталось")
      : bad("в базе остались временные таблицы!", `${left.rows[0].n} шт.`);
    await client.end();
  }

  console.log(`\n${pass + fail} проверок — ${pass} PASS  ${fail} FAIL\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("не удалось выполнить:", e.message);
  process.exit(2);
});
