/**
 * Доказать, что начисление Chessy доходит до базы. На НАСТОЯЩЕМ Postgres, но
 * во временной схеме.
 *
 * Почему не в боевых таблицах. Кошельки и таблицу лидеров читает прод: даже
 * несколько секунд синтетические игроки были бы видны людям, а начисленный
 * баланс пришлось бы вычитать обратно — то есть чинить данные правкой данных.
 * Поэтому вся проверка идёт в схеме verify_money_<штамп>: модуль сам создаёт
 * там свои таблицы (CREATE TABLE IF NOT EXISTS), а в конце схема удаляется
 * целиком. Боевые данные не читаются и не пишутся вовсе.
 *
 * Что доказывается:
 *   1. партия записана и закрыта;
 *   2. в ведомости РОВНО две строки на партию — по одной на игрока;
 *   3. балансы выросли на положенное (10 победителю, 1 проигравшему);
 *   4. повтор отчёта о конце партии НЕ платит второй раз.
 *
 * Четвёртый пункт — главный: конец партии сообщают оба клиента, и двойная
 * выплата здесь стоит денег.
 *
 * Запуск:
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
 *     npx ts-node-dev --transpile-only --no-notify --respawn=false \
 *     scripts/verify-money-path-live.ts'
 */

import { Pool } from "pg";

const STAMP = Date.now();
const SCHEMA = `verify_money_${STAMP}`;
const MATCH_ID = `m_verify_${STAMP}`;
const WHITE = `u_verify_w_${STAMP}`;
const BLACK = `u_verify_b_${STAMP}`;

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL не задан — проверять нечего. См. шапку файла.");
    return 2;
  }

  const admin = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  let failures = 0;
  const check = (ok: boolean, what: string, detail = "") => {
    console.log(`${ok ? "  ✓" : "  ✗"} ${what}${detail ? "  " + detail : ""}`);
    if (!ok) failures++;
  };

  try {
    await admin.query(`CREATE SCHEMA "${SCHEMA}"`);
    console.log(`\nвременная схема создана: ${SCHEMA}`);

    // Модуль возьмёт адрес из окружения; search_path уводит его таблицы в нашу
    // схему. Боевые таблицы при этом не видны вовсе — значит испортить их
    // нельзя даже ошибкой в проверке.
    const sep = url.includes("?") ? "&" : "?";
    process.env.DATABASE_URL = `${url}${sep}options=${encodeURIComponent(`-c search_path=${SCHEMA}`)}`;

    const store = await import("../src/routes/cyberchessMatchStore");
    await store.ensureDb();

    await store.recordMatchCreated({
      id: MATCH_ID,
      whiteUserId: WHITE,
      whiteName: "Проверка белые",
      blackUserId: BLACK,
      blackName: "Проверка чёрные",
      timeControl: "180+0",
    });

    const scoped = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    const created = await scoped.query(`SELECT "status" FROM "CyberMatch" WHERE "id"=$1`, [MATCH_ID]);
    check(created.rows.length === 1, "партия записана", created.rows[0]?.status ?? "строки нет");

    const delta = await store.finalizeMatch(MATCH_ID, {
      whiteUserId: WHITE,
      whiteName: "Проверка белые",
      blackUserId: BLACK,
      blackName: "Проверка чёрные",
      timeControl: "180+0",
      result: "white",
      termination: "normal",
    });
    check(delta !== null, "партия закрыта, рейтинги посчитаны");

    const ended = await scoped.query(`SELECT "status","result" FROM "CyberMatch" WHERE "id"=$1`, [MATCH_ID]);
    check(ended.rows[0]?.status === "ended", "статус партии — ended", String(ended.rows[0]?.status));

    const awards = await scoped.query(
      `SELECT "userId","amount" FROM "CyberWalletAward" WHERE "matchId"=$1 ORDER BY "userId"`,
      [MATCH_ID],
    );
    check(awards.rows.length === 2, "в ведомости ровно две строки", `их ${awards.rows.length}`);

    const wallets = await scoped.query(
      `SELECT "userId","balance" FROM "CyberWallet" WHERE "userId"=ANY($1) ORDER BY "userId"`,
      [[WHITE, BLACK]],
    );
    const byUser = Object.fromEntries(wallets.rows.map((r: { userId: string; balance: number }) => [r.userId, Number(r.balance)]));
    check(byUser[WHITE] === 10, "победителю начислено 10", `начислено ${byUser[WHITE]}`);
    check(byUser[BLACK] === 1, "проигравшему начислено 1", `начислено ${byUser[BLACK]}`);

    // Повтор: конец партии сообщают ОБА клиента. Двойная выплата здесь — прямые
    // деньги, поэтому проверка идёт по балансу, а не по коду возврата.
    await store.finalizeMatch(MATCH_ID, {
      whiteUserId: WHITE,
      whiteName: "Проверка белые",
      blackUserId: BLACK,
      blackName: "Проверка чёрные",
      timeControl: "180+0",
      result: "white",
      termination: "normal",
    });
    const after = await scoped.query(
      `SELECT "userId","balance" FROM "CyberWallet" WHERE "userId"=ANY($1) ORDER BY "userId"`,
      [[WHITE, BLACK]],
    );
    const afterBy = Object.fromEntries(after.rows.map((r: { userId: string; balance: number }) => [r.userId, Number(r.balance)]));
    check(afterBy[WHITE] === 10 && afterBy[BLACK] === 1, "повтор НЕ заплатил второй раз", `${afterBy[WHITE]}/${afterBy[BLACK]}`);

    const awards2 = await scoped.query(`SELECT count(*)::int AS n FROM "CyberWalletAward" WHERE "matchId"=$1`, [MATCH_ID]);
    check(awards2.rows[0]?.n === 2, "строк в ведомости по-прежнему две", String(awards2.rows[0]?.n));

    await scoped.end();
  } catch (e) {
    console.error("сорвалось:", (e as Error).message);
    failures++;
  } finally {
    try {
      await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
      const left = await admin.query(
        `SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name=$1`,
        [SCHEMA],
      );
      const n = left.rows[0]?.n ?? -1;
      console.log(`\nуборка: временных схем осталось ${n}${n === 0 ? "" : "  ← 🔴 разберитесь вручную"}`);
      if (n !== 0) failures++;
    } catch (e) {
      console.error("уборка не прошла:", (e as Error).message);
      failures++;
    }
    await admin.end();
  }

  console.log(failures ? `\nНЕ СОШЛОСЬ: ${failures}` : "\nВсё сошлось: начисление Chessy доходит до базы и не платит дважды.");
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("сорвалось:", e);
    process.exit(2);
  },
);
