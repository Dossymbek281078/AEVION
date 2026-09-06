import { describe, test, expect } from "vitest";
import { DEVHUB_EXAMPLES } from "../examples";

// Галерея — единственное место витрины, где показывается «доказательство
// продукта». Сторож закрепляет форму честности: только https, только наши
// выкаточные домены, непустые фраза и имя. Живость адресов проверяет
// ежедневный смоук страниц — юнит-тесту сеть не положена.
describe("примеры галереи — настоящие по форме", () => {
  test("каждый пример: https, наш домен, непустые поля", () => {
    for (const ex of DEVHUB_EXAMPLES) {
      expect(ex.title.trim().length, `пустое имя у ${ex.url}`).toBeGreaterThan(2);
      expect(ex.prompt.trim().length, `пустая фраза у ${ex.url}`).toBeGreaterThan(10);
      // Переводы обязательны: посетитель Show HN первым делом жмёт пример,
      // и русская фраза на EN-странице читается как «не для меня».
      for (const l of ["en", "kk"] as const) {
        expect(ex[l].title.trim().length, `пустое имя (${l}) у ${ex.url}`).toBeGreaterThan(2);
        expect(ex[l].prompt.trim().length, `пустая фраза (${l}) у ${ex.url}`).toBeGreaterThan(10);
      }
      // EN-перевод обязан быть переводом, а не копией кириллицы.
      expect(/[а-яё]/i.test(ex.en.title + ex.en.prompt), `кириллица в en-переводе у ${ex.url}`).toBe(false);
      expect(ex.url.startsWith("https://"), `не-https адрес: ${ex.url}`).toBe(true);
      const host = new URL(ex.url).hostname;
      expect(
        host.endsWith(".pages.dev") || host.endsWith(".aevion.build") || host.endsWith(".aevion.app"),
        `чужой домен в галерее: ${host} — сюда попадает только собранное в DevHub`,
      ).toBe(true);
    }
  });

  test("адреса не повторяются", () => {
    const urls = DEVHUB_EXAMPLES.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
