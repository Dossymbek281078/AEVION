import { describe, test, expect } from "vitest";
import { translations } from "@/lib/i18n-data";

/**
 * Экран после оплаты не должен называть платёжный сервис, которым человек не
 * платил. Замер 12.08.2026: страница писала «квитанция от Gumroad» и
 * «управление подпиской — в вашем аккаунте Gumroad» ВСЕМ, включая тех, кто
 * заплатил через Lemon Squeezy (основной провайдер подписок) и PayPal.
 * Название было зашито словами в переводах, а параметр provider страница
 * читала только для аналитики.
 *
 * Сторож держит два условия: имена сервисов не зашиты в переводах, и для
 * каждого языка есть вариант строки БЕЗ имени — на случай, когда провайдера
 * определить нельзя. Выдуманное имя хуже отсутствующего.
 */

const PROCESSOR_NAMES = ["Gumroad", "Lemon Squeezy", "LemonSqueezy", "PayPal", "PayBox", "Stripe"];

/** Ключи экрана успеха, которые видит покупатель. */
const SCREEN_PREFIX = "pricing.checkoutSuccess.";

type Table = Record<string, Record<string, string>>;
const tables = translations as unknown as Table;

describe("страница успеха не называет чужой платёжный сервис", () => {
  test("ни в одном языке имя сервиса не зашито в перевод", () => {
    const offenders: string[] = [];

    for (const [lang, entries] of Object.entries(tables)) {
      for (const [key, value] of Object.entries(entries)) {
        if (!key.startsWith(SCREEN_PREFIX)) continue;
        for (const name of PROCESSOR_NAMES) {
          if (value.includes(name)) offenders.push(`${lang} · ${key}: «${value}»`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test("строки с именем сервиса берут его подстановкой", () => {
    for (const lang of Object.keys(tables)) {
      for (const key of ["providerBadge", "nextEmail", "nextManage"]) {
        const value = tables[lang]?.[SCREEN_PREFIX + key];
        if (!value) continue; // язык может быть переведён не полностью
        expect(value, `${lang} · ${key}`).toContain("{processor}");
      }
    }
  });

  test("для неизвестного провайдера есть вариант без имени", () => {
    for (const lang of Object.keys(tables)) {
      // Проверяем только языки, где сам экран переведён.
      if (!tables[lang]?.[SCREEN_PREFIX + "providerBadge"]) continue;
      for (const key of ["providerBadgeNoName", "nextEmailNoName"]) {
        const value = tables[lang]?.[SCREEN_PREFIX + key];
        expect(value, `${lang} · ${key} отсутствует`).toBeTruthy();
        expect(value, `${lang} · ${key} не должен содержать подстановку`).not.toContain("{processor}");
      }
    }
  });

  test("контроль: сторож действительно ловит зашитое имя", () => {
    // Иначе первый тест прошёл бы на пустом наборе и ничего не доказывал.
    const fake = "Проверьте email — квитанция от Gumroad уже отправлена";
    expect(PROCESSOR_NAMES.some((n) => fake.includes(n))).toBe(true);
    const checkedKeys = Object.keys(tables["ru"] ?? {}).filter((k) => k.startsWith(SCREEN_PREFIX));
    expect(checkedKeys.length).toBeGreaterThan(5);
  });
});
