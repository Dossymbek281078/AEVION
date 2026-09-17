import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { constitutionCheckoutRouter } from "../src/routes/constitutionCheckout";

/**
 * Касса Конституции: старая ссылка не ведёт ни в ошибку, ни в продажу.
 *
 * ИСТОРИЯ ФАЙЛА. 29.08.2026 здесь ловили живую ошибку прода: готовность Lemon
 * Squeezy проверялась ОДНИМ ключом, а чек требует трёх значений — наполовину
 * настроенный провайдер заслонял готовый Gumroad и падал пятисоткой, а человек по
 * ссылке из письма уезжал на `?error=checkout_failed`. Сторож держал: неполная
 * настройка не заслоняет запасной путь; товар Team не уводится на товар Pro.
 *
 * С 15.09.2026 (слово основателя) Конституция отдельно НЕ продаётся — она входит в
 * подписку AEVION на любой срок. Предмет «какой провайдер выбран» исчез целиком:
 * касса не выбирает никого. Имя файла прежнее, чтобы история не терялась, а защита
 * переведена на то, что от той истории осталось главным:
 *
 *   • ни одна настройка провайдера (неполная, полная, запасная ссылка Gumroad) не
 *     включает продажу по снятой цене — ответ всегда 410 и адрес страницы цен;
 *   • в кассу не уходит НИ ОДНОГО сетевого вызова (иначе вернулась бы третья цена
 *     одного и того же доступа);
 *   • ссылка из письма ведёт на страницу цен, а не на ошибку.
 */

const app = express();
app.use(express.json());
app.use("/api/constitution/checkout", constitutionCheckoutRouter);

const KEYS = [
  "LEMON_SQUEEZY_API_KEY",
  "LEMON_SQUEEZY_STORE_ID",
  "LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID",
  "GUMROAD_CONSTITUTION_PRO_PERMALINK",
  "GUMROAD_PERMALINK_CONSTITUTION_PRO",
  "GUMROAD_CONSTITUTION_TEAM_PERMALINK",
  "GUMROAD_DEFAULT_PERMALINK",
];
let saved: Record<string, string | undefined> = {};
const сеть = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: { id: "co_1", attributes: { url: "https://pay.example/co_1" } } }),
}));

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  сеть.mockClear();
  vi.stubGlobal("fetch", сеть);
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

/** Настройки, каждая из которых раньше включала какой-то путь оплаты. */
const НАСТРОЙКИ: Array<[string, Record<string, string>]> = [
  ["ничего не настроено", {}],
  ["один ключ Lemon Squeezy (наполовину настроен)", { LEMON_SQUEEZY_API_KEY: "test-key" }],
  ["ключ и магазин без варианта", { LEMON_SQUEEZY_API_KEY: "test-key", LEMON_SQUEEZY_STORE_ID: "42" }],
  [
    "Lemon Squeezy настроен полностью",
    { LEMON_SQUEEZY_API_KEY: "test-key", LEMON_SQUEEZY_STORE_ID: "42", LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID: "777" },
  ],
  ["товар Pro на Gumroad", { GUMROAD_CONSTITUTION_PRO_PERMALINK: "pyiaz", GUMROAD_PERMALINK_CONSTITUTION_PRO: "pyiaz" }],
  ["товар Team и общая запасная ссылка", { GUMROAD_CONSTITUTION_TEAM_PERMALINK: "wjvquw", GUMROAD_DEFAULT_PERMALINK: "xpxzam" }],
];

describe("Конституция отдельно не продаётся — при любой настройке кассы", () => {
  for (const [имя, env] of НАСТРОЙКИ) {
    for (const tier of ["pro", "team"]) {
      test(`${имя}: ${tier} — 410 и страница цен, в кассу ни одного вызова`, async () => {
        Object.assign(process.env, env);
        const res = await request(app).post("/api/constitution/checkout/session").send({ tier });

        expect(res.status, "снятый товар снова продаётся или касса упала").toBe(410);
        expect(res.body.error).toBe("not_sold_separately");
        expect(String(res.body.pricingUrl), "покупателя не направили к подписке").toMatch(/\/pricing$/);
        expect(res.body.checkoutUrl, "выдана ссылка на оплату снятого товара").toBeUndefined();
        expect(JSON.stringify(res.body), "в ответе всплыл товар Gumroad").not.toMatch(/pyiaz|wjvquw|xpxzam/);
        expect(сеть, "касса сходила к провайдеру за снятым товаром").not.toHaveBeenCalled();
      });
    }
  }

  test("ссылка из письма ведёт на страницу цен, а не на ошибку — и при неполной настройке", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    for (const tier of ["pro", "team"]) {
      const res = await request(app).get(`/api/constitution/checkout/go/${tier}`);
      expect(res.status).toBe(302);
      expect(String(res.headers.location)).toMatch(/\/pricing$/);
      expect(String(res.headers.location)).not.toContain("error=checkout_failed");
    }
    expect(сеть).not.toHaveBeenCalled();
  });

  test("КОНТРОЛЬ: 410 — ответ именно этой ручки, а не всего роутера", async () => {
    // Иначе «410 при любой настройке» проходило бы на заглушке, которая отвечает
    // 410 на что угодно.
    const res = await request(app).post("/api/constitution/checkout/nope").send({});
    expect(res.status).toBe(404);
  });
});
