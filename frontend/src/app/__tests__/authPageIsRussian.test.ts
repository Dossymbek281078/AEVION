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
  // 06.09.2026: плейсхолдеры ушли в словарь AUTH_A11Y (страница стала
  // языко-зависимой). Русская формулировка теперь живёт в ru-ветке словаря,
  // а возврат зашитого английского placeholder ловится прежней правой частью.
  ['namePh: "Как к вам обращаться"', 'placeholder="Your name"'],
  ['passwordPh: "Не короче 6 знаков"', 'placeholder="Minimum 6 characters"'],
  ["Аккаунт создан", "Account created"],
  ["Не удалось войти", "Sign in error"],
  ["Введите адрес почты и пароль", "Email and password required"],
];

describe("страница входа говорит по-русски", () => {
  const src = readFileSync(PAGE, "utf8");

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
  test("на блоке содержимого стоит lang=ru", () => {
    // Замер 28.08.2026 по отдаваемому HTML: 547 русских букв, а страница
    // объявлена английской — корневой <html lang> у сайта "en", и менять его
    // нельзя (большинство страниц английские). По стандарту ближайшая пометка
    // выигрывает у корневой, поэтому объявляем язык на самом блоке.
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "auth", "page.tsx"), "utf8");
    expect(src).toContain('<main lang="ru">');
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
