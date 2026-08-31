import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { constitutionCheckoutRouter } from "../src/routes/constitutionCheckout";

/**
 * Наполовину настроенный провайдер не имеет права заслонять запасной.
 *
 * Найдено 29.08.2026 по живой ошибке прода в Sentry:
 * "LemonSqueezy not configured. Required: LEMON_SQUEEZY_API_KEY,
 *  LEMON_SQUEEZY_STORE_ID, LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID"
 * на POST /api/constitution/checkout/session.
 *
 * Причина не в LemonSqueezy. Готовность провайдера проверялась ОДНИМ ключом
 * (`Boolean(lsApiKey())`), а создание чека требует ТРЁХ значений. Основатель
 * завёл ключ — ветка включилась, заслонила готовый Gumroad и упала пятисоткой.
 * То есть проверка на нашей стороне была СЛАБЕЕ, чем у того, кто примет
 * значение дальше, — и платил за это покупатель.
 *
 * Тише всего это в GET /go/:tier: человек по ссылке из письма уезжал на
 * `?error=checkout_failed`, хотя касса была готова.
 *
 * Положительный случай здесь обязателен: без него починку удовлетворило бы и
 * «считать провайдера неготовым всегда», а это тоже потеря денег.
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

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("чекаут: неполная настройка провайдера не заслоняет запасной путь", () => {
  test("один ключ API без магазина и варианта — не пятисотка, а честная заглушка", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "pro" });

    expect(res.status, "покупатель получил ошибку сервера вместо кассы").toBe(200);
    expect(res.body.provider).toBe("stub");
  });

  test("ключ и магазин есть, варианта тарифа нет — тоже не пятисотка", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "42";

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "pro" });

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("stub");
  });

  test("ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: все три значения — провайдер работает", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "42";
    process.env.LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID = "777";

    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: "co_1", attributes: { url: "https://pay.example/co_1" } } }),
    }));

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "pro" });

    expect(res.status).toBe(200);
    expect(res.body.provider, "проверка стала строже, чем нужно: касса не открылась").toBe("lemonsqueezy");
    expect(res.body.checkoutUrl).toBe("https://pay.example/co_1");
  });

  test("ссылка из письма: неполная настройка ведёт на страницу цен, а не на ошибку", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";

    const res = await request(app).get("/api/constitution/checkout/go/pro");

    expect(res.status).toBe(302);
    expect(String(res.headers.location)).not.toContain("error=checkout_failed");
  });
});

describe("Gumroad: решение о готовности и сама ссылка — из одного источника", () => {
  test("ссылка ведёт на НАСТРОЕННЫЙ товар, а не на выдуманный адрес", async () => {
    // pyiaz — настоящая ссылка товара, видна в таблице gumroadWebhook.ts
    process.env.GUMROAD_CONSTITUTION_PRO_PERMALINK = "pyiaz";

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "pro" });

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("gumroad");
    expect(
      String(res.body.checkoutUrl),
      "покупателя ведут на адрес, которого нет в Gumroad",
    ).toContain("pyiaz");
    expect(String(res.body.checkoutUrl)).not.toContain("constitution-pro");
  });

  test("имя, которое читает провайдер, тоже включает оплату", async () => {
    process.env.GUMROAD_PERMALINK_CONSTITUTION_PRO = "pyiaz";

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "pro" });

    expect(res.body.provider, "рабочая настройка объявлена отсутствующей").toBe("gumroad");
  });
});

describe("тариф Team не уводится на товар Pro", () => {
  test("настроен только Pro — покупателя Team НЕ ведут на чужой товар", async () => {
    process.env.GUMROAD_CONSTITUTION_PRO_PERMALINK = "pyiaz"; // товар Pro

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "team" });

    expect(res.status).toBe(200);
    expect(
      String(res.body.checkoutUrl ?? ""),
      "покупатель тарифа Team уходит на товар Pro — чужой продукт и чужая цена",
    ).not.toContain("pyiaz");
    expect(res.body.provider).toBe("stub");
  });

  test("свой товар у Team работает", async () => {
    process.env.GUMROAD_CONSTITUTION_TEAM_PERMALINK = "wjvquw"; // товар Team

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "team" });

    expect(res.body.provider).toBe("gumroad");
    expect(String(res.body.checkoutUrl)).toContain("wjvquw");
  });
});

describe("общая запасная ссылка не должна перебивать товар тарифа", () => {
  test("при заданной GUMROAD_DEFAULT_PERMALINK покупатель Team идёт на СВОЙ товар", async () => {
    // Найдено вычиткой дифа, а не тестом: reference уходит провайдеру, а тот
    // разрешает ссылку в порядке
    //   GUMROAD_PERMALINK_<REFERENCE> -> GUMROAD_DEFAULT_PERMALINK -> сам reference
    // То есть общая запасная ссылка имеет приоритет НАД именем товара, которое
    // мы передали. Если она задана, все тарифы уедут на один товар.
    process.env.GUMROAD_CONSTITUTION_TEAM_PERMALINK = "wjvquw"; // товар Team
    process.env.GUMROAD_DEFAULT_PERMALINK = "xpxzam";           // All-Access $59

    const res = await request(app)
      .post("/api/constitution/checkout/session")
      .send({ tier: "team" });

    expect(res.body.provider).toBe("gumroad");
    expect(
      String(res.body.checkoutUrl),
      "покупателя Team уводит на общий товар вместо его собственного",
    ).toContain("wjvquw");
  });
});
