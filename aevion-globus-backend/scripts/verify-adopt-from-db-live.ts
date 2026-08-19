/**
 * Доказать, что состояние ПОДНИМАЕТСЯ ИЗ БАЗЫ при старте. На настоящей базе.
 *
 * Зачем. Запись доказана для обоих хранилищ, но во всех прогонах
 * `adoptedFromDb: false` — то есть чтение при старте не проверялось вживую ни
 * разу. А обещание модуля именно такое: «данные переживут выкатку». Пережить
 * выкатку значит быть ЗАПИСАННЫМ и ПРОЧИТАННЫМ; доказана была половина.
 *
 * Как устроено. Файл состояния намеренно отсутствует (временный пустой
 * каталог) — так выглядит свежий контейнер после деплоя: том пуст, база нет.
 * В базу кладётся строка-метка со свежим savedAtMs, затем поднимается модуль.
 * Если он честно читает базу, метка окажется в списке, а adoptedFromDb станет
 * true.
 *
 * Проверяется ОБА признака, а не один: сам флаг может быть выставлен, а данные
 * не доехать — и наоборот. Совпадение двух независимых признаков и есть
 * доказательство.
 *
 * Запуск:
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
 *     npx ts-node-dev --transpile-only --no-notify --respawn=false \
 *     scripts/verify-adopt-from-db-live.ts'
 */

import express from "express";
import { Pool } from "pg";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const MARK_ID = `usr-verify-adopt-${Date.now()}`;
const DAILY_MARK = `_verify_adopt_${Date.now()}`;

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан — проверять нечего. См. шапку файла.");
    return 2;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let failures = 0;
  const check = (ok: boolean, what: string, detail = "") => {
    console.log(`${ok ? "  ✓" : "  ✗"} ${what}${detail ? "  " + detail : ""}`);
    if (!ok) failures++;
  };

  // Пустой каталог = свежий контейнер: файла состояния нет, есть только база.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-live-"));
  process.env.CYBERCHESS_TOURNAMENTS_DIR = scratch;

  try {
    const stamp = Date.now();
    const marker = {
      id: MARK_ID,
      title: "Проверка чтения из базы",
      format: "swiss",
      timeControl: "blitz",
      eloMin: 0,
      eloMax: 3000,
      players: 0,
      maxPlayers: 8,
      prizeChessy: 0,
      status: "upcoming",
      startsAt: new Date(stamp + 86400000).toISOString(),
      registeredUserIds: [],
      roster: [],
      rounds: [],
      origin: "user",
    };
    await pool.query(
      `INSERT INTO "CyberTournament" ("id","data","savedAtMs") VALUES ($1,$2,$3)
       ON CONFLICT ("id") DO UPDATE SET "data"=EXCLUDED."data","savedAtMs"=EXCLUDED."savedAtMs"`,
      [MARK_ID, JSON.stringify(marker), stamp],
    );
    console.log(`\nметка положена в базу: ${MARK_ID}`);

    // Модуль импортируется ПОСЛЕ записи метки — иначе он прочитал бы базу до
    // её появления, и проверка доказывала бы обратное тому, что задумано.
    const { default: tournamentsRouter } = await import("../src/routes/cyberchessTournaments");
    const app = express();
    app.use(express.json());
    app.use("/api/cyberchess-tournaments", tournamentsRouter);
    const server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", () => r()));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}/api/cyberchess-tournaments`;

    const state = async () => (await (await fetch(`${base}/_persistence`)).json())?.persistence?.db ?? {};

    const t0 = Date.now();
    let db = await state();
    while (Date.now() - t0 < 25_000 && db.adoptedFromDb !== true) {
      await new Promise((r) => setTimeout(r, 300));
      db = await state();
    }
    console.log(`подъём из базы: ${JSON.stringify(db)}`);

    check(db.connected === true, "подключение живое");
    check(db.adoptedFromDb === true, "флаг adoptedFromDb выставлен", `за ${Date.now() - t0} мс`);

    const list = await (await fetch(`${base}/list`)).json();
    const ids: string[] = (list?.tournaments ?? []).map((t: { id: string }) => t.id);
    check(ids.includes(MARK_ID), "метка ВИДНА в списке — данные действительно приехали", `турниров ${ids.length}`);

    // Файла не было — значит показать что-либо, кроме базы, модуль мог только
    // подставив фикстуры. Убеждаемся, что это не они.
    check(ids.length > 1, "список не пуст", `${ids.length}`);

    server.close();

    // ── то же для задачи дня ───────────────────────────────────────────
    //
    // Посева фикстур у неё нет, значит дефекта «заглушка новее базы» быть не
    // должно. Но «должно» — рассуждение, а не факт: сегодня я уже дважды
    // ошибался, считая соседний модуль устроенным так же.
    const dailyScratch = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-daily-"));
    process.env.CYBERCHESS_DAILY_DIR = dailyScratch;
    const dstamp = Date.now();
    await pool.query(
      `INSERT INTO "CyberDailyEntry" ("userId","entry","stats","savedAtMs") VALUES ($1,$2,$3,$4)
       ON CONFLICT ("userId") DO UPDATE SET "entry"=EXCLUDED."entry","savedAtMs"=EXCLUDED."savedAtMs"`,
      [
        DAILY_MARK,
        JSON.stringify({ userId: DAILY_MARK, name: "Проверка чтения", streak: 3, score: 30 }),
        null,
        dstamp,
      ],
    );

    const { default: dailyRouter } = await import("../src/routes/cyberchessDaily");
    const dapp = express();
    dapp.use(express.json());
    dapp.use("/api/cyberchess-daily", dailyRouter);
    const dserver = dapp.listen(0);
    await new Promise<void>((r) => dserver.once("listening", () => r()));
    const dport = (dserver.address() as { port: number }).port;
    const dbase = `http://127.0.0.1:${dport}/api/cyberchess-daily`;

    const dstate = async () => (await (await fetch(`${dbase}/_persistence`)).json())?.db ?? {};
    const dt0 = Date.now();
    let ddb = await dstate();
    while (Date.now() - dt0 < 25_000 && ddb.adoptedFromDb !== true) {
      await new Promise((r) => setTimeout(r, 300));
      ddb = await dstate();
    }
    console.log(`\nзадача дня, подъём из базы: ${JSON.stringify(ddb)}`);
    check(ddb.adoptedFromDb === true, "задача дня: флаг adoptedFromDb выставлен", `за ${Date.now() - dt0} мс`);

    const lb = await (await fetch(`${dbase}/leaderboard?limit=50`)).json();
    const users: string[] = (lb?.leaderboard ?? []).map((e: { userId: string }) => e.userId);
    check(users.includes(DAILY_MARK), "задача дня: метка ВИДНА в таблице", `строк ${users.length}`);

    dserver.close();
    try {
      fs.rmSync(dailyScratch, { recursive: true, force: true });
    } catch {
      /* временный каталог */
    }
  } finally {
    try {
      await pool.query('DELETE FROM "CyberTournament" WHERE "id"=$1', [MARK_ID]);
      await pool.query('DELETE FROM "CyberDailyEntry" WHERE "userId"=$1', [DAILY_MARK]);
      const left = await pool.query('SELECT count(*)::int AS n FROM "CyberTournament" WHERE "id"=$1', [MARK_ID]);
      const dleft = await pool.query('SELECT count(*)::int AS n FROM "CyberDailyEntry" WHERE "userId"=$1', [DAILY_MARK]);
      const n = (left.rows[0]?.n ?? -1) + (dleft.rows[0]?.n ?? -1);
      console.log(`\nуборка: следов метки осталось ${n}${n === 0 ? "" : "  ← 🔴 разберитесь вручную"}`);
      if (n !== 0) failures++;
    } catch (e) {
      console.error("уборка не прошла:", (e as Error).message);
      failures++;
    }
    await pool.end();
    try {
      fs.rmSync(scratch, { recursive: true, force: true });
    } catch {
      /* временный каталог */
    }
  }

  console.log(failures ? `\nНЕ СОШЛОСЬ: ${failures}` : "\nВсё сошлось: состояние поднимается из базы.");
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("сорвалось:", e);
    process.exit(2);
  },
);
