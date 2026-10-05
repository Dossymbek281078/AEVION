import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveLemonSqueezyVariant,
  BUREAU_VERIFIED_REFERENCE,
  BUREAU_VERIFIED_VARIANT_ENV,
} from "../src/data/lemonSqueezyVariants";

/**
 * Сторож: отметка Verified продаётся СВОИМ товаром, а ссылка на него постоянная.
 *
 * 🔴 Находка окна кассы, проверенная мной по коду 05.10.2026. Бюро звало кассу со
 * ссылкой = verificationId — РАЗНОЙ на каждую покупку. Вариант товара так не находится
 * никогда, поэтому апгрейд за $29 не начинался: на проде BUREAU_PAYMENT_PROVIDER не
 * задан, работает заглушка, и /api/bureau/health честно отвечает payment:misconfigured.
 *
 * Провайдер при этом ведёт себя ПРАВИЛЬНО: на несопоставленной ссылке он отказывает, а
 * не подставляет товар по умолчанию — иначе человек заплатил бы чужую сумму за чужой
 * товар. Это и охраняем: отсутствие переменной обязано давать null (касса откажет), а
 * не «что-нибудь похожее».
 */

const БЫЛО = process.env[BUREAU_VERIFIED_VARIANT_ENV];

beforeEach(() => {
  delete process.env[BUREAU_VERIFIED_VARIANT_ENV];
});
afterEach(() => {
  if (БЫЛО === undefined) delete process.env[BUREAU_VERIFIED_VARIANT_ENV];
  else process.env[BUREAU_VERIFIED_VARIANT_ENV] = БЫЛО;
});

describe("товар отметки Verified", () => {
  test("переменная не задана — null, то есть касса ОТКАЖЕТ", () => {
    expect(
      resolveLemonSqueezyVariant(BUREAU_VERIFIED_REFERENCE),
      "без своего товара вернулось что-то — значит спишут чужую сумму",
    ).toBeNull();
  });

  test("переменная задана — вернулся именно он", () => {
    process.env[BUREAU_VERIFIED_VARIANT_ENV] = "987654";
    expect(resolveLemonSqueezyVariant(BUREAU_VERIFIED_REFERENCE)).toBe("987654");
  });

  test("КОНТРОЛЬ: чужие ссылки от этой правки не изменились", () => {
    // Иначе правка «добавил свою ссылку» могла бы молча поломать продажу тарифов.
    process.env[BUREAU_VERIFIED_VARIANT_ENV] = "987654";
    expect(resolveLemonSqueezyVariant("выдуманная_ссылка")).toBeNull();
    expect(resolveLemonSqueezyVariant(BUREAU_VERIFIED_REFERENCE)).toBe("987654");
  });

  test("бюро зовёт кассу ПОСТОЯННОЙ ссылкой, а не номером проверки", () => {
    // ⚠️ Это проверка ТЕКСТА, и она слабее остальных: поднять маршрут бюро в тесте
    // значит поднять KYC, базу и кассу. Она ловит самый дорогой случай — возврат
    // динамической ссылки, из-за которой продажа не начиналась вовсе. Правду даёт
    // прод: /api/bureau/health перестанет отвечать payment:misconfigured, когда
    // основатель заведёт товар и переменные.
    const src = readFileSync(join(__dirname, "..", "src", "routes", "bureau.ts"), "utf8");
    expect(src, "бюро снова зовёт кассу с verificationId").not.toMatch(
      /reference:\s*verificationId/,
    );
    expect(src, "постоянная ссылка не используется").toContain("reference: BUREAU_VERIFIED_REFERENCE");
  });
});
