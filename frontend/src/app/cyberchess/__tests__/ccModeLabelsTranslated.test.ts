import { describe, test, expect } from "vitest";
import { tFor } from "../i18n";

/**
 * 08.09.2026. Подписи категорий контроля времени (первый экран выбора игры)
 * были ХАРДКОДОМ на русском в page.tsx («Пуля/Блиц/Рапид/Свой») — оставались
 * русскими даже при выбранном English (замер соседнего окна: остаток ~1% после
 * починки источника языка). Переведены через синхронный словарь (cc.t → tFor).
 *
 * Тест держит перевод: если en-ключ пропадёт, tFor откатится на ru-фолбэк, и
 * англоязычный игрок снова увидит «Пуля» на первом экране. Мутация (убрать
 * en-ключ) → красный.
 */
describe("подписи режимов контроля времени следуют языку", () => {
  test("EN — английские слова, а не русский фолбэк", () => {
    expect(tFor("en", "tc.bullet")).toBe("Bullet");
    expect(tFor("en", "tc.blitz")).toBe("Blitz");
    expect(tFor("en", "tc.rapid")).toBe("Rapid");
    expect(tFor("en", "tc.custom")).toBe("Custom");
  });

  test("RU — русские подписи на месте", () => {
    expect(tFor("ru", "tc.bullet")).toBe("Пуля");
    expect(tFor("ru", "tc.custom")).toBe("Свой");
  });

  test("EN-подписи не остались кириллицей (тот самый дефект)", () => {
    for (const key of ["tc.bullet", "tc.blitz", "tc.rapid", "tc.custom"]) {
      expect(/[а-яА-Я]/.test(tFor("en", key)), `${key} по-русски при en`).toBe(false);
    }
  });
});
