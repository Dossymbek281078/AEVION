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

  test("ЗАМЕР, если он есть, полон и правдоподобен — иначе число выдумано", () => {
    /*
     * Поле measured необязательное: у примеров от 06.09 время никто не мерил, и
     * отсутствие числа честнее правдоподобного. Но ЕСЛИ число названо, оно
     * обязано нести дату и быть похожим на правду — иначе витрина получает
     * «числа не из прогона», а это ровно тот класс, на котором мы уже горели
     * (посты с 84 % из анонса, отзывы-демо на /pricing).
     */
    let хотяБыОдин = 0;
    for (const ex of DEVHUB_EXAMPLES) {
      if (!ex.measured) continue;
      хотяБыОдин++;
      expect(Number.isInteger(ex.measured.seconds), `секунды не целые у ${ex.url}`).toBe(true);
      expect(ex.measured.seconds, `секунд меньше единицы у ${ex.url}`).toBeGreaterThan(0);
      // Верхняя граница — не придирка: «за 3 секунды» читается как ложь, а
      // «за полчаса» перестаёт быть обещанием. Замер 06.10 дал 34 с.
      expect(ex.measured.seconds, `подозрительно долго у ${ex.url}`).toBeLessThan(600);
      expect(ex.measured.on, `дата замера не в виде ГГГГ-ММ-ДД у ${ex.url}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(Date.parse(ex.measured.on)), `дата замера не разбирается у ${ex.url}`).toBe(true);
    }
    // Контроль в обратную сторону: проверка не должна быть зелёной при нуле
    // охвата. Если замеров не осталось ни одного — она молчала бы ни о чём.
    expect(хотяБыОдин, "ни у одного примера нет замера — проверке нечего охранять").toBeGreaterThan(0);
  });

  test("адреса не повторяются", () => {
    const urls = DEVHUB_EXAMPLES.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
