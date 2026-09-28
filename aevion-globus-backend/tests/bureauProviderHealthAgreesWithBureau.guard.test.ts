// Два ответа прода про приём денег бюро обязаны совпадать.
//
// ЗАМЕР 23.09.2026, боевой прод: общий health отвечал
// bureauProviders.payment = {id: "paddle", configured: true}, а ручка бюро на
// те же данные — payment: "misconfigured". Права была ручка бюро: Paddle выведен
// из эксплуатации 22.07.2026, его маршруты удалены, вебхук отдаёт 410.
//
// Причина расхождения — «настроено» считалось как «переменная непустая».
// Признак этого класса уже стоил нам сегодня часа (см. founderNotify).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { paymentProviderMode } from "../src/routes/bureau";
import { bureauProvidersHealth } from "../src/lib/providerGuard";

const ПЕРЕМЕННЫЕ = ["BUREAU_PAYMENT_PROVIDER", "BUREAU_KYC_PROVIDER"] as const;
const сохранено: Record<string, string | undefined> = {};
beforeEach(() => ПЕРЕМЕННЫЕ.forEach((v) => { сохранено[v] = process.env[v]; delete process.env[v]; }));
afterEach(() => ПЕРЕМЕННЫЕ.forEach((v) => {
  if (сохранено[v] === undefined) delete process.env[v];
  else process.env[v] = сохранено[v];
}));

// Зовём ТУ ЖЕ функцию, что зовёт health: сторож, проверяющий свою копию
// логики, зелен при сломанной ручке — этот класс у нас уже был.

describe("поле health про провайдеров бюро", () => {
  it("прибор видит предмет: живой провайдер даёт live", () => {
    process.env.BUREAU_PAYMENT_PROVIDER = "lemonsqueezy";
    expect(paymentProviderMode()).toBe("live");
    expect(bureauProvidersHealth().payment.configured).toBe(true);
  });

  it("выведенный из эксплуатации paddle — НЕ «настроено»", () => {
    process.env.BUREAU_PAYMENT_PROVIDER = "paddle";
    const поле = bureauProvidersHealth().payment;
    expect(paymentProviderMode()).toBe("misconfigured");
    expect(поле.configured, "health обещал работающий приём денег").toBe(false);
    expect(поле.mode).toBe("misconfigured");
    expect(поле.id).toBe("paddle");
  });

  it("заглушка называет себя заглушкой, а не настройкой", () => {
    process.env.BUREAU_KYC_PROVIDER = "stub";
    const поле = bureauProvidersHealth().kyc;
    expect(поле.isStub).toBe(true);
    expect(поле.configured).toBe(false);
    expect(поле.mode).toBe("stub");
  });

  it("переменной нет вовсе — это заглушка, а не «настроено»", () => {
    const поле = bureauProvidersHealth().payment;
    expect(поле.configured).toBe(false);
    expect(поле.mode).toBe("stub");
  });
});
