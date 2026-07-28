/**
 * Прогон SQL вместимости QEvents на настоящем движке Postgres (pglite).
 *
 * Проверяется то, что стоит в src/routes/qevents.ts:
 *   — SELECT ... FOR UPDATE внутри транзакции (синтаксис и то, что он вообще
 *     исполняется на строке события);
 *   — UPDATE ... GREATEST(0, "attendeeCount" + $1) RETURNING "attendeeCount";
 *   — арифметика границы: 99 из 100 пускаем, 100 из 100 нет.
 *
 * Чего этот прогон НЕ доказывает: настоящей одновременности. pglite — один
 * поток, две параллельные транзакции в нём не столкнуть. FOR UPDATE здесь
 * проверен как исполнимый и не ломающий логику; защита от гонки остаётся
 * доказанной устройством, а не замером.
 *
 * Запуск: node scripts/verify-qevents-capacity-sql.mjs
 */
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ ok });
  console.log(`${ok ? "OK  " : "ПЛОХО"} ${name}${detail ? ` — ${detail}` : ""}`);
};

await db.exec(`
  CREATE TABLE "QEvent" (
    "id" TEXT PRIMARY KEY,
    "attendeeCount" INT NOT NULL DEFAULT 0,
    "capacity" INT NOT NULL
  );
  CREATE TABLE "QEventRSVP" (
    "id" TEXT PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("eventId","userId")
  );
  INSERT INTO "QEvent" VALUES ('ev-full', 100, 100), ('ev-last', 99, 100), ('ev-free', 0, 10);
`);

/** Повторяет последовательность запросов роутера. */
async function rsvp(eventId, userId) {
  await db.exec("BEGIN");
  try {
    const ev = await db.query(
      `SELECT "attendeeCount","capacity" FROM "QEvent" WHERE "id"=$1 FOR UPDATE`,
      [eventId],
    );
    if (ev.rows.length === 0) {
      await db.exec("ROLLBACK");
      return { code: 404 };
    }
    const { attendeeCount: current, capacity } = ev.rows[0];

    const mine = await db.query(
      `SELECT "status" FROM "QEventRSVP" WHERE "eventId"=$1 AND "userId"=$2`,
      [eventId, userId],
    );
    const status = mine.rows[0]?.status === "going" ? "not-going" : "going";

    if (status === "going" && current >= capacity) {
      await db.exec("ROLLBACK");
      return { code: 409 };
    }

    if (mine.rows[0]) {
      await db.query(`UPDATE "QEventRSVP" SET "status"=$1 WHERE "eventId"=$2 AND "userId"=$3`, [status, eventId, userId]);
    } else {
      await db.query(
        `INSERT INTO "QEventRSVP" ("id","eventId","userId","status") VALUES ($1,$2,$3,'going')`,
        [`r-${eventId}-${userId}`, eventId, userId],
      );
    }

    const upd = await db.query(
      `UPDATE "QEvent" SET "attendeeCount"=GREATEST(0,"attendeeCount"+$1) WHERE "id"=$2 RETURNING "attendeeCount"`,
      [status === "going" ? 1 : -1, eventId],
    );
    await db.exec("COMMIT");
    return { code: 200, status, attendeeCount: upd.rows[0].attendeeCount };
  } catch (e) {
    await db.exec("ROLLBACK").catch(() => {});
    return { code: 500, error: e.message };
  }
}

check("FOR UPDATE внутри транзакции исполняется", (await rsvp("ev-free", "u1")).code === 200);

const full = await rsvp("ev-full", "u2");
check("полное событие: отказ 409", full.code === 409, `код ${full.code}`);

const last = await rsvp("ev-last", "u3");
check("последнее место занимается, счётчик ровно capacity", last.code === 200 && last.attendeeCount === 100,
  `код ${last.code}, стало ${last.attendeeCount}`);

const afterLast = await rsvp("ev-last", "u4");
check("следующий за последним получает 409", afterLast.code === 409, `код ${afterLast.code}`);

const off = await rsvp("ev-last", "u3");
check("отказ от участия проходит на полном событии и освобождает место",
  off.code === 200 && off.status === "not-going" && off.attendeeCount === 99,
  `код ${off.code}, стало ${off.attendeeCount}`);

const nowFree = await rsvp("ev-last", "u4");
check("освободившееся место можно занять", nowFree.code === 200 && nowFree.attendeeCount === 100);

const missing = await rsvp("ev-nope", "u5");
check("несуществующее событие: 404 без записи", missing.code === 404, `код ${missing.code}`);

const orphan = await db.query(`SELECT count(*)::int AS n FROM "QEventRSVP" WHERE "eventId"='ev-nope'`);
check("в пустоту ничего не записалось", orphan.rows[0].n === 0);

// Счётчик не уходит ниже нуля — GREATEST(0, ...) на месте.
await db.exec(`UPDATE "QEvent" SET "attendeeCount"=0 WHERE "id"='ev-free'`);
const below = await rsvp("ev-free", "u1"); // снятие при нулевом счётчике
check("счётчик не уходит в минус", below.attendeeCount === 0, `стало ${below.attendeeCount}`);

const failed = checks.filter((c) => !c.ok).length;
console.log(`\nПройдено ${checks.length - failed} из ${checks.length}`);
process.exit(failed === 0 ? 0 : 1);
