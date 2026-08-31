// Платный тариф «Verified» выдавался бесплатно и без проверки документа.
//
// Обе демонстрационные заглушки самозавершаются — это их назначение:
//
//   lib/kyc/stubProvider      getSession() ВСЕГДА -> "approved" с заявленным именем
//   lib/payment/stubProvider  getIntent()  сам помечает счёт оплаченным при
//                             первом чтении ("Auto-complete on first poll")
//
// А включаются они ОТСУТСТВИЕМ настройки: пустая переменная -> заглушка.
// Отсутствие настройки — обычное состояние прода (замер 29.08: ни
// BUREAU_KYC_PROVIDER, ни BUREAU_PAYMENT_PROVIDER не заданы). Значит проверки
// «kyc approved» и «payment paid» в ручке повышения проходили сами собой.
//
// Сторож опирается на ФАКТ «поставщик — заглушка», а не на NODE_ENV: у нас
// index.ts берёт `NODE_ENV || "development"`, а выкатка эту переменную не
// задаёт — сторож по среде молча не сработал бы на проде.
import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { stubBarriersBlockingUpgrade, bureauRouter } from "../src/routes/bureau";

// «Настоящие поставщики» — это имя ПЛЮС ключи. Без ключей stripe падает при
// первом обращении, и сторож обязан это блокировать (см. случаи ниже).
const LIVE = {
  BUREAU_KYC_PROVIDER: "sumsub",
  BUREAU_PAYMENT_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
} as NodeJS.ProcessEnv;

describe("платный тариф не выдаётся, пока барьеры демонстрационные", () => {
  it("ничего не настроено (состояние прода) — оба барьера блокируют", () => {
    expect(stubBarriersBlockingUpgrade({} as NodeJS.ProcessEnv)).toEqual([
      "identity",
      "payment",
    ]);
  });

  it("настоящие поставщики — не блокирует ничего", () => {
    expect(stubBarriersBlockingUpgrade(LIVE)).toEqual([]);
  });

  it.each([
    ["личность заглушка, деньги настоящие", { ...LIVE, BUREAU_KYC_PROVIDER: "stub" }, ["identity"]],
    ["деньги заглушка, личность настоящая", { ...LIVE, BUREAU_PAYMENT_PROVIDER: "stub" }, ["payment"]],
  ] as Array<[string, NodeJS.ProcessEnv, string[]]>)(
    "%s — блокирует именно свой барьер",
    (_n, env, expected) => {
      expect(stubBarriersBlockingUpgrade(env)).toEqual(expected);
    },
  );

  it("неверно настроенный поставщик — тоже не «настоящий»", () => {
    // Имя, которого фабрика не знает, роняет её вызовом. Считать такое
    // состояние живым — та же ошибка, только на шаг раньше.
    expect(
      stubBarriersBlockingUpgrade({
        BUREAU_KYC_PROVIDER: "sumsub",
        BUREAU_PAYMENT_PROVIDER: "paybox",
      } as NodeJS.ProcessEnv),
    ).toEqual(["payment"]);
  });

  // Частично настроенный поставщик ХУЖЕ ненастроенного: имя включает ветку,
  // ветка заслоняет рабочий путь и падает на первом обращении. Соседняя
  // вкладка измерила это 29.08 на кассе «Конституции» — там завели один ключ
  // из трёх. У бюро та же щель была в этом же стороже: он смотрел на ИМЯ.
  it.each([
    ["нет обоих ключей", {}],
    ["нет секрета вебхука", { STRIPE_SECRET_KEY: "sk_test_x" }],
    ["нет ключа API", { STRIPE_WEBHOOK_SECRET: "whsec_x" }],
    ["ключ из пробелов — это не ключ", { STRIPE_SECRET_KEY: "   ", STRIPE_WEBHOOK_SECRET: "whsec_x" }],
  ] as Array<[string, Record<string, string>]>)(
    "stripe без ключей (%s) — блокирует",
    (_n, extra) => {
      expect(
        stubBarriersBlockingUpgrade({
          BUREAU_KYC_PROVIDER: "sumsub",
          BUREAU_PAYMENT_PROVIDER: "stripe",
          ...extra,
        } as NodeJS.ProcessEnv),
      ).toEqual(["payment"]);
    },
  );

  it("stripe со ВСЕМИ ключами — не блокирует", () => {
    expect(
      stubBarriersBlockingUpgrade({
        BUREAU_KYC_PROVIDER: "sumsub",
        BUREAU_PAYMENT_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: "sk_test_x",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
      } as NodeJS.ProcessEnv),
    ).toEqual([]);
  });

  it("разработка включает поток ЯВНО, и это единственный способ", () => {
    expect(
      stubBarriersBlockingUpgrade({
        BUREAU_ALLOW_STUB_COMMERCE: "1",
      } as NodeJS.ProcessEnv),
    ).toEqual([]);
  });

  it.each([["пусто", ""], ['"0"', "0"], ['"true"', "true"], ['"yes"', "yes"]])(
    "разрешение %s не считается разрешением",
    (_n, v) => {
      // Умолчание обязано быть безопасным: любое значение, кроме точного "1",
      // оставляет барьеры закрытыми. Иначе случайная переменная откроет продажу.
      expect(
        stubBarriersBlockingUpgrade({
          BUREAU_ALLOW_STUB_COMMERCE: v,
        } as NodeJS.ProcessEnv).length,
      ).toBeGreaterThan(0);
    },
  );
});

// Отдельно — что сторож ПОДКЛЮЧЁН. Безупречная функция, которую никто не
// зовёт, охраняет ровно ничего; проверять надо следствие, а не форму.
describe("ручка повышения тарифа действительно спрашивает сторожа", () => {
  const app = () => {
    const a = express();
    a.use(express.json());
    a.use("/api/bureau", bureauRouter);
    return a;
  };

  afterEach(() => {
    delete process.env.BUREAU_ALLOW_STUB_COMMERCE;
    delete process.env.BUREAU_KYC_PROVIDER;
    delete process.env.BUREAU_PAYMENT_PROVIDER;
  });

  it("состояние прода — отказ 503, и он называет причину", async () => {
    const r = await request(app())
      .post("/api/bureau/upgrade/cert-whatever")
      .send({ verificationId: "v-1" });
    expect(r.status).toBe(503);
    expect(r.body.stubBarriers).toEqual(["identity", "payment"]);
  });

  it("отказ наступает ДО обращения к базе — иначе он зависел бы от неё", async () => {
    // Идентификаторы заведомо несуществующие: дойди запрос до выборки, ответ
    // был бы 404, а не 503. Это и отличает «закрыто» от «не нашлось».
    const r = await request(app())
      .post("/api/bureau/upgrade/нет-такого-сертификата")
      .send({ verificationId: "нет-такой-проверки" });
    expect(r.status).toBe(503);
  });
});
