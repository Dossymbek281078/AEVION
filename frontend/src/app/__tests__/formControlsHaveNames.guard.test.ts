import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Органы управления обязаны иметь имя для читалки.
 *
 * Замер ЖИВОГО прода 28.08.2026 зондом aevion-a11y-names: 603 элемента на
 * восьми страницах, из них 11 без имени. Читалка объявляет такой элемент
 * только ролью — «поле ввода», «регулятор», — и человек не знает, что это.
 *
 * Placeholder именем НЕ считается: он исчезает при вводе, то есть поле
 * становится безымянным ровно тогда, когда в нём работают.
 *
 * Сторож проверяет исходник, а не рендер, поэтому он слабее зонда — зато
 * дёшев и краснеет до выкатки. Полную картину даёт зонд:
 *   node C:/Users/user/aevion-a11y-names.mjs
 */

const SRC = join(__dirname, "..", "..");

describe("подписи у полей ввода", () => {
  it("на странице цен подписи связаны с полями, а не просто лежат рядом", () => {
    const s = readFileSync(join(SRC, "app", "pricing", "page.tsx"), "utf8");
    // Видимая подпись БЫЛА и до починки — не хватало именно связи.
    for (const id of ["calc-seats", "calc-promo"]) {
      expect(s, `подпись для ${id} отвязалась от поля`).toContain(`htmlFor="${id}"`);
      expect(s, `у поля ${id} пропал id — связь снова разорвана`).toContain(`id="${id}"`);
    }
  });

  it("поле почты в подписке названо не одним placeholder", () => {
    const s = readFileSync(join(SRC, "app", "pricing", "page.tsx"), "utf8");
    expect(s, "у поля почты снова только placeholder — при вводе оно станет безымянным")
      .toContain('aria-label={tp("newsletter.emailLabel")}');
  });

  it("ключ подписи есть в обоих языках", () => {
    const s = readFileSync(join(SRC, "lib", "pricingI18n.ts"), "utf8");
    const n = s.split("newsletter.emailLabel").length - 1;
    expect(n, `ключ найден ${n} раз(а), а языков два — кто-то останется без подписи`).toBe(2);
  });

  it("форма автора в QRight названа, а не только подсказана", () => {
    // Замер прода 28.08.2026: пять полей формы (имя, почта, страна, город)
    // держались на подсказках. Подписи на экране БЫЛИ — обычными div-ами,
    // не связанными с полями. Форма лидовая: люди вводят туда своё имя.
    const s = readFileSync(join(SRC, "app", "qright", "page.tsx"), "utf8");
    for (const n of ["Name", "Email", "Country", "City"]) {
      expect(s, `поле «${n}» снова без имени для читалки`)
        .toContain(`aria-label="${n}"`);
    }
  });

  it("у поля вопроса к ИИ подпись связана с его заголовком", () => {
    const s = readFileSync(join(SRC, "components", "AskAi.tsx"), "utf8");
    expect(s, "AskAi снова опирается только на placeholder").toContain("aria-labelledby={titleId}");
    expect(s, "заголовок AskAi потерял id — связывать не с чем").toContain("id={titleId}");
  });
});
