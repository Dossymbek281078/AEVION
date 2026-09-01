import { describe, test, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сводка «фактическая выручка по каналам» не обещает больше, чем знает.
 *
 * ЗАЧЕМ. Панель выручки считала сумму из АДРЕСА ВОЗВРАТА — нашу ожидаемую, а не
 * списанную. 01.09.2026 выяснилось, что кассы не смотрели на сумму вовсе.
 * Фактическая сумма теперь пишется в запись подписки, и эта ручка её
 * складывает — а значит от неё зависит цифра, по которой будут судить, что
 * окупилось.
 *
 * Форму ответа задал ЧИТАТЕЛЬ (окно, строящее панель), и каждое требование тут
 * с ценой ошибки: сумма только по записям, где она есть; знаменатели withAmount
 * и withChannel порознь (это РАЗНЫЕ пробелы); записи без канала в ключ
 * "direct", а не в мусор, иначе сумма по каналам не сойдётся с общей.
 */

const TOKEN = "adm-test-000";
const FILE = join(tmpdir(), "aevion-subs-test.jsonl");

const SAVED_TOKEN = process.env.ADMIN_TOKEN;
const SAVED_FILE = process.env.SUBSCRIPTIONS_FILE;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function seed(rows: Array<Record<string, unknown>>) {
  writeFileSync(FILE, rows.map((r) => JSON.stringify(r)).join(String.fromCharCode(10)), "utf8");
}

async function load() {
  const mod = await import("../src/routes/provisioning");
  const app = express();
  app.use("/api/pricing/provisioning", mod.provisioningRouter);
  return app;
}

beforeEach(() => {
  process.env.SUBSCRIPTIONS_FILE = FILE;
  process.env.ADMIN_TOKEN = TOKEN;
  seed([
    { id: "s1", ts: hoursAgo(1), email: "a@t.aev", tierId: "lite", channel: "tt", amountUsd: 19 },
    { id: "s2", ts: hoursAgo(2), email: "b@t.aev", tierId: "lite", channel: "tt" },
    { id: "s3", ts: hoursAgo(3), email: "c@t.aev", tierId: "full", amountUsd: 29 },
    { id: "s4", ts: hoursAgo(24 * 40), email: "d@t.aev", tierId: "lite", channel: "tt", amountUsd: 99 },
  ]);
});

afterEach(() => {
  rmSync(FILE, { force: true });
  if (SAVED_TOKEN === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = SAVED_TOKEN;
  if (SAVED_FILE === undefined) delete process.env.SUBSCRIPTIONS_FILE;
  else process.env.SUBSCRIPTIONS_FILE = SAVED_FILE;
});

describe("выручка по каналам: закрыта и честна", () => {
  test("маршрут ДЕЙСТВИТЕЛЬНО подключён к приложению", () => {
    // Стенд выше монтирует роутер своей рукой — и остался бы зелёным, даже
    // если бы в приложении маршрут не был подключён вовсе. Класс известный:
    // у нас 524 теста монтировали роутер сами, и удаление записи из манифеста
    // не красило ни один. Поэтому подключение проверяется отдельно и по
    // ИСХОДНИКУ приложения, а не по стенду.
    const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
    expect(
      src.includes('app.use("/api/pricing/provisioning", provisioningRouter)'),
      "роутер выдачи прав не подключён — ручка отвечала бы 404 при зелёных тестах",
    ).toBe(true);
  });

  test("без ADMIN_TOKEN ручка ЗАКРЫТА, а не открыта", async () => {
    // Отличие от соседних админ-ручек намеренное. У них проверка вида
    // `if (required)` оставляет ручку открытой, когда переменная не задана —
    // и ровно так /api/metrics оказался открыт на проде. Здесь деньги.
    delete process.env.ADMIN_TOKEN;
    const r = await request(await load()).get("/api/pricing/provisioning/subscriptions/by-channel");
    expect(r.status, "незаданный токен открыл ручку с деньгами").toBe(503);
  });

  test("с чужим токеном — отказ", async () => {
    const r = await request(await load())
      .get("/api/pricing/provisioning/subscriptions/by-channel")
      // Значение латиницей намеренно: заголовок HTTP кириллицу не принимает, и
      // тест падал не на предмете, а на собственном оформлении.
      .set("X-Admin-Token", "wrong-token");
    expect(r.status).toBe(401);
  });

  test("сумма считается только по записям, где она есть", async () => {
    const r = await request(await load())
      .get("/api/pricing/provisioning/subscriptions/by-channel")
      .set("X-Admin-Token", TOKEN);
    expect(r.status).toBe(200);
    // Окно по умолчанию 720 ч — запись сорокадневной давности в него не входит.
    expect(r.body.total, "окно захватило запись старше окна").toBe(3);
    expect(r.body.byChannel.tt.count, "покупок по каналу").toBe(2);
    expect(r.body.byChannel.tt.withAmount, "из них с известной суммой").toBe(1);
    expect(r.body.byChannel.tt.amountUsdSum, "покупка без суммы добавила ноль").toBe(19);
  });

  test("знаменатели withAmount и withChannel считаются ПОРОЗНЬ", async () => {
    // Это разные пробелы: у PayBox нет суммы, у прямого захода нет канала.
    // Одно число их смешает, и дыра станет невидимой.
    const r = await request(await load())
      .get("/api/pricing/provisioning/subscriptions/by-channel")
      .set("X-Admin-Token", TOKEN);
    expect(r.body.withAmount).toBe(2);
    expect(r.body.withChannel).toBe(2);
  });

  test("покупка без канала идёт в direct, а не пропадает", async () => {
    // Иначе сумма по каналам не сойдётся с общей, и это будет выглядеть
    // потерей денег там, где потери нет.
    const r = await request(await load())
      .get("/api/pricing/provisioning/subscriptions/by-channel")
      .set("X-Admin-Token", TOKEN);
    expect(r.body.byChannel.direct?.count, "покупка без канала исчезла").toBe(1);
    const sum = Object.values(r.body.byChannel as Record<string, { count: number }>)
      .reduce((n, c) => n + c.count, 0);
    expect(sum, "сумма по каналам не сходится с общей").toBe(r.body.total);
  });

  test("мусор в параметре окна не обнуляет выборку", async () => {
    // NaN проходит сквозь Math.min/Math.max и молча даёт пустое окно — тогда
    // панель покажет ноль выручки и это прочтут как «продаж нет».
    const r = await request(await load())
      .get("/api/pricing/provisioning/subscriptions/by-channel?hours=zzz")
      .set("X-Admin-Token", TOKEN);
    expect(r.body.windowHours, "мусор стал окном").toBe(720);
    expect(r.body.total).toBe(3);
  });

  test("узкое окно сужает выборку", async () => {
    // Контроль в другую сторону: если бы окно не работало вовсе, предыдущие
    // проверки прошли бы и на неотфильтрованных данных.
    const r = await request(await load())
      .get("/api/pricing/provisioning/subscriptions/by-channel?hours=1.5")
      .set("X-Admin-Token", TOKEN);
    expect(r.body.total, "окно не сужает выборку").toBe(1);
  });
});
