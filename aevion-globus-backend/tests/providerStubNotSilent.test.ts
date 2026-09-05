import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { warnIfStubInProduction, providerStatus } from "../src/lib/providerGuard";

/**
 * Заглушка на денежном пути не должна молчать.
 *
 * Замер 29.08.2026: `BUREAU_KYC_PROVIDER` в проде не задана, и `|| "stub"`
 * молча включал заглушку — при том что тариф «Verified · $19» обещает проверку
 * личности по паспорту. Проверено пробой: `/api/bureau/kyc-stub/…` отвечал 200
 * на боевом сервере. У платежей то же значение по умолчанию, и их заглушка сама
 * помечает платёж «оплачен» при первом чтении.
 *
 * Сторож проверяет НЕ отказ (ронять бюро нельзя — там 113 верификаций в
 * pending), а видимость: в production обязан остаться след.
 */

const ENV = "BUREAU_TEST_PROVIDER";

describe("заглушка провайдера в production не молчит", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  const savedNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    delete process.env[ENV];
  });

  it("в production предупреждает и называет ПЕРЕМЕННУЮ", () => {
    process.env.NODE_ENV = "production";
    warnIfStubInProduction(ENV + "_A", "stub");
    expect(spy).toHaveBeenCalledTimes(1);
    // Имя переменной обязательно: без него сообщение бесполезно — читающий
    // не знает, ЧТО задать. След без «что» и «кому» не работает.
    const text = String(spy.mock.calls[0]?.[0] ?? "");
    expect(text).toContain(ENV + "_A");
  });

  it("вне production молчит — иначе разработка утонет в шуме", () => {
    process.env.NODE_ENV = "test";
    warnIfStubInProduction(ENV + "_B", "stub");
    expect(spy).not.toHaveBeenCalled();
  });

  it("при настоящем провайдере молчит", () => {
    process.env.NODE_ENV = "production";
    warnIfStubInProduction(ENV + "_C", "sumsub");
    expect(spy).not.toHaveBeenCalled();
  });

  it("предупреждает ОДИН раз на процесс, а не на каждый вызов", () => {
    process.env.NODE_ENV = "production";
    warnIfStubInProduction(ENV + "_D", "stub");
    warnIfStubInProduction(ENV + "_D", "stub");
    warnIfStubInProduction(ENV + "_D", "stub");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("providerStatus отличает заданное от подставленного", () => {
    delete process.env[ENV];
    expect(providerStatus(ENV)).toEqual({ id: "stub", isStub: true, configured: false });
    process.env[ENV] = "sumsub";
    expect(providerStatus(ENV)).toEqual({ id: "sumsub", isStub: false, configured: true });
  });
});
