// Состояние барьеров бюро (`/api/bureau/health`) обязано описывать ТОТ САМЫЙ
// код, который работает, — фабрики `getKycProvider()` и `getPaymentProvider()`.
//
// Почему отдельным файлом и почему через настоящие фабрики: прежняя проверка
// сверяла health с СОБСТВЕННОЙ копией правила («v && v !== "stub"») и потому
// была зелёной при живом расхождении. Она даже закрепляла дефект — ждала
// "live" для имени "veriff", на котором фабрика БРОСАЕТ исключение.
//
// Здесь эталон вычисляется вызовом фабрики: разойдётся код — покраснеет тест.
import { describe, it, expect, afterEach } from "vitest";
import { kycProviderMode, paymentProviderMode } from "../src/routes/bureau";
import { getKycProvider, stubKycProvider } from "../src/lib/kyc";
import { getPaymentProvider, stubPaymentProvider } from "../src/lib/payment";

const KYC_KEY = "BUREAU_KYC_PROVIDER";
const PAY_KEY = "BUREAU_PAYMENT_PROVIDER";

function withEnv<T>(key: string, value: string | undefined, fn: () => T): T {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return fn();
  } finally {
    if (had) process.env[key] = prev;
    else delete process.env[key];
  }
}

/** Что на самом деле произойдёт: падение, заглушка или настоящий поставщик. */
function actualMode(
  factory: () => unknown,
  stub: unknown,
): "live" | "stub" | "misconfigured" {
  try {
    return factory() === stub ? "stub" : "live";
  } catch {
    return "misconfigured";
  }
}

// Значения подобраны так, чтобы каждое отвечало на свой вопрос. Пробел и
// регистр здесь не придирка: переменные окружения задают в веб-панели, и
// лишний пробел в конце — самый обычный способ получить неработающий барьер.
const CASES = [
  undefined,
  "",
  "stub",
  "STUB",
  " stub",
  "sumsub",
  "SUMSUB",
  " sumsub",
  "sumsub ",
  "stripe",
  "gumroad",
  "lemonsqueezy",
  "lemon-squeezy",
  "veriff",
  "paybox",
  "paddle",
];

describe("состояние барьера личности совпадает с фабрикой", () => {
  afterEach(() => {
    delete process.env[KYC_KEY];
  });

  it.each(CASES.map((v) => [JSON.stringify(v), v] as const))(
    "%s",
    (_label, v) => {
      const [mine, real] = withEnv(KYC_KEY, v, () => [
        kycProviderMode(),
        actualMode(getKycProvider, stubKycProvider),
      ]);
      expect(mine, `health и фабрика разошлись на ${JSON.stringify(v)}`).toBe(
        real,
      );
    },
  );
});

describe("состояние приёма денег совпадает с фабрикой", () => {
  afterEach(() => {
    delete process.env[PAY_KEY];
  });

  it.each(CASES.map((v) => [JSON.stringify(v), v] as const))(
    "%s",
    (_label, v) => {
      const [mine, real] = withEnv(PAY_KEY, v, () => [
        paymentProviderMode(),
        actualMode(getPaymentProvider, stubPaymentProvider),
      ]);
      expect(mine, `health и фабрика разошлись на ${JSON.stringify(v)}`).toBe(
        real,
      );
    },
  );
});

describe("именно те случаи, ради которых правка делалась", () => {
  it('" sumsub" — фабрика падает, значит это НЕ "live"', () => {
    withEnv(KYC_KEY, " sumsub", () => {
      expect(kycProviderMode()).toBe("misconfigured");
      expect(() => getKycProvider()).toThrow();
    });
  });

  it('"STUB" — работает демо-заглушка, значит это НЕ "live"', () => {
    withEnv(KYC_KEY, "STUB", () => {
      expect(kycProviderMode()).toBe("stub");
      expect(getKycProvider()).toBe(stubKycProvider);
    });
  });

  it('"paybox" на деньгах — фабрика падает, обещать приём денег нельзя', () => {
    withEnv(PAY_KEY, "paybox", () => {
      expect(paymentProviderMode()).toBe("misconfigured");
      expect(() => getPaymentProvider()).toThrow();
    });
  });
});
