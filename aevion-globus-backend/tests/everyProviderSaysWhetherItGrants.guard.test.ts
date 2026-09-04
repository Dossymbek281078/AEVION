import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { checkoutRouter } from "../src/routes/checkout";

/**
 * Про КАЖДУЮ кассу снаружи видно не только «настроена», но и «выдаст ли».
 *
 * ЗАЧЕМ. `configured` отвечает «есть ли ключи, чтобы принять деньги».
 * Выдача купленного висит на ДРУГОМ секрете — секрете вебхука: без него
 * оплата проходит, а права не начисляются, и это самый тихий провал на
 * денежном пути. Человек заплатил, ответ 200, доступа нет.
 *
 * ЗАМЕР 03.09.2026, из-за которого сторож и написан: у LemonSqueezy и
 * Gumroad поле `webhookConfigured` было, у PayBox и PayPal — нет. То есть
 * про две кассы спросить «выдаст ли» было НЕЧЕМ, и снаружи «настроено» и
 * «выдаст» выглядели одинаково.
 *
 * PayBox при этом — касса казахстанского трафика, то есть ровно та, где
 * такая тишина дороже всего.
 *
 * ГРАНИЦА. Поле отвечает «секрет задан», а не «подпись верная». Это честная
 * граница: проверить верность секрета можно только настоящей доставкой от
 * провайдера, а ручка состояния, зависящая от чужой сети, начинает краснеть
 * от чужих сбоев и её перестают читать.
 */

function app() {
  const a = express();
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

describe("каждая касса говорит, выдаст ли купленное", () => {
  it("контроль: ручка отвечает и знает провайдеров", async () => {
    const r = await request(app()).get("/api/pricing/checkout/healthz");
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.providers ?? {}).length, "провайдеров не найдено").toBeGreaterThanOrEqual(4);
  });

  it("у каждой кассы есть признак выдачи, а не только настройки", async () => {
    const r = await request(app()).get("/api/pricing/checkout/healthz");
    const провайдеры = r.body.providers as Record<string, Record<string, unknown>>;
    const без = Object.entries(провайдеры)
      .filter(([, v]) => !("webhookConfigured" in v))
      .map(([k]) => k);
    expect(
      без,
      "про эти кассы снаружи нельзя спросить, выдадут ли купленное: оплата " +
        "пройдёт, права не начислятся, и ответ при этом будет 200",
    ).toEqual([]);
  });

  it("тестовый режим кассы ВИДЕН снаружи", async () => {
    // 🔴 Ловушка запуска. Тестовый режим у PayBox стоит ПО УМОЛЧАНИЮ: пока не
    // задано `PAYBOX_TESTING=0`, провайдер шлёт `pg_testing_mode: "1"`.
    // Умолчание правильное — случайно взять настоящие деньги хуже, чем
    // случайно не взять.
    //
    // Но при включении кассы это ловушка: задать два секрета выглядит
    // достаточным, `configured` станет true, покупки пойдут — и ни одна не
    // будет настоящей. Снаружи «касса работает» и «касса в песочнице»
    // выглядели одинаково.
    //
    // Замер 04.09.2026: PAYBOX_TESTING на проде не задана.
    const было = process.env.PAYBOX_TESTING;
    try {
      delete process.env.PAYBOX_TESTING;
      const поумолчанию = await request(app()).get("/api/pricing/checkout/healthz");
      expect(
        поумолчанию.body.providers.paybox.testMode,
        "песочница подана как рабочая касса",
      ).toBe(true);

      process.env.PAYBOX_TESTING = "0";
      const боевой = await request(app()).get("/api/pricing/checkout/healthz");
      expect(
        боевой.body.providers.paybox.testMode,
        "боевой режим показан как тестовый — тревога на исправном месте",
      ).toBe(false);
    } finally {
      if (было === undefined) delete process.env.PAYBOX_TESTING;
      else process.env.PAYBOX_TESTING = было;
    }
  });

  it("контроль: признак различает заданный секрет и пустой", async () => {
    // Иначе «поле есть» могло бы значить «поле всегда true».
    const было = process.env.PAYBOX_SECRET;
    try {
      delete process.env.PAYBOX_SECRET;
      const пусто = await request(app()).get("/api/pricing/checkout/healthz");
      expect(пусто.body.providers.paybox.webhookConfigured).toBe(false);

      process.env.PAYBOX_SECRET = "секрет";
      const есть = await request(app()).get("/api/pricing/checkout/healthz");
      expect(есть.body.providers.paybox.webhookConfigured).toBe(true);
    } finally {
      if (было === undefined) delete process.env.PAYBOX_SECRET;
      else process.env.PAYBOX_SECRET = было;
    }
  });
});
