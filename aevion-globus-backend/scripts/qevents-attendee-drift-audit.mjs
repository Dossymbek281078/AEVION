/**
 * QEvents — расхождение счётчика участников с самими записями. ТОЛЬКО ЧТЕНИЕ.
 *
 * Зачем. До 28.07.2026 ветка Postgres не проверяла вместимость и увеличивала
 * "attendeeCount" безусловно, а RSVP вставлялся отдельным запросом вне
 * транзакции. Исправление (коммит c9c5fa94) остановило расхождение НА БУДУЩЕЕ,
 * но уже накопленное не починило: события могут показывать участников больше
 * (или меньше), чем есть записей "going", и даже больше capacity.
 *
 * Скрипт только сравнивает и НИЧЕГО не пишет. Чинить намеренно не умеет:
 * пересчёт счётчиков на проде — решение владельца, а не побочный эффект
 * диагностики.
 *
 * Запуск:
 *   DATABASE_URL=postgres://... node scripts/qevents-attendee-drift-audit.mjs
 *
 * Коды выхода: 0 — всё сходится; 2 — есть расхождения; 1 — проверить не удалось.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Нужен DATABASE_URL. Скрипт только читает, но без адреса базы читать нечего.");
  process.exit(1);
}

const host = (() => {
  try { return new URL(url).host; } catch { return "(адрес не разобран)"; }
})();
console.log(`База: ${host} — режим только чтение\n`);

const db = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
await db.connect();

try {
  const { rows: tbl } = await db.query(
    `SELECT to_regclass('"QEvent"') IS NOT NULL AS ev, to_regclass('"QEventRSVP"') IS NOT NULL AS rsvp`,
  );
  if (!tbl[0].ev || !tbl[0].rsvp) {
    console.log("Таблиц QEvent/QEventRSVP нет — проверять нечего.");
    process.exit(0);
  }

  const { rows } = await db.query(`
    SELECT e."id",
           e."title",
           e."capacity"::int                          AS capacity,
           e."attendeeCount"::int                     AS "счётчик",
           COALESCE(r.going, 0)::int                  AS "записейGoing",
           (e."attendeeCount" - COALESCE(r.going, 0))::int AS "расхождение"
    FROM "QEvent" e
    LEFT JOIN (
      SELECT "eventId", COUNT(*) AS going
      FROM "QEventRSVP" WHERE "status" = 'going'
      GROUP BY "eventId"
    ) r ON r."eventId" = e."id"
    WHERE e."attendeeCount" <> COALESCE(r.going, 0)
       OR e."attendeeCount" > e."capacity"
    ORDER BY ABS(e."attendeeCount" - COALESCE(r.going, 0)) DESC
    LIMIT 100
  `);

  if (rows.length === 0) {
    console.log("Счётчики сходятся с записями, переполнения вместимости нет.");
    process.exit(0);
  }

  const завышено = rows.filter((r) => r["расхождение"] > 0).length;
  const занижено = rows.filter((r) => r["расхождение"] < 0).length;
  const переполнено = rows.filter((r) => r["счётчик"] > r.capacity).length;

  console.log(`НАЙДЕНЫ РАСХОЖДЕНИЯ: ${rows.length} событий.`);
  console.log(`  счётчик больше записей: ${завышено}`);
  console.log(`  счётчик меньше записей: ${занижено}`);
  console.log(`  счётчик выше вместимости: ${переполнено}\n`);

  for (const r of rows.slice(0, 20)) {
    const флаг = r["счётчик"] > r.capacity ? "  ВЫШЕ ВМЕСТИМОСТИ" : "";
    console.log(
      `  ${r.id} «${String(r.title).slice(0, 40)}» — счётчик ${r["счётчик"]}, ` +
        `записей going ${r["записейGoing"]}, вместимость ${r.capacity}${флаг}`,
    );
  }
  if (rows.length > 20) console.log(`  … и ещё ${rows.length - 20}`);

  console.log(
    `\nЧТО ЭТО ЗНАЧИТ:\n` +
      `  1. Расхождения накоплены ДО исправления c9c5fa94 — новые появляться не должны.\n` +
      `  2. События со счётчиком выше вместимости уже пускали людей сверх лимита.\n` +
      `  3. Пересчёт (UPDATE "QEvent" SET "attendeeCount" = <записей going>) —\n` +
      `     решение владельца; скрипт намеренно этого не делает.`,
  );
  process.exit(2);
} catch (e) {
  console.error(`Проверить не удалось: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
} finally {
  await db.end().catch(() => {});
}
