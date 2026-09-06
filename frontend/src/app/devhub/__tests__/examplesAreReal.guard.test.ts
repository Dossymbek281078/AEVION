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
