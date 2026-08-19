import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Исчерпание суточной квоты писем перестаёт быть невидимым — 20.08.2026.
//
// У Brevo на текущем плане потолок 300 писем в сутки. Публичная подписка шлёт письмо
// на каждый запрос, и предела «10 в минуту на адрес» хватало, чтобы выбрать квоту с
// одного адреса за полчаса. После этого подтверждения не приходят НИКОМУ, а снаружи
// это выглядит как «письма задерживаются».
//
// Здесь СЧЁТЧИК И ТРЕВОГА, а не запрет: запрет никого не спасает — упёрлись мы сами
// или посторонний, подписчик всё равно без письма. Спасает то, что об исчерпании
// узнают до того, как воронка тихо умрёт.

beforeEach(() => {
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_DAILY_SOFT_CAP = "30"; // маленькая квота, чтобы порог достигался быстро
  process.env.PG_POOL_CONN_MS = "150";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ messageId: "<m>" }), text: async () => "" }) as unknown as Response),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("счётчик писем и тревога", () => {
  test("счётчик ПОДКЛЮЧЁН к настоящей отправке, а не просто написан", async () => {
    // Главная проверка файла. Написанный и никем не вызванный счётчик — это класс
    // «код обещает то, чего не делает», и он у нас уже случался.
    const { sendWaitlistConfirm, __emailCounter, __resetEmailCounter } = await import("../src/lib/constitutionBrevo");
    __resetEmailCounter();
    expect(__emailCounter().count).toBe(0);
    await sendWaitlistConfirm("kto@primer.test", "devhub");
    expect(__emailCounter().count, "отправка прошла, а счётчик не сдвинулся — он не подключён").toBe(1);
  });

  test("тревога поднимается на 2/3 квоты и ровно ОДИН раз", async () => {
    const { sendWaitlistConfirm, __resetEmailCounter } = await import("../src/lib/constitutionBrevo");
    __resetEmailCounter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 21; i++) await sendWaitlistConfirm(`k${i}@primer.test`, "devhub");
    const quota = warn.mock.calls.filter((c) => String(c[0]).includes("из 30"));
    expect(quota.length, "тревоги о квоте нет вовсе").toBeGreaterThanOrEqual(1);
    // 2/3 от 30 = 20; на 21 отправке порог 27 (9/10) ещё не достигнут.
    expect(quota.length, "тревога повторяется на каждой отправке — её перестанут читать").toBe(1);
    warn.mockRestore();
  });

  test("до порога тревоги нет — иначе канал зашумлён с первого дня", async () => {
    const { sendWaitlistConfirm, __resetEmailCounter } = await import("../src/lib/constitutionBrevo");
    __resetEmailCounter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) await sendWaitlistConfirm(`m${i}@primer.test`, "devhub");
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("из 30")).length).toBe(0);
    warn.mockRestore();
  });

  test("подписка через роут тоже двигает счётчик", async () => {
    // Сквозная проверка: путь, которым идёт человек, а не прямой вызов функции.
    const { constitutionWaitlistRouter } = await import("../src/routes/constitutionWaitlist");
    const { __emailCounter, __resetEmailCounter } = await import("../src/lib/constitutionBrevo");
    __resetEmailCounter();
    const app = express();
    app.use(express.json());
    app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
    await request(app)
      .post("/api/constitution/waitlist/subscribe")
      .send({ email: "skvoz@primer.test", source: "devhub" });
    const started = Date.now();
    while (__emailCounter().count === 0 && Date.now() - started < 3000) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(__emailCounter().count, "подписка прошла, письма не посчитано").toBe(1);
  });
});
