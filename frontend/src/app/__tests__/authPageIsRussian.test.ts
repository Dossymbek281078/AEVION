import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";

/**
 * Страница входа — по-русски для русского посетителя.
 *
 * Замер 23.08.2026 на проде: /auth отдавала 1161 знак латиницы и 16 кириллицы.
 * Это первая страница, куда попадает человек по ссылке из русских соцсетей, и
 * она встречала его английским — вплоть до подсказок к полям («Your name»,
 * «Minimum 6 characters») и сообщений об ошибках. Там же был жаргон: шапка
 * обещала «get a JWT token» человеку, который пришёл играть в шахматы.
 *
 * 30.10.2026 — зеркальная дыра: при ?lang=en та же страница шла ПО-РУССКИ
 * (h1, подзаголовок, «Почта», блок «Что открывает аккаунт» — 14 узлов), потому
 * что русские формулировки были литералами в page.tsx, а доводчик переводит
 * только словарь. Теперь вся речь страницы — ключи auth.* в словаре, и этот
 * сторож проверяет РУССКУЮ ВЕТКУ словаря и провод ключей к экрану, а не
 * литералы в файле. Английскую сторону держит auth/__tests__/
 * angliyskiyEkranBezKirillitsy.test.tsx (рендер при lang=en).
 *
 * Проверяются ИМЕННО те строки, которые видит глаз: заголовок, переключатель
 * режима, кнопка отправки, названия полей, сообщения об исходе.
 */

const PAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "auth", "page.tsx");
const src = readFileSync(PAGE, "utf8");
const КИРИЛЛИЦА = /[А-Яа-яЁё]/;

/** Ключ → что должен увидеть русский посетитель → английская формулировка, которой в ru-ветке быть не должно. */
const VISIBLE: Array<[string, string, string]> = [
  ["auth.hero.title", "Вход в AEVION", "AEVION Identity"],
  ["auth.tab.register", "Регистрация", "Register"],
  ["auth.submit.register", "Создать аккаунт", "Create account"],
  ["auth.logout", "Выйти", "Sign out"],
  ["auth.name", "Имя", "Name"],
  ["auth.form.email", "Почта", "Email"],
  ["auth.password", "Пароль", "Password"],
  ["auth.form.namePh", "Как к вам обращаться", "Your name"],
  ["auth.form.passwordPh", "Не короче 6 знаков", "Minimum 6 characters"],
  ["auth.toast.registered", "Аккаунт создан", "Account created"],
  ["auth.err.loginFailed", "Не удалось войти", "Sign in error"],
  ["auth.err.emailPasswordRequired", "Введите адрес почты и пароль", "Email and password required"],
];

describe("страница входа говорит по-русски", () => {
  test("словарные подсказки ПРОВЕДЕНЫ до полей (placeholder из словаря)", () => {
    // Фраза в ru-ветке без провода — мёртвый словарь: закрепляем связку.
    expect(src).toContain('placeholder={t("auth.form.namePh")}');
    expect(src).toContain('placeholder={t("auth.form.passwordPh")}');
  });

  for (const [key, текст, english] of VISIBLE) {
    test(`«${текст}» в ru-ветке ${key}, «${english}» туда не вернулось, ключ проведён к экрану`, () => {
      expect(ru[key as keyof typeof ru], `пропала русская формулировка «${текст}» (${key})`).toContain(текст);
      expect(
        (ru[key as keyof typeof ru] ?? "").includes(english),
        `английская формулировка «${english}» в русской ветке — страницу видит человек, ` +
          `пришедший по ссылке из русской соцсети`,
      ).toBe(false);
      // Обратный откат: русский текст в английской ветке — его видел EN-канал 30.10.2026.
      expect(КИРИЛЛИЦА.test(en[key as keyof typeof en] ?? ""), `кириллица в en-ветке ${key}`).toBe(false);
      expect(src, `ключ ${key} не используется страницей — формулировка мёртвая`).toContain(`"${key}"`);
    });
  }

  test("русских литералов в разметке страницы не осталось — вся речь из словаря", () => {
    // Литерал по-русски в JSX виден на ЛЮБОМ языке (доводчик переводит только словарь).
    // Комментарии и кириллические имена переменных (визитёрLang, вернутьТуда) — не речь.
    const код = src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
      .join("\n");
    const литералы = [...код.matchAll(/(["'`>])([^"'`<>{}\n]*[А-Яа-яЁё][^"'`<>{}\n]*)(["'`<])/g)]
      .map((m) => m[2].trim())
      .filter((s) => s.length > 0);
    expect(литералы, "русские литералы в разметке /auth").toEqual([]);
  });

  test("жаргона в шапке нет", () => {
    // «get a JWT token» стояло в подзаголовке первой страницы платформы.
    // Токен — наша внутренняя механика, а не то, зачем человек пришёл.
    for (const jargon of ["JWT", "ecosystem modules", "модули экосистемы"]) {
      expect(ru["auth.hero.subtitle"].includes(jargon), `в русской шапке остался жаргон: ${jargon}`).toBe(false);
      expect(en["auth.hero.subtitle"].includes(jargon), `в английской шапке остался жаргон: ${jargon}`).toBe(false);
    }
  });
});

describe("экран входа объявляет свой язык", () => {
  test("lang на блоке следует за языком посетителя, первый кадр — по серверу, умолчание ru", () => {
    // Замер 28.08.2026: 547 русских букв при объявленном английском — язык
    // объявляем на самом блоке (ближайшая пометка выигрывает у корневой).
    // 07.09.2026: прибитый lang="ru" при живом доводчике давал обратный
    // дефект — переведённый EN-текст объявлялся русским, и читалка читала
    // его русским голосом. Теперь атрибут идёт за языком посетителя.
    // 30.10.2026: до готовности провайдера язык и строки — от сервера
    // (auth/layout.tsx: кука → Accept-Language → ru); умолчание — ru.
    expect(src, "lang на main отвязался от языка посетителя")
      .toContain("<main lang={визитёрLang}>");
    expect(src, "первый кадр перестал брать язык сервера с умолчанием ru")
      .toContain('(серверный?.lang ?? "ru")');
    expect(src, "страница не читает серверные строки первого кадра")
      .toContain("useAuthServerText()");
  });
});

describe("после входа человеку видно, куда идти дальше", () => {
  test("шахматы — первое действие, и оно ведёт в модуль запуска", () => {
    // Замер 28.08.2026 на живом сайте: после входа предлагались QRight,
    // Planet Lab и настройки. Шахмат не было вовсе — а 30 августа открываются
    // именно они, и почти весь трафик этих дней придёт за ними.
    expect(ru["auth.after.chess"]).toContain("Играть в шахматы");
    const at = src.indexOf('t("auth.after.chess")');
    expect(at, "ссылки на шахматы после входа нет").toBeGreaterThan(-1);
    expect(src.slice(at - 400, at)).toContain('href="/cyberchess"');
    // Именно ПЕРВОЕ: иначе человек, пришедший играть, снова его не найдёт.
    expect(at).toBeLessThan(src.indexOf('t("auth.after.qright")'));
  });
});
