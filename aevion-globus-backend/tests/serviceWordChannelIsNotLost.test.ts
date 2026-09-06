import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Канал со служебным именем не исчезает из отчёта о выручке.
 *
 * ЗАМЕР 04.09.2026, поведением, а не рассуждением. Накопитель был обычным
 * `{}`, а ключ — `s.channel`, который приходит из адреса возврата, то есть
 * снаружи. Проба на голом node:
 *
 *     каналы в ответе: ["tiktok"]        ← при трёх поданных
 *     ({}).count: NaN                    ← Object.prototype загрязнён
 *
 * Два следствия, и второе хуже первого:
 *
 *   1. Канал с именем `constructor` или `__proto__` пропадает из отчёта
 *      МОЛЧА — его выручка не попадает никуда, а сумма выглядит целой.
 *   2. Присваивание уходит в `Object.prototype`, и NaN наследует КАЖДЫЙ
 *      объект процесса до перезапуска. Это уже не про отчёт.
 *
 * ПОЧЕМУ СТОРОЖ СВЕРЯЕТ ДВА НАШИХ ОТВЕТА. Ручка отдаёт и разбивку
 * `byChannel`, и число `withChannel` — сколько записей вообще имело канал.
 * На сломанном коде они расходятся: 3 против 1. Проверять надо именно
 * согласие двух полей, а не наличие ключа: список известных имён устареет,
 * а расхождение поймает любое новое служебное слово.
 */

const dir = mkdtempSync(join(tmpdir(), "aevion-chan-"));
const file = join(dir, "subscriptions.jsonl");
const NOW = Date.now();
const DAY = 86400000;

/** Служебные имена вперемешку с обычным: обычный служит контролем. */
const КАНАЛЫ = ["tiktok", "__proto__", "constructor", "toString"];

const ROWS = КАНАЛЫ.map((channel, i) => ({
  id: `c${i}`,
  ts: new Date(NOW - DAY).toISOString(),
  email: "buyer@example.com",
  tierId: "lite",
  period: "monthly",
  seats: 1,
  modules: [],
  trialDays: 0,
  validUntil: new Date(NOW + 30 * DAY).toISOString(),
  source: "paybox",
  channel,
  amountUsd: 19,
}));

/**
 * Отдельная запись со служебным именем в ТАРИФЕ.
 *
 * Тот же класс, другой накопитель: `byTier` перечисляет семь известных
 * тарифов, и присваивание по ключу `__proto__` у обычного объекта молча
 * не выполняется вовсе — тариф пропадает из сводки, не оставив следа.
 */
const РЯД_СЛУЖЕБНЫЙ_ТАРИФ = { ...ROWS[0], id: "t1", tierId: "__proto__", channel: "email" };

let app: express.Express;
let mod: typeof import("../src/routes/provisioning");

beforeAll(async () => {
  process.env.SUBSCRIPTIONS_FILE = file;
  // Токен только ASCII: кириллица в значении HTTP-заголовка недопустима,
  // и supertest падает в setHeader — красный, не имеющий отношения к предмету.
  process.env.ADMIN_TOKEN = "test-admin-token";
  writeFileSync(file, [...ROWS, РЯД_СЛУЖЕБНЫЙ_ТАРИФ].map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  mod = await import("../src/routes/provisioning");
  app = express();
  app.use("/api/pricing/provisioning", mod.provisioningRouter);
  // 60с: модуль тянет тяжёлые зависимости, на этой машине один import ~13с.
}, 60_000);

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.ADMIN_TOKEN;
  rmSync(dir, { recursive: true, force: true });
});

const ответ = () =>
  request(app)
    .get("/api/pricing/provisioning/subscriptions/by-channel")
    .set("x-admin-token", "test-admin-token");

describe("выручка по каналам не теряет служебные имена", () => {
  test("контроль: обычный канал вообще считается", async () => {
    // Иначе «служебные не теряются» могло бы означать «ручка не отвечает».
    const r = await ответ();
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    expect(r.body.byChannel.tiktok, "обычный канал не посчитан").toEqual({
      count: 1,
      amountUsdSum: 19,
      withAmount: 1,
    });
  });

  test("ни один канал не исчез: два наших ответа сходятся", async () => {
    const r = await ответ();
    const посчитано = Object.values(
      r.body.byChannel as Record<string, { count: number }>,
    ).reduce((a, x) => a + x.count, 0);
    expect(
      посчитано,
      `в разбивке ${посчитано} покупок, а поле withChannel говорит ${r.body.withChannel}: ` +
        "канал со служебным именем разрешился в наследство и пропал из отчёта молча",
    ).toBe(r.body.withChannel);
  });

  test("каждое служебное имя названо поимённо", async () => {
    const r = await ответ();
    const пропали = КАНАЛЫ.filter((k) => !Object.keys(r.body.byChannel).includes(k));
    expect(пропали, "эти каналы не попали в ответ").toEqual([]);
  });

  test("Object.prototype не загрязнён после запроса", async () => {
    await ответ();
    const чужой = {} as Record<string, unknown>;
    expect(чужой.count, "count унаследован — присваивание ушло в прототип").toBeUndefined();
    expect(чужой.amountUsdSum, "amountUsdSum унаследован").toBeUndefined();
  });
});

describe("сводка по тарифам не теряет служебные имена", () => {
  test("контроль: обычный тариф посчитан", () => {
    // Иначе «служебный тариф на месте» могло бы означать «сводка пуста».
    expect(mod.aggregateSubscriptions().byTier.lite, "обычный тариф не посчитан").toBe(4);
  });

  test("тариф со служебным именем не пропал", () => {
    const byTier = mod.aggregateSubscriptions().byTier as unknown as Record<string, number>;
    expect(
      Object.keys(byTier),
      "присваивание по ключу __proto__ у обычного объекта не выполняется — " +
        "тариф исчезает из сводки, и снаружи это неотличимо от его отсутствия",
    ).toContain("__proto__");
  });
});
