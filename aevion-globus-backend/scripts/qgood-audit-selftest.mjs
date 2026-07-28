/**
 * Проверка аудит-скрипта QGood исполнением против НАСТОЯЩЕГО Postgres.
 *
 * Поднимает pglite за TCP-сокетом, кладёт данные и запускает
 * scripts/qgood-duplicate-donations-audit.mjs как отдельный процесс — ровно
 * так, как его будут запускать против боевой базы.
 *
 * Две грабли стенда, на которые уже наступили (не повторять):
 *   1. `spawnSync` блокирует событийный цикл родителя, а сокет-сервер живёт
 *      именно в нём — принять соединение некому, и проверяемый скрипт падает
 *      по таймауту не по своей вине. Только асинхронный запуск.
 *   2. PGLiteSocketServer обслуживает одно соединение за раз. Поэтому на
 *      каждый сценарий поднимается свой сервер на своём порту, данные
 *      засеваются ДО старта сервера, и во время прогона ребёнка родитель к
 *      базе не обращается.
 *
 * Запуск: npm run verify:qgood-audit
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pexec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const auditScript = path.join(here, "qgood-duplicate-donations-audit.mjs");

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push(ok);
  console.log(`${ok ? "OK  " : "ПЛОХО"} ${name}${detail ? ` — ${detail}` : ""}`);
};

let port = 5450;

/** Свежая база + сервер, засев, один прогон аудита, остановка. */
async function scenario(seedSql) {
  const db = await PGlite.create();
  if (seedSql) await db.exec(seedSql);
  const p = port++;
  const server = new PGLiteSocketServer({ db, port: p, host: "127.0.0.1" });
  await server.start();
  try {
    const env = { ...process.env, DATABASE_URL: `postgres://postgres@127.0.0.1:${p}/postgres` };
    try {
      const { stdout } = await pexec(process.execPath, [auditScript], { env, encoding: "utf8" });
      return { status: 0, out: stdout };
    } catch (e) {
      return { status: e.code ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  } finally {
    await server.stop();
    await db.close();
  }
}

const TABLE = `
  CREATE TABLE "QGoodDonation" (
    "id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL, "paymentRef" TEXT
  );`;

// 1. Таблицы нет — не падать и сказать по-человечески.
let r = await scenario(null);
check("таблицы нет: код 0 и понятное сообщение",
  r.status === 0 && /проверять нечего/.test(r.out), `код ${r.status}`);

// 2. Данные чистые — индекс встанет.
r = await scenario(`${TABLE}
  INSERT INTO "QGoodDonation" VALUES ('d1','c1',5000,'pay_A'),('d2','c1',7000,'pay_B'),('d3','c1',100,NULL);`);
check("дублей нет: код 0", r.status === 0 && /Дублирующихся платежей нет/.test(r.out), `код ${r.status}`);
check("видит отсутствие индекса", /ОТСУТСТВУЕТ/.test(r.out));

// 3. Дубли: pay_A записан трижды по 50.00 — лишних две записи на 100.00.
r = await scenario(`${TABLE}
  INSERT INTO "QGoodDonation" VALUES
    ('d1','c1',5000,'pay_A'),('d4','c1',5000,'pay_A'),('d5','c1',5000,'pay_A'),
    ('d2','c1',7000,'pay_B');`);
check("дубли найдены: код 2", r.status === 2, `код ${r.status}`);
check("посчитаны лишние записи", /Лишних записей: 2/.test(r.out),
  (r.out.match(/Лишних записей: \d+/) || ["не найдено"])[0]);
check("посчитано завышение суммы", /завышены кампании: 100\.00/.test(r.out),
  (r.out.match(/завышены кампании: [\d.]+/) || ["не найдено"])[0]);
check("предупреждает, что индекс упадёт", /УПАДЁТ/.test(r.out));
check("называет конкретную ссылку платежа", /pay_A — записей 3/.test(r.out));

// 4. Индекс уже стоит — скрипт это видит.
r = await scenario(`${TABLE}
  INSERT INTO "QGoodDonation" VALUES ('d1','c1',5000,'pay_A');
  CREATE UNIQUE INDEX "QGoodDonation_paymentRef_key" ON "QGoodDonation" ("paymentRef") WHERE "paymentRef" IS NOT NULL;`);
check("видит уже стоящий индекс", /УЖЕ СТОИТ/.test(r.out));

// 5. Ничего не пишет: после прогона данные те же.
{
  const db = await PGlite.create();
  await db.exec(`${TABLE}
    INSERT INTO "QGoodDonation" VALUES ('d1','c1',5000,'pay_A'),('d4','c1',5000,'pay_A');`);
  const p = port++;
  const server = new PGLiteSocketServer({ db, port: p, host: "127.0.0.1" });
  await server.start();
  try {
    await pexec(process.execPath, [auditScript], {
      env: { ...process.env, DATABASE_URL: `postgres://postgres@127.0.0.1:${p}/postgres` },
      encoding: "utf8",
    }).catch(() => {});
  } finally {
    await server.stop();
  }
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM "QGoodDonation"`);
  const { rows: idx } = await db.query(
    `SELECT count(*)::int AS n FROM pg_indexes WHERE tablename='QGoodDonation' AND indexname='QGoodDonation_paymentRef_key'`,
  );
  check("скрипт ничего не изменил: строк столько же и индекс не создан",
    rows[0].n === 2 && idx[0].n === 0, `строк ${rows[0].n}, индексов ${idx[0].n}`);
  await db.close();
}

const failed = checks.filter((x) => !x).length;
console.log(`\nПройдено ${checks.length - failed} из ${checks.length}`);
process.exit(failed === 0 ? 0 : 1);
