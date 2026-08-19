/**
 * Доказать, что турниры ДЕЙСТВИТЕЛЬНО пишутся в Postgres. На настоящей базе.
 *
 * Зачем отдельный прогон, если для задачи дня такой уже есть. Счётчик записи в
 * турнирах я починил ПО СХОДСТВУ КОДА, не проверив на живой базе, — а сегодня
 * же поймал себя на том, что «выглядит так же» доказательством не является:
 * там счётчик подтверждал отсутствие исключения, а не запись, и это было видно
 * только на прогоне.
 *
 * Как и у задачи дня, монтируется ТОЛЬКО роутер турниров: поднимать index.ts
 * против боевой базы значит писать в неё фоновыми работами ради одной проверки.
 *
 * Турнир создаётся с явным признаком проверки в названии и удаляется в конце
 * админской ручкой — тем же путём, которым его удалял бы человек. Отсутствие
 * следов проверяется отдельным запросом: «удалил» без проверки это утверждение.
 *
 * Запуск:
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
 *     npx ts-node-dev --transpile-only --no-notify --respawn=false \
 *     scripts/verify-tournaments-write-live.ts'
 */

import express from "express";
import { Pool } from "pg";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const MARK = `_verify_tour_${Date.now()}`;
const ADMIN_KEY = "verify-live-key";

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан — проверять нечего. См. шапку файла.");
    return 2;
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tour-live-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = scratch;
  process.env.CYBERCHESS_ADMIN_KEY = ADMIN_KEY;

  const { default: tournamentsRouter } = await import("../src/routes/cyberchessTournaments");
  const app = express();
  app.use(express.json());
  app.use("/api/cyberchess-tournaments", tournamentsRouter);

  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/cyberchess-tournaments`;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let failures = 0;
  let createdId = "";
  const check = (ok: boolean, what: string, detail = "") => {
    console.log(`${ok ? "  ✓" : "  ✗"} ${what}${detail ? "  " + detail : ""}`);
    if (!ok) failures++;
  };
  const persistence = async () => (await (await fetch(`${base}/_persistence`)).json())?.persistence?.db ?? {};

  try {
    // Подключение к базе устанавливается асинхронно при старте модуля. Первая
    // версия спрашивала «подключено?» сразу и краснела на исправном коде: это
    // проверка на скорость машины, а не на работу. Ждём до предела и говорим,
    // сколько ждали, — если ждать пришлось долго, это тоже находка.
    const t0 = Date.now();
    let before = await persistence();
    while (Date.now() - t0 < 20_000 && before.connected !== true) {
      await new Promise((r) => setTimeout(r, 300));
      before = await persistence();
    }
    console.log(
      `\nдо создания: подключено=${before.connected} за ${Date.now() - t0} мс, строк записано=${before.rowsWritten}, ошибок=${before.saveErrors}`,
    );
    check(before.configured === true, "база настроена");
    check(before.connected === true, "подключение живое", String(before.lastErrorKind ?? ""));

    const created = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Проверка записи ${MARK}`,
        format: "swiss",
        timeControl: "blitz",
        maxPlayers: 8,
      }),
    });
    const body = await created.json();
    createdId = body?.tournament?.id ?? "";
    check(created.ok && !!createdId, "турнир создан", createdId || `HTTP ${created.status}`);

    let row: { id: string } | undefined;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && createdId) {
      const r = await pool.query('SELECT "id" FROM "CyberTournament" WHERE "id"=$1', [createdId]);
      if (r.rows.length) {
        row = r.rows[0];
        break;
      }
      await new Promise((r2) => setTimeout(r2, 400));
    }
    check(!!row, "строка появилась в CyberTournament", row ? createdId : "не дождался за 20 с");

    // Запись не ждут (void saveToDb), поэтому счётчик может отстать от строки в
    // базе. Даём ему дойти — но не «спим наугад», а опрашиваем до предела.
    let after = await persistence();
    const cDeadline = Date.now() + 15_000;
    while (Date.now() < cDeadline && Number(after.rowsWritten) <= Number(before.rowsWritten ?? 0)) {
      await new Promise((r) => setTimeout(r, 400));
      after = await persistence();
    }
    console.log(`после создания: ${JSON.stringify(after)}`);
    check(
      Number(after.rowsWritten) > Number(before.rowsWritten ?? 0),
      "счётчик ЗАПИСАННЫХ СТРОК вырос",
      `${before.rowsWritten ?? "?"} → ${after.rowsWritten ?? "?"}`,
    );
    check(Number(after.saveErrors) === 0, "ошибок записи нет");

    if (createdId) {
      const del = await fetch(`${base}/${encodeURIComponent(createdId)}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      check(del.ok, "удаление админской ручкой прошло", `HTTP ${del.status}`);
    }
  } finally {
    try {
      // Подстраховка: ручка могла не сработать, а следы на боевой базе оставлять
      // нельзя. Чистим по идентификатору, а не по «похоже на тестовое», — под
      // такой шаблон однажды попадёт живое событие.
      if (createdId) await pool.query('DELETE FROM "CyberTournament" WHERE "id"=$1', [createdId]);
      const left = await pool.query('SELECT count(*)::int AS n FROM "CyberTournament" WHERE "id"=$1', [createdId]);
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

  console.log(failures ? `\nНЕ СОШЛОСЬ: ${failures}` : "\nВсё сошлось: турниры пишутся в базу.");
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("сорвалось:", e);
    process.exit(2);
  },
);
