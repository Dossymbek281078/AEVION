import { describe, expect, it } from "vitest";
import { SUBSCRIPTIONS, GUIDES, MODULES } from "@/lib/products";
import { EN_TEXTS } from "../page";

/**
 * У каждого товара витрины есть английский текст.
 *
 * ЗАЧЕМ. /en/shop берёт цены и ссылки из каталога, а тексты — из карты
 * EN_TEXTS по id. Товар, добавленный в каталог БЕЗ английского текста,
 * показал бы en-покупателю русское описание молча — ровно тот класс
 * «отсутствие во втором источнике проходит тихо», из-за которого /shop
 * и была худшей денежной страницей (73 % RU под en, замер 06.09).
 *
 * Сторож ФУНКЦИОНАЛЬНЫЙ: исполняет настоящие объекты каталога, а не грепает
 * исходник — переименование поля или товара он видит, комментарии его не
 * обманывают.
 */
describe("английская витрина покрывает каталог", () => {
  const все = [...SUBSCRIPTIONS, ...GUIDES, ...MODULES];

  it("в каталоге есть товары — иначе проверка ниже пуста", () => {
    // Порог по факту 07.09: 16 позиций. Упадёт ниже 10 — это не «сторож
    // строгий», это каталог потерял товары, и об этом надо узнать.
    expect(все.length).toBeGreaterThanOrEqual(10);
  });

  it("каждый id каталога имеет запись в EN_TEXTS с непустым desc", () => {
    for (const p of все) {
      const en = EN_TEXTS[p.id];
      expect(en, `товар "${p.id}" (${p.title}) не имеет английского текста — добавьте в EN_TEXTS на /en/shop`).toBeTruthy();
      expect(en.desc.length, `desc товара "${p.id}" пуст`).toBeGreaterThan(20);
      expect(en.format.length, `format товара "${p.id}" пуст`).toBeGreaterThan(3);
    }
  });

  it("английские тексты действительно английские", () => {
    // Русская строка, положенная в EN_TEXTS по ошибке, прошла бы первый тест.
    for (const [id, en] of Object.entries(EN_TEXTS)) {
      const кир = (en.desc + en.format + (en.notice ?? "") + (en.includes ?? []).join(""))
        .match(/[А-Яа-яЁё]/g);
      expect(кир, `в EN-тексте товара "${id}" есть кириллица: ${кир?.slice(0, 5).join("")}`).toBeNull();
    }
  });

  it("цены в EN-тексты не просочились", () => {
    // Цена живёт в каталоге и только там: вторая копия разошлась бы молча
    // (правило платформы про копии чисел).
    for (const [id, en] of Object.entries(EN_TEXTS)) {
      expect(
        en.format + en.desc,
        `в тексте товара "${id}" есть знак доллара — цены берутся из каталога`,
      ).not.toMatch(/\$\s?\d/);
    }
  });

  it("бейджи каталога переведены — русский бейдж на EN-витрине ловится", () => {
    // Находка user-98 07.09: «ВСЁ СРАЗУ»/«ФЛАГМАН»/«БЕТА · ДЕМО» уезжали на
    // английскую страницу как есть. Мой храповик стерёг КАРТУ текстов, а не
    // ЭКРАН — бейдж жил в каталоге и в карту не входил (класс «покрытие
    // карты не равно покрытию страницы»). Теперь: у товара с бейджем обязан
    // быть en-бейдж, и он латиницей.
    for (const p of все) {
      if (!p.badge) continue;
      const en = EN_TEXTS[p.id];
      expect(en?.badge, `у товара "${p.id}" бейдж "${p.badge}" без английской замены`).toBeTruthy();
      expect(en!.badge, `en-бейдж товара "${p.id}" содержит кириллицу`).not.toMatch(/[А-Яа-яЁё]/);
    }
    // отрицательный контроль осмысленности: бейджи в каталоге вообще есть
    expect(все.some((p) => p.badge), "в каталоге не осталось бейджей — проверка пуста, пересмотреть").toBe(true);
  });

  it("плашка оплаты на EN-витрине говорит по-английски", () => {
    // Тот же класс: компонент с дефолтом lang="ru" на английской странице.
    // Проверяем исходник страницы: PaymentReachNotice обязан получать lang="en".
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join, dirname } = require("node:path") as typeof import("node:path");
    const { fileURLToPath } = require("node:url") as typeof import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "..", "page.tsx"), "utf8");
    expect(src).toMatch(/PaymentReachNotice[^/]*lang="en"/);
  });
});

