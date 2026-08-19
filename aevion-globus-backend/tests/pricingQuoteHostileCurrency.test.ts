import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { pricingRouter } from "../src/routes/pricing";

// Живой прод 28.07.2026 отдавал смету БЕЗ ЦИФР — HTTP 200, пустые total и
// subtotal — на пяти обычных строках: constructor, __proto__, toString, valueOf,
// hasOwnProperty. Причина в одном операторе: `body.currency in CURRENCY_RATES`
// идёт по цепочке прототипов, поэтому валютой становилось само слово
// `constructor`, а курсом — Object.prototype.constructor.
//
// Это денежный путь: пустая смета клиенту хуже отказа, потому что выглядит как
// ответ. Ни один тест этого не показывал — ловилось только запросом к живому
// сайту (еженедельный зонд aevion-ops-scripts/hostile-input-probe.js).

const app = express();
app.use(express.json());
app.use("/api/pricing", pricingRouter);

const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

describe("POST /api/pricing/quote — ключи прототипа не проходят за валюту", () => {
  it.each(PROTO_KEYS)("«%s» откатывается на USD и смета остаётся с цифрами", async (key) => {
    const r = await request(app).post("/api/pricing/quote").send({ tierId: "lite", currency: key });
    expect(r.status).toBe(200);
    expect(r.body.currency).toBe("USD");
    // Главное — не код ответа, а наличие чисел: дефект давал 200 с пустотой.
    expect(typeof r.body.total).toBe("number");
    expect(typeof r.body.subtotal).toBe("number");
    expect(r.body.total).toBeGreaterThan(0);
  });

  it("неизвестная валюта тоже откатывается на USD, а не роняет смету", async () => {
    const r = await request(app).post("/api/pricing/quote").send({ tierId: "lite", currency: "ZZZ" });
    expect(r.body.currency).toBe("USD");
    expect(r.body.total).toBeGreaterThan(0);
  });

  it("настоящая валюта по-прежнему принимается — иначе починка выродилась бы в «всегда USD»", async () => {
    // Без этой проверки тест был бы зелёным и на заглушке, отвергающей всё:
    // проверялось бы отсутствие дефекта, а не сохранность возможности.
    const r = await request(app).post("/api/pricing/quote").send({ tierId: "lite", currency: "EUR" });
    expect(r.body.currency).toBe("EUR");
    expect(r.body.total).toBeGreaterThan(0);
  });
});

// Защита в маршруте стоит ДАЛЕКО от расчёта, а buildQuote экспортирован: курс
// берётся внутри него, значит и не доверять валюте он должен сам. Иначе
// следующий вызывающий получит NaN молча — ровно тот дефект, только в обход
// починенной ручки.
import { buildQuote } from "../src/data/pricing";

describe("buildQuote — курс не уводится в NaN мимо маршрута", () => {
  it.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "валюта «%s» даёт смету с числами, а не NaN",
    (cur) => {
      const q = buildQuote({ tierId: "lite", modules: [], seats: 1, period: "monthly", currency: cur as never });
      expect(Number.isFinite(q.total)).toBe(true);
      expect(Number.isFinite(q.subtotal)).toBe(true);
      expect(q.total).toBeGreaterThan(0);
    },
  );

  it("настоящая валюта считается по своему курсу — иначе защита выродилась бы в «всегда USD»", () => {
    const usd = buildQuote({ tierId: "lite", modules: [], seats: 1, period: "monthly", currency: "USD" });
    const eur = buildQuote({ tierId: "lite", modules: [], seats: 1, period: "monthly", currency: "EUR" });
    expect(Number.isFinite(eur.total)).toBe(true);
    expect(eur.total).not.toBe(usd.total);
  });
});
