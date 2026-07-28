/**
 * QGood — аудит дублирующихся платежей. ТОЛЬКО ЧТЕНИЕ.
 *
 * Зачем. До 28.07.2026 у "paymentRef" не было уникального индекса, а роутер
 * увеличивал raisedCents и donorCount на каждую запись. Значит один платёж,
 * записанный дважды (ретрай вебхука, обновление страницы подтверждения),
 * дважды поднимал публичную сумму кампании. Прежде чем ставить индекс, надо
 * знать две вещи: (1) встанет ли он вообще — на таблице с дублями CREATE
 * UNIQUE INDEX падает; (2) насколько уже завышены цифры на витрине.
 *
 * Скрипт НИЧЕГО не пишет: только SELECT. Ни DDL, ни UPDATE, ни DELETE.
 * Он специально не умеет чинить — исправление сумм на проде это решение
 * владельца, а не побочный эффект диагностики.
 *
 * Запуск:
 *   DATABASE_URL=postgres://... node scripts/qgood-duplicate-donations-audit.mjs
 *
 * Коды выхода: 0 — дублей нет, индекс встанет; 2 — дубли есть, разбирать
 * руками; 1 — не смогли проверить.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Нужен DATABASE_URL. Скрипт только читает, но без адреса базы читать нечего.");
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "(адрес не разобран)";
  }
})();
console.log(`База: ${host} — режим только чтение\n`);

// Одно подключение, три запроса на чтение — пул тут лишний, а Client ещё и
// проверяем локально (pglite за сокетом пул почему-то не принимает).
const db = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
await db.connect();

try {
  const { rows: tbl } = await db.query(
    `SELECT to_regclass('"QGoodDonation"') IS NOT NULL AS exists`,
  );
  if (!tbl[0].exists) {
    console.log("Таблицы QGoodDonation нет — проверять нечего.");
    process.exit(0);
  }

  const { rows: idx } = await db.query(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'QGoodDonation' AND indexname = 'QGoodDonation_paymentRef_key'`,
  );
  console.log(idx.length > 0
    ? "Уникальный индекс по paymentRef: УЖЕ СТОИТ — защита от двойной записи работает."
    : "Уникальный индекс по paymentRef: ОТСУТСТВУЕТ — защиты сейчас нет.");

  const { rows: dups } = await db.query(`
    SELECT "paymentRef",
           COUNT(*)::int                        AS "записей",
           (COUNT(*) - 1)::int                  AS "лишних",
           SUM("amountCents")::bigint           AS "суммаВсего",
           (SUM("amountCents") - MIN("amountCents"))::bigint AS "лишняяСумма",
           MIN("campaignId")                    AS "кампания"
    FROM "QGoodDonation"
    WHERE "paymentRef" IS NOT NULL
    GROUP BY "paymentRef"
    HAVING COUNT(*) > 1
    ORDER BY (COUNT(*) - 1) DESC
    LIMIT 50
  `);

  if (dups.length === 0) {
    console.log("\nДублирующихся платежей нет. Уникальный индекс встанет без правки данных.");
    process.exit(0);
  }

  const лишнихЗаписей = dups.reduce((n, r) => n + r["лишних"], 0);
  const лишнихДенег = dups.reduce((n, r) => n + Number(r["лишняяСумма"]), 0);

  console.log(`\nНАЙДЕНЫ ДУБЛИ: ${dups.length} платежей записаны более одного раза.`);
  console.log(`Лишних записей: ${лишнихЗаписей}`);
  console.log(`На эту сумму завышены кампании: ${(лишнихДенег / 100).toFixed(2)} (в валюте кампании)\n`);

  for (const r of dups.slice(0, 20)) {
    console.log(
      `  ${r["paymentRef"]} — записей ${r["записей"]}, лишних ${r["лишних"]}, ` +
        `завышение ${(Number(r["лишняяСумма"]) / 100).toFixed(2)}, кампания ${r["кампания"]}`,
    );
  }
  if (dups.length > 20) console.log(`  … и ещё ${dups.length - 20}`);

  console.log(
    `\nЧТО ЭТО ЗНАЧИТ:\n` +
      `  1. CREATE UNIQUE INDEX на "paymentRef" сейчас УПАДЁТ — сначала разобрать дубли.\n` +
      `  2. Публичные суммы кампаний уже завышены на указанную величину.\n` +
      `  3. Скрипт намеренно ничего не чинит: и удаление лишних строк, и пересчёт\n` +
      `     raisedCents — решения владельца, а не побочный эффект диагностики.`,
  );
  process.exit(2);
} catch (e) {
  console.error(`Проверить не удалось: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
} finally {
  await db.end().catch(() => {});
}
