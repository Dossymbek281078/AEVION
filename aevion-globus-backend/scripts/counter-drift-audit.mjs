/**
 * Расхождение денормализованных счётчиков со строками, которые они считают.
 * ТОЛЬКО ЧТЕНИЕ.
 *
 * Три пары «колонка против строк» переведены на транзакции 28.07.2026
 * (qsocial лайки, qjobs отклики, qlearn записи на курс). Транзакции остановили
 * НОВЫЕ расхождения, но накопленное до этого никуда не делось: счётчики могли
 * уехать, пока обновление шло отдельным запросом и — в случае лайков — росло
 * даже от отброшенного дубля.
 *
 * Аудит участников событий живёт отдельно (qevents-attendee-drift-audit.mjs),
 * потому что там есть ещё и переполнение вместимости.
 *
 * Скрипт ничего не пишет. Пересчёт — решение владельца.
 *
 * Запуск: DATABASE_URL=... node scripts/counter-drift-audit.mjs
 * Коды выхода: 0 — сходится, 2 — расхождения, 1 — проверить не удалось.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Нужен DATABASE_URL. Скрипт только читает, но без адреса базы читать нечего.");
  process.exit(1);
}
const host = (() => { try { return new URL(url).host; } catch { return "(адрес не разобран)"; } })();
console.log(`База: ${host} — режим только чтение\n`);

const db = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
await db.connect();

/** Пары «таблица-владелец → таблица-строки». */
const PAIRS = [
  {
    имя: "лайки постов",
    owner: '"QSocialPost"', counter: '"likesCount"',
    rows: '"QSocialLike"', fk: '"postId"', where: "",
    подпись: "постов",
  },
  {
    имя: "отклики на вакансии",
    owner: '"QJobsPosting"', counter: '"applicantCount"',
    rows: '"QJobsApplication"', fk: '"jobId"', where: "",
    подпись: "вакансий",
  },
  {
    имя: "записи на курсы",
    owner: '"QLearnCourse"', counter: '"enrollmentCount"',
    rows: '"QLearnEnrollment"', fk: '"courseId"', where: "",
    подпись: "курсов",
  },
];

let проблемных = 0;
let пропущено = 0;

try {
  for (const p of PAIRS) {
    const { rows: exists } = await db.query(
      `SELECT to_regclass($1) IS NOT NULL AS o, to_regclass($2) IS NOT NULL AS r`,
      [p.owner.replace(/"/g, '"'), p.rows.replace(/"/g, '"')],
    );
    if (!exists[0].o || !exists[0].r) {
      console.log(`— ${p.имя}: таблиц нет, пропускаю`);
      пропущено += 1;
      continue;
    }

    const { rows } = await db.query(`
      SELECT o."id",
             o.${p.counter}::int                    AS "счётчик",
             COALESCE(c.n, 0)::int                   AS "строк",
             (o.${p.counter} - COALESCE(c.n, 0))::int AS "расхождение"
      FROM ${p.owner} o
      LEFT JOIN (
        SELECT ${p.fk} AS ref, COUNT(*) AS n FROM ${p.rows} ${p.where} GROUP BY ${p.fk}
      ) c ON c.ref = o."id"
      WHERE o.${p.counter} <> COALESCE(c.n, 0)
      ORDER BY ABS(o.${p.counter} - COALESCE(c.n, 0)) DESC
      LIMIT 50
    `);

    if (rows.length === 0) {
      console.log(`OK  ${p.имя}: счётчики сходятся`);
      continue;
    }

    проблемных += rows.length;
    const сумма = rows.reduce((n, r) => n + Math.abs(r["расхождение"]), 0);
    console.log(`РАСХОЖДЕНИЕ  ${p.имя}: ${rows.length} ${p.подпись}, суммарно ${сумма} единиц`);
    for (const r of rows.slice(0, 10)) {
      const знак = r["расхождение"] > 0 ? "завышен" : "занижен";
      console.log(`     ${r.id} — счётчик ${r["счётчик"]}, строк ${r["строк"]} (${знак} на ${Math.abs(r["расхождение"])})`);
    }
    if (rows.length > 10) console.log(`     … и ещё ${rows.length - 10}`);
  }

  if (пропущено === PAIRS.length) {
    console.log("\nНи одной из пар в базе нет — проверять нечего.");
    process.exit(0);
  }
  if (проблемных === 0) {
    console.log("\nВсе счётчики сходятся со строками.");
    process.exit(0);
  }

  console.log(
    `\nЧТО ЭТО ЗНАЧИТ:\n` +
      `  1. Расхождения накоплены ДО перевода этих мест на транзакции (28.07.2026);\n` +
      `     новые появляться не должны.\n` +
      `  2. Завышенный счётчик — это число, которое видит человек: «37 откликов»\n` +
      `     там, где их 12.\n` +
      `  3. Пересчёт (UPDATE <владелец> SET <счётчик> = <число строк>) — решение\n` +
      `     владельца; скрипт намеренно этого не делает.`,
  );
  process.exit(2);
} catch (e) {
  console.error(`Проверить не удалось: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
} finally {
  await db.end().catch(() => {});
}
