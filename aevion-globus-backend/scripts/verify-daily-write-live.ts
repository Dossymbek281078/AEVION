/**
 * Доказать, что задача дня ДЕЙСТВИТЕЛЬНО пишет в Postgres. На настоящей базе.
 *
 * Зачем. Для турниров перенос в базу доказан замером: счётчик saves вырос
 * 0 → 1, строка появилась, удалилась. Для задачи дня — нет: на проде эта ветка
 * сейчас не выкачена (там чужая), а `saves: 0` в прошлый раз означал лишь «за
 * время работы никто не решал», что записи не доказывает вовсе.
 *
 * Почему не поднимаем весь сервер. index.ts запускает фоновые работы (вебхуки,
 * планировщик, проверка аптайма, повторы платежей). Против БОЕВОЙ базы это
 * значит писать в неё чужими путями ради одной проверки. Поэтому монтируется
 * ровно один роутер.
 *
 * Следы за собой убираются: пользователь с префиксом _verify_daily_ удаляется
 * из базы в конце, и его отсутствие проверяется отдельным запросом — «удалил»
 * без проверки это утверждение, а не факт.
 *
 * Запуск (адрес базы берётся у самой Railway, пароль в консоль не попадает):
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
 *     npx ts-node-dev --transpile-only --no-notify --respawn=false \
 *     scripts/verify-daily-write-live.ts'
 */

import express from "express";
import { Pool } from "pg";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const USER_ID = `_verify_daily_${Date.now()}`;

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан — проверять нечего. См. шапку файла.");
    return 2;
  }

  // Файловое хранилище — во временный каталог. Иначе проверка перепишет
  // настоящий файл лидеров в репозитории, и «чисто» окажется ложью.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "daily-live-"));
  process.env.CYBERCHESS_DAILY_DIR = scratch;

  const { default: dailyRouter } = await import("../src/routes/cyberchessDaily");
  const app = express();
  app.use(express.json());
  app.use("/api/cyberchess-daily", dailyRouter);

  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/cyberchess-daily`;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let failures = 0;
  const check = (ok: boolean, what: string, detail = "") => {
    console.log(`${ok ? "  ✓" : "  ✗"} ${what}${detail ? "  " + detail : ""}`);
    if (!ok) failures++;
  };

  try {
    const before = await (await fetch(`${base}/_persistence`)).json();
    console.log(
      `\nдо решения: подключено=${before?.db?.connected} записей=${before?.db?.saves} ошибок=${before?.db?.saveErrors}`,
    );
    check(before?.db?.configured === true, "база настроена");
    check(before?.db?.connected === true, "подключение живое", String(before?.db?.lastErrorKind ?? ""));

    // Решение доказывается ХОДАМИ, а не числом: с 19.08.2026 сервер сверяет их
    // с задачей дня и считает серию сам. Ходы берём у него же — зашитый список
    // разошёлся бы с банком при первой смене задачи, и проверка стала бы
    // красной на исправном коде.
    //
    // Дату не шлём вовсе: её называет сервер. Прежняя версия слала свою, и на
    // стыке суток UTC получала бы отказ wrong_day.
    const puzzle = await (await fetch(`${base}/puzzle`)).json();
    const moves = Array.isArray(puzzle?.puzzle?.sol) ? puzzle.puzzle.sol : [];
    check(moves.length > 0, "задача дня отдала ходы решения", `${moves.length} ходов`);

    const solve = await fetch(`${base}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        name: "Проверка записи",
        moves,
        timeMs: 4242,
        hintsUsed: 0,
      }),
    });
    check(solve.ok, "решение принято", `HTTP ${solve.status}`);

    // Запись асинхронная — ждём появления строки, а не «немного спим».
    // Фиксированная пауза это ставка на скорость машины и базы.
    let row: { userId: string } | undefined;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const r = await pool.query('SELECT "userId" FROM "CyberDailyEntry" WHERE "userId"=$1', [USER_ID]);
      if (r.rows.length) {
        row = r.rows[0];
        break;
      }
      await new Promise((r2) => setTimeout(r2, 400));
    }
    check(!!row, "строка появилась в CyberDailyEntry", row ? USER_ID : "не дождался за 20 с");

    const after = await (await fetch(`${base}/_persistence`)).json();
    console.log(`после решения: записей=${after?.db?.saves} ошибок=${after?.db?.saveErrors}`);
    // Проверяем ИМЕННО записанные строки. Счётчик saves до 18.08 рос при любом
    // проходе без исключения и «подтверждал» запись, которой не было.
    check(
      Number(after?.db?.rowsWritten) > Number(before?.db?.rowsWritten ?? 0),
      "счётчик ЗАПИСАННЫХ СТРОК вырос",
      `${before?.db?.rowsWritten ?? "?"} → ${after?.db?.rowsWritten ?? "?"}`,
    );
    check(Number(after?.db?.saveErrors) === 0, "ошибок записи нет");
  } finally {
    // Уборка и ПРОВЕРКА уборки. «Удалил» без проверки — утверждение, а не факт.
    try {
      await pool.query('DELETE FROM "CyberDailyEntry" WHERE "userId" LIKE $1', ["_verify_daily_%"]);
      const left = await pool.query(
        'SELECT count(*)::int AS n FROM "CyberDailyEntry" WHERE "userId" LIKE $1',
        ["_verify_daily_%"],
      );
      const n = left.rows[0]?.n ?? -1;
      console.log(`\nуборка: следов проверки осталось ${n}${n === 0 ? "" : "  ← 🔴 разберитесь вручную"}`);
      if (n !== 0) failures++;
    } catch (e) {
      console.error("уборка не прошла:", (e as Error).message);
      failures++;
    }
    await pool.end();
    server.close();
    try {
      fs.rmSync(scratch, { recursive: true, force: true });
    } catch {
      /* временный каталог */
    }
  }

  console.log(failures ? `\nНЕ СОШЛОСЬ: ${failures}` : "\nВсё сошлось: задача дня пишет в базу.");
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("сорвалось:", e);
    process.exit(2);
  },
);
