import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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

  it("форма биомаркеров QLife: подписи связаны с полями", () => {
    // Замер прода 29.08.2026: шесть полей держались на подсказках. Подписи
    // на экране БЫЛИ (`<label style={styles.label}>Value (unit)</label>`),
    // но без пары id/htmlFor — глазами видно, читалке нет.
    const s = readFileSync(join(SRC, "app", "qlife", "components", "BiomarkerForm.tsx"), "utf8");
    const pairs = (s.match(/htmlFor="qlife-bio-/g) ?? []).length;
    expect(pairs, `связанных подписей ${pairs}, было 3 — связь разорвана`)
      .toBeGreaterThanOrEqual(3);
    for (let i = 1; i <= pairs; i++) {
      expect(s, `у поля qlife-bio-${i} пропал id`).toContain(`id="qlife-bio-${i}"`);
    }
  });

  it("QVenture: поля с подсказкой-ПРИМЕРОМ названы отдельно", () => {
    // Подсказки там — примеры значений: «3», «15», «Y0: 2,000,000». Взять их
    // как имя нельзя: читалка объявила бы поле «три». Имена выведены из
    // подписей, а одна подпись стояла сразу над ТРЕМЯ полями (прогноз выручки
    // на три года) — каждому дано своё.
    const s = readFileSync(join(SRC, "app", "qventure", "page.tsx"), "utf8");
    for (const n of ["Projected revenue this year", "Projected revenue +1yr",
                     "Projected revenue +2yr", "Churn (%)", "Growth (%)",
                     "What does it do?", "Traction / metrics"]) {
      expect(s, `поле «${n}» снова без имени`).toContain(`aria-label="${n}"`);
    }
  });

  it("у поля вопроса к ИИ подпись связана с его заголовком", () => {
    const s = readFileSync(join(SRC, "components", "AskAi.tsx"), "utf8");
    expect(s, "AskAi снова опирается только на placeholder").toContain("aria-labelledby={titleId}");
    expect(s, "заголовок AskAi потерял id — связывать не с чем").toContain("id={titleId}");
  });
});

/* ------------------------------------------------------------------
   29.08.2026. Широкий обход прода по НАСТОЯЩЕМУ списку адресов нашёл
   два общих источника безымянных полей вместо россыпи одиночных.
   Проверки ниже сторожат именно их.

   У обхода каталога есть свой знаменатель: если образец перестанет
   находиться вовсе, проверка обязана покраснеть, а не тихо опустеть.
   Пустая проверка выглядит как пройденная — это ровно тот случай,
   ради которого знаменатель и нужен.
------------------------------------------------------------------ */
describe("поля, найденные широким обходом 29.08.2026", () => {
  const практика = join(process.cwd(), "src/app/smeta-trainer/drawings-practice");
  const страницы = new Map<string, string>();

  beforeAll(() => {
    // Обход каталога — ОДИН раз: 308 страниц внутри it() дают таймаут
    // под нагрузкой, а зелёный в одиночном прогоне ничего не значит.
    for (const d of readdirSync(практика, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const f = join(практика, d.name, "page.tsx");
      if (existsSync(f)) страницы.set(d.name, readFileSync(f, "utf8"));
    }
  }, 120_000);

  it.each([
    ['placeholder="Итого, тенге"', 'aria-label="Итого, тенге"'],
    ['placeholder="тг"', 'aria-label="Сумма, тенге"'],
    ['placeholder="Ваш ответ..."', 'aria-label="Ваш ответ"'],
    ['placeholder="Введите число..."', 'aria-label="Введите число"'],
    ['placeholder="Число', 'aria-label="Число"'],
  ])("поле-подсказка %s не осталось единственным именем", (образец, имя) => {
    const сОбразцом = [...страницы].filter(([, s]) => s.includes(образец));
    // Знаменатель: без него проверка молча пустеет при переименовании.
    expect(сОбразцом.length,
      `образец ${образец} не найден ни на одной странице — проверка стала пустой`)
      .toBeGreaterThan(0);
    const безымянные = сОбразцом.filter(([, s]) => !s.includes(имя)).map(([n]) => n);
    expect(безымянные,
      `страниц с полем ${образец} без имени для читалки: ${безымянные.length}`)
      .toEqual([]);
  });

  it("подписи-соседи в labor-norms остались связанными с полями", () => {
    const s = страницы.get("labor-norms");
    expect(s, "страница labor-norms исчезла — проверка стала пустой").toBeTruthy();
    for (const имя of ["Объём работ", "Норма времени"])
      expect(s, `поле «${имя}» снова без имени: подпись рядом, но не связана`)
        .toContain(`aria-label="${имя}"`);
  });

  it("вход в /build называет почту и пароль", () => {
    const s = readFileSync(
      join(process.cwd(), "src/components/build/BuildShell.tsx"), "utf8");
    // Placeholder исчезает при вводе — форма становится безымянной ровно
    // тогда, когда в ней работают.
    for (const имя of ["Email", "Password"])
      expect(s, `поле «${имя}» формы входа снова опирается только на placeholder`)
        .toContain(`aria-label="${имя}"`);
  });
});

/* ------------------------------------------------------------------
   Форма входа и восстановление пароля — 29.08.2026.

   Нашлось прогоном зонда по СВОЕЙ сборке: на проде эти поля тонули
   среди находок, уже закрытых в ветке. Подписи над полями есть, но
   лежат в <div> и с полями не связаны — глаз видит, читалка нет.
   Подсказка внутри поля исчезает при вводе, то есть форма становится
   безымянной ровно тогда, когда в ней работают.

   Это вход на платформу: если он безымянен, читалка не проведёт
   человека дальше первого экрана.
------------------------------------------------------------------ */
describe("вход на платформу называет свои поля", () => {
  it("три поля формы регистрации связаны с подписями", () => {
    const s = readFileSync(join(process.cwd(), "src/app/auth/page.tsx"), "utf8");
    for (const имя of ["Имя", "Почта", "Пароль"])
      expect(s, `поле «${имя}» формы входа снова опирается только на placeholder`)
        .toContain(`aria-label="${имя}"`);
  });

  it("восстановление пароля берёт имя из СЛОВАРЯ, а не строкой", () => {
    const s = readFileSync(
      join(process.cwd(), "src/app/build/reset-password/page.tsx"), "utf8");
    // Страница переводимая: русская строка в атрибуте осталась бы русской
    // на любом языке. Это поймал чужой сторож attrI18n, и правило здесь —
    // чтобы починку не откатили обратно в строку.
    expect(s, "имя поля почты снова вписано строкой мимо словаря")
      .toContain('aria-label={t("build.resetPassword.emailPlaceholder")}');
  });
});
