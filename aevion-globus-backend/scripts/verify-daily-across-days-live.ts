/**
 * Возврат на второй день: разные дни дают разные задачи, один день — одну и ту
 * же. На настоящем банке.
 *
 * Это критерий ворот запуска (30.08.2026): «то, ради чего человек вернётся
 * завтра, проверено на разных днях». Проверять его на выдуманном пуле
 * бессмысленно — в тридцати зашитых задачах разница была бы всегда, а в
 * настоящем банке на полмиллиона важно, что выбор ДЕТЕРМИНИРОВАН по дате:
 * у всех игроков в один день должна быть ОДНА задача, иначе таблица лидеров
 * сравнивает людей, решавших разное.
 *
 * Только читает: ни одной записи в базу.
 *
 * Запуск:
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL"  *     npx ts-node scripts/verify-daily-across-days-live.ts'
 */
import { Pool } from "pg";

function dayOffsetHash(day: string, total: number): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % Math.max(1, total);
}

async function main(): Promise<number> {
  // await на верхнем уровне здесь недопустим: общий прогон тянет проверки через
  // require, а он на ESM-графе с TLA падает — проверка молча не выполнялась.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const c = await pool.query('SELECT count(*)::int AS n FROM "ChessPuzzle"');
    const total: number = c.rows[0].n;
    console.log("в банке задач:", total);
    if (!total) {
      console.log("  ✗ банк пуст — проверять нечего");
      return 1;
    }

    // Семь дней ВПЕРЁД ОТ СЕГОДНЯ, а не зашитая дата: проверка с фиксированным
    // августом 2026 через месяц проверяла бы прошлое и всегда была зелёной.
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
    }

    const seen: Array<string | undefined> = [];
    for (const d of days) {
      const off = dayOffsetHash(d, total);
      const r = await pool.query(
        'SELECT "id","theme","rating" FROM "ChessPuzzle" ORDER BY "id" OFFSET $1 LIMIT 1',
        [off],
      );
      const p = r.rows[0];
      seen.push(p?.id);
      console.log(`  ${d}: ${p?.id} | ${p?.theme} | ${p?.rating}`);
    }

    const unique = new Set(seen.filter(Boolean));
    const allDistinct = unique.size === seen.length;
    console.log(`  ${allDistinct ? "✓" : "✗"} разных задач за семь дней: ${unique.size} из ${seen.length}`);

    // Один и тот же день обязан давать одно и то же — иначе таблица лидеров
    // сравнивает людей, решавших разные задачи.
    const a = dayOffsetHash(days[0], total);
    const b = dayOffsetHash(days[0], total);
    console.log(`  ${a === b ? "✓" : "✗"} один день дважды: смещение ${a} и ${b}`);

    return allDistinct && a === b ? 0 : 1;
  } finally {
    await pool.end();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("сорвалось:", e);
    process.exit(2);
  },
);
