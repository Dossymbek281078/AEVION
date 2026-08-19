/**
 * Перевод шахматных колонок времени на тип С ЧАСОВЫМ ПОЯСОМ.
 *
 * Зачем. 18.08.2026 из-за колонок `TIMESTAMP` (без зоны) молча не работала
 * доплата зависших начислений Chessy: драйвер читает такую колонку как МЕСТНОЕ
 * время процесса, и сравнение с Date.now() было ложным всегда. Сравнения я
 * починил, приводя обе величины к эпохе в SQL, но САМА ЛОВУШКА осталась:
 * девять колонок в трёх файлах, и следующий, кто прочитает такую колонку в
 * дату, повторит дефект. Остальная платформа давно на TIMESTAMPTZ.
 *
 * Что делает: ALTER TABLE ... TYPE TIMESTAMPTZ USING "col" AT TIME ZONE 'UTC'.
 *
 * Почему именно 'UTC'. Значения писал `now()` на сервере Postgres, а он в UTC
 * (проверено запросом SHOW timezone перед миграцией). Значит хранящееся число
 * — это UTC-время без пометки, и `AT TIME ZONE 'UTC'` даёт ровно тот же момент,
 * только помеченный. Если сервер окажется НЕ в UTC, скрипт останавливается:
 * молча приписать неверный пояс значит сдвинуть все даты на несколько часов.
 *
 *   node --experimental-strip-types scripts/migrate-chess-timestamptz.ts --check
 *   node --experimental-strip-types scripts/migrate-chess-timestamptz.ts --apply
 *
 * Без --apply только показывает, что будет сделано.
 */

import { Pool } from "pg";

const TARGETS: Array<{ table: string; columns: string[] }> = [
  { table: "CyberMatch", columns: ["createdAt", "endedAt"] },
  { table: "CyberRating", columns: ["updatedAt"] },
  { table: "CyberWallet", columns: ["updatedAt"] },
  { table: "CyberWalletAward", columns: ["paidAt"] },
  { table: "CyberAnticheatReport", columns: ["analysedAt", "storedAt"] },
];

const APPLY = process.argv.includes("--apply");

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан. См. шапку файла.");
    return 2;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  let failures = 0;

  try {
    // Проверяем СВОЙСТВО, а не название. Первая версия сверяла имя с /^UTC$/ и
    // остановилась на «Etc/UTC» — который и есть UTC. Сторож, отвергающий
    // правильный случай из-за написания, хуже отсутствующего: он заставляет
    // обходить себя, и обходить начнут и там, где он прав.
    const tz = await pool.query(
      `SELECT current_setting('TimeZone') AS zone,
              EXTRACT(EPOCH FROM (now()::timestamp - (now() AT TIME ZONE 'UTC')))::int AS offset_sec`,
    );
    const zone = String(tz.rows[0]?.zone ?? "неизвестен");
    const offset = Number(tz.rows[0]?.offset_sec ?? NaN);
    console.log(`пояс сервера базы: ${zone}, смещение от UTC: ${offset} с`);
    if (!Number.isFinite(offset) || Math.abs(offset) > 1) {
      // Без нулевого смещения пересчёт сдвинет все даты, и узнать об этом будет
      // уже неоткуда — старое значение перезаписано.
      console.error(`ОСТАНОВКА: часы сервера смещены от UTC на ${offset} с. Пересчёт сдвинул бы все даты.`);
      return 1;
    }

    for (const t of TARGETS) {
      for (const col of t.columns) {
        const cur = await pool.query(
          `SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
          [t.table, col],
        );
        if (cur.rows.length === 0) {
          console.log(`  · ${t.table}."${col}" — колонки нет, пропуск`);
          continue;
        }
        const type = String(cur.rows[0].data_type);
        if (/with time zone/i.test(type)) {
          console.log(`  ✓ ${t.table}."${col}" — уже с зоной`);
          continue;
        }
        if (!APPLY) {
          console.log(`  → ${t.table}."${col}" — будет переведена (сейчас ${type})`);
          continue;
        }
        // Значения до и после сверяем ПО ЭПОХЕ: миграция обязана сохранить
        // момент времени, а не только тип. Проверка на самой таблице, а не на
        // выдуманном примере.
        const before = await pool.query(
          `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM "${col}")), 0) AS s, count("${col}")::int AS n FROM "${t.table}"`,
        );
        await pool.query(
          `ALTER TABLE "${t.table}" ALTER COLUMN "${col}" TYPE TIMESTAMPTZ USING "${col}" AT TIME ZONE 'UTC'`,
        );
        const after = await pool.query(
          `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM "${col}")), 0) AS s, count("${col}")::int AS n FROM "${t.table}"`,
        );
        const same = Number(before.rows[0].s) === Number(after.rows[0].s) && before.rows[0].n === after.rows[0].n;
        console.log(
          `  ${same ? "✓" : "✗"} ${t.table}."${col}" — переведена, строк ${after.rows[0].n}, момент времени ${same ? "сохранён" : "ИЗМЕНИЛСЯ"}`,
        );
        if (!same) failures++;
      }
    }
  } catch (e) {
    console.error("сорвалось:", (e as Error).message);
    failures++;
  } finally {
    await pool.end();
  }

  if (!APPLY) console.log("\n(ничего не менялось — добавьте --apply)");
  return failures ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(2); });
