import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Экран выкатки — то, что платящий смотрит в самый напряжённый момент: он
 * только что нажал «опубликовать» и ждёт.
 *
 * Замер 08.09.2026: три текста уходили человеку зашитыми по-английски, и
 * главный из них не запасной, а ОБЫЧНЫЙ — тост «Deployment started» видит
 * каждый платящий при каждой публикации. Словаря на экране не было вовсе.
 *
 * Почему не поймал прежний сторож этого экрана: он проверяет ОТРИСОВКУ
 * начального состояния и сам об этом честно предупреждает. Тост живёт секунды
 * и появляется после действия — слепая зона и для него, и для машинного
 * доводчика.
 */
const PAGE = fs.readFileSync(
  path.resolve(__dirname, "..", "[id]", "deploy", "page.tsx"),
  "utf8",
);

describe("экран выкатки говорит на языке читателя", () => {
  test("прибор исправен: файл прочитан", () => {
    expect(PAGE.length).toBeGreaterThan(5000);
  });

  test("тексты идут через словарь, а не зашиты строкой", () => {
    for (const зашито of ['showToast("Deployment started"', '|| "Deploy failed"', '|| "Failed to load"']) {
      expect(PAGE.includes(зашито), `текст снова зашит: ${зашито}`).toBe(false);
    }
    expect(PAGE).toContain("DL.started");
    expect(PAGE).toContain("DL.failed");
    expect(PAGE).toContain("DL.loadFailed");
  });

  test("во всех трёх языках заведены все три текста", () => {
    // Незаведённая подпись не падает и не краснеет — она печатает жаргон или
    // молчит. Поэтому проверяем перечислением, а не наличием словаря.
    for (const язык of ["ru", "en", "kk"]) {
      const блок = PAGE.slice(PAGE.indexOf(`  ${язык}: {`), PAGE.indexOf("},", PAGE.indexOf(`  ${язык}: {`)));
      for (const ключ of ["started", "failed", "loadFailed"]) {
        expect(блок.includes(`${ключ}:`), `в языке ${язык} нет ключа ${ключ}`).toBe(true);
      }
    }
  });

  test("русская ветка действительно русская, английская — английская", () => {
    const ru = PAGE.slice(PAGE.indexOf("  ru: {"), PAGE.indexOf("},", PAGE.indexOf("  ru: {")));
    const en = PAGE.slice(PAGE.indexOf("  en: {"), PAGE.indexOf("},", PAGE.indexOf("  en: {")));
    expect(/[а-яё]/i.test(ru), "русская ветка без кириллицы").toBe(true);
    expect(/[а-яё]/i.test(en), "в английской ветке кириллица").toBe(false);
  });
});
