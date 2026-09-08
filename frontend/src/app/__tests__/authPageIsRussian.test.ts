import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Страница входа — по-русски.
 *
 * Замер 23.08.2026 на проде: /auth отдавала 1161 знак латиницы и 16 кириллицы.
 * Это первая страница, куда попадает человек по ссылке из русских соцсетей, и
 * она встречала его английским — вплоть до подсказок к полям («Your name»,
 * «Minimum 6 characters») и сообщений об ошибках. Там же был жаргон: шапка
 * обещала «get a JWT token» человеку, который пришёл играть в шахматы.
 *
 * Проверяются ИМЕННО те строки, которые видит глаз: заголовок, переключатель
 * режима, кнопка отправки, названия полей, сообщения об исходе. Проверка «нет
 * латиницы в файле» была бы бессмысленна — в нём css, имена свойств и код.
 */

const PAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "auth", "page.tsx");

/** Пары «что человек должен увидеть» → «чего он видеть не должен». */
const VISIBLE: Array<[string, string]> = [
  ["Вход в AEVION", "AEVION Identity"],
  ["Регистрация", "Register"],
  ["Создать аккаунт", "Create account"],
  ["Выйти", "Sign out"],
  [">Имя</div>", ">Name</div>"],
  [">Почта</div>", ">Email</div>"],
  [">Пароль</div>", ">Password</div>"],
  // 06-07.09.2026: плейсхолдеры ушли в словарь AUTH_A11Y (страница стала
  // языко-зависимой). Русская фраза живёт в ru-ветке словаря; запрещены ОБА
  // отката (сведение двух окон): возврат зашитого английского placeholder
  // (правая часть первой пары) и английский текст В ru-ветке словаря
  // (правая часть второй). Косвенность показа через AA.* закреплена ниже.
  ['namePh: "Как к вам обращаться"', 'placeholder="Your name"'],
  ['passwordPh: "Не короче 6 знаков"', 'placeholder="Minimum 6 characters"'],
  ['namePh: "Как к вам обращаться"', 'namePh: "Your name'],
  ['passwordPh: "Не короче 6 знаков"', 'passwordPh: "Minimum 6'],
  ["Аккаунт создан", "Account created"],
  ["Не удалось войти", "Sign in error"],
  ["Введите адрес почты и пароль", "Email and password required"],
];

describe("страница входа говорит по-русски", () => {
  const src = readFileSync(PAGE, "utf8");

  test("словарные подсказки ПРОВЕДЕНЫ до полей (AA.namePh/AA.passwordPh)", () => {
    // Фраза в ru-ветке без провода — мёртвый словарь: закрепляем связку.
    expect(src).toContain("placeholder={AA.namePh}");
    expect(src).toContain("placeholder={AA.passwordPh}");
  });

  for (const [ru, en] of VISIBLE) {
    test(`«${ru}» на месте, «${en}» не вернулось`, () => {
      expect(src, `пропала русская формулировка «${ru}»`).toContain(ru);
      expect(
        src.includes(en),
        `вернулась английская формулировка «${en}» — страницу видит человек, ` +
          `пришедший по ссылке из русской соцсети`,
      ).toBe(false);
    });
  }

  test("жаргона в шапке нет", () => {
    // «get a JWT token» стояло в подзаголовке первой страницы платформы.
    // Токен — наша внутренняя механика, а не то, зачем человек пришёл.
    const head = src.slice(0, src.indexOf("What your") > -1 ? src.indexOf("What your") : src.length);
    for (const jargon of ["JWT token.", "ecosystem modules"]) {
      expect(head.includes(jargon), `в шапке остался жаргон: ${jargon}`).toBe(false);
    }
  });
});

describe("экран входа объявляет свой язык", () => {
  test("lang на блоке следует за языком посетителя, по умолчанию ru", () => {
    // Замер 28.08.2026: 547 русских букв при объявленном английском — язык
    // объявляем на самом блоке (ближайшая пометка выигрывает у корневой).
    // 07.09.2026: прибитый lang="ru" при живом доводчике давал обратный
    // дефект — переведённый EN-текст объявлялся русским, и читалка читала
    // его русским голосом. Теперь атрибут идёт за языком посетителя, а до
    // гидрации честен русский (SSR-текст страницы русский).
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "auth", "page.tsx"), "utf8");
    expect(src, "lang на main отвязался от языка посетителя")
      .toContain("<main lang={визитёрLang}>");
    expect(src, "умолчание языка перестало быть русским")
      .toContain('useI18nOptional()?.lang ?? "ru"');
  });
});

describe("после входа человеку видно, куда идти дальше", () => {
  test("шахматы — первое действие, и оно ведёт в модуль запуска", () => {
    // Замер 28.08.2026 на живом сайте: после входа предлагались QRight,
    // Planet Lab и настройки. Шахмат не было вовсе — а 30 августа открываются
    // именно они, и почти весь трафик этих дней придёт за ними.
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "auth", "page.tsx"), "utf8");
    const at = src.indexOf('Играть в шахматы');
    expect(at, "ссылки на шахматы после входа нет").toBeGreaterThan(-1);
    expect(src.slice(at - 400, at)).toContain('href="/cyberchess"');
    // Именно ПЕРВОЕ: иначе человек, пришедший играть, снова его не найдёт.
    expect(at).toBeLessThan(src.indexOf("Зарегистрировать работу в QRight"));
  });
});
