import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Объявленный язык должен совпадать с содержимым — ДО отрисовки.
//
// В корневом макете стоит lang="en", и для холодной отрисовки это верно:
// сервер отдаёт английский текст. Но страницы через getServerT отдают русский.
// Замер 21.08.2026 при Accept-Language ru: на /awards 1284 знака кириллицы
// под lang="en".
//
// Последствие проверено на себе: Chrome счёл страницу английской и показал
// машинный перевод НАШЕГО интерфейса — «Наборы средств разработки
// программного обеспечения» там, где в исходнике «SDK». Провайдер языка тоже
// ставит lang, но ПОСЛЕ гидрации, когда браузер уже решил переводить.
//
// Проверяется ПОВЕДЕНИЕ скрипта, а не наличие строки: «строка на месте» —
// это утверждение о тексте, а нужно утверждение о результате.

const LAYOUT = readFileSync(path.join(__dirname, "..", "layout.tsx"), "utf8");

function extractScript(): string {
  const m = LAYOUT.match(/__html: "(.*?)" \}\} \/>/);
  if (!m) throw new Error("встроенный скрипт языка не найден в layout.tsx");
  return m[1].replace(/\\"/g, '"');
}

function runWithCookie(cookie: string): string {
  const doc = { cookie, documentElement: { lang: "en" } };
  // eslint-disable-next-line no-new-func
  new Function("document", extractScript())(doc);
  return doc.documentElement.lang;
}

describe("язык объявляется до отрисовки", () => {
  test("скрипт есть и он короткий (иначе это уже не «до отрисовки»)", () => {
    const js = extractScript();
    expect(js.length).toBeGreaterThan(50);
    expect(js.length).toBeLessThan(600);
  });

  for (const [cookie, want] of [
    ["aevion_lang_v1=ru", "ru"],
    ["aevion_lang_v1=kk", "kk"],
    ["aevion_lang_v1=en", "en"],
    ["theme=dark; aevion_lang_v1=ru; other=1", "ru"],
    ["aevion_lang_v1=%72%75", "ru"],
  ] as const) {
    test(`кука «${cookie}» -> lang=${want}`, () => {
      expect(runWithCookie(cookie)).toBe(want);
    });
  }

  test("чужая кука не меняет язык", () => {
    expect(runWithCookie("theme=dark")).toBe("en");
  });

  test("незнакомое значение не подставляется (иначе lang=<мусор>)", () => {
    // Без проверки списка сюда попало бы что угодно из куки — а это атрибут,
    // который читают браузер и экранные читалки.
    expect(runWithCookie("aevion_lang_v1=zzz")).toBe("en");
    expect(runWithCookie("aevion_lang_v1=<script>")).toBe("en");
  });

  test("битая кука не роняет страницу", () => {
    expect(runWithCookie("aevion_lang_v1=%E0%A4%A")).toBe("en");
  });
});
