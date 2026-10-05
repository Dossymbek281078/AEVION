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

  test("случай 14.09 исключён: чужой товар не подставляется", () => {
    // 🔴 14.09.2026 включение lemonsqueezy для бюро отзывали: несопоставленная ссылка
    // брала товар «по умолчанию», и покупка отметки списала бы $149 за DevHub.
    // Здесь проверяется, что этого больше не может быть ДВУМЯ независимыми фактами:
    // у отметки своя переменная, и при её отсутствии резолвер отдаёт null (касса
    // откажет), даже когда переменная «по умолчанию» и чужие товары заданы.
    process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID = "149149";
    process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_LITE = "777777";
    try {
      expect(
        resolveLemonSqueezyVariant(BUREAU_VERIFIED_REFERENCE),
        "отметка взяла чужой товар — это и есть случай 14.09",
      ).toBeNull();
      // И наоборот: со своей переменной берётся именно она, а не «по умолчанию».
      process.env[BUREAU_VERIFIED_VARIANT_ENV] = "292929";
      expect(resolveLemonSqueezyVariant(BUREAU_VERIFIED_REFERENCE)).toBe("292929");
    } finally {
      delete process.env.LEMON_SQUEEZY_DEFAULT_VARIANT_ID;
      delete process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_LITE;
    }
  });

  test("описания не обещают подстановку товара по умолчанию", () => {
    // Текстовая проверка, и она здесь по делу: именно УСТАРЕВШЕЕ ОПИСАНИЕ («провайдер
    // подставит DEFAULT_VARIANT_ID») и есть то, что вернёт дефект руками следующего
    // читателя. Код уже отказывает, а комментарий обещал обратное.
    const данные = readFileSync(join(__dirname, "..", "src", "data", "lemonSqueezyVariants.ts"), "utf8");
    const провайдер = readFileSync(
      join(__dirname, "..", "src", "lib", "payment", "lemonSqueezyProvider.ts"),
      "utf8",
    );
    expect(данные, "описание снова обещает подстановку по умолчанию").not.toMatch(
      /provider then falls back to LEMON_SQUEEZY_DEFAULT_VARIANT_ID/,
    );
    expect(провайдер, "шапка снова обещает подстановку по умолчанию").not.toMatch(
      /Default variant id used by createIntent/,
    );
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
