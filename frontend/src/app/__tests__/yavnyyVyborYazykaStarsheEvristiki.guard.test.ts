// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Инлайн-скрипт корневого layout (html lang по доле кириллицы) уступает ЯВНОМУ
 * выбору языка: адресу /en/ и /kk/, куке aevion_lang_v1 и решению провайдера
 * (data-lang-src="provider"). Без явного выбора — прежнее поведение.
 *
 * Повод 13.10.2026 (user-99, перехват сеттера lang со стеком): на /cyberchess
 * у гостя en-US провайдер ставил en на 1,4 с, скрипт на 1,8 с переписывал в ru
 * (сотни русских литералов), и живой слой перевода для гостя из Shorts молчал.
 */
const LAYOUT = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
const m = LAYOUT.match(/__html: "(\(function\(\)\{try\{var d=document\.documentElement;function seen[\s\S]*?\}\)\(\))" \}\}/);
if (!m) throw new Error("инлайн-скрипт языка не найден в layout.tsx");
const СКРИПТ = m[1];

const РУССКИЙ_ТЕКСТ = "Шахматная доска. Ваш ход, чёрные. Задача дня, подсказка, тренер, рейтинг, партия, анализ, коуч, профиль, настройки, магазин, лидеры, серия, звук.".repeat(3);

function запустить(opts: { lang: string; mark?: string; cookie?: string; path?: string; text?: string }) {
  document.documentElement.removeAttribute("data-lang-src");
  document.documentElement.lang = opts.lang;
  document.body.innerHTML = `<main><p>${opts.text ?? РУССКИЙ_ТЕКСТ}</p></main>`;
  document.cookie = "aevion_lang_v1=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  if (opts.cookie) document.cookie = `aevion_lang_v1=${opts.cookie}; path=/`;
  if (opts.mark) document.documentElement.setAttribute("data-lang-src", opts.mark);
  window.history.pushState({}, "", opts.path ?? "/cyberchess");
  new Function(СКРИПТ)();
  return { lang: document.documentElement.lang, src: document.documentElement.getAttribute("data-lang-src") };
}

describe("явный выбор языка старше эвристики по кириллице", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("🔴 провайдер решил en (data-lang-src=provider) — русский текст страницы lang не переписывает", () => {
    const р = запустить({ lang: "en", mark: "provider" });
    expect(р.lang).toBe("en");
    expect(р.src).toBe("provider");
  });

  it("КОНТРОЛЬ: без явного выбора прежнее поведение — кириллица переводит lang в ru", () => {
    const р = запустить({ lang: "en" });
    expect(р.lang).toBe("ru");
    expect(р.src).toBe("content");
  });

  it("адрес /kk/… — явный выбор, как и /en/…", () => {
    expect(запустить({ lang: "kk", path: "/kk/devhub" })).toEqual({ lang: "kk", src: "path" });
    expect(запустить({ lang: "en", path: "/en/cyberchess" })).toEqual({ lang: "en", src: "path" });
  });

  it("кука — явный выбор: её источник помечает первый скрипт (data-lang-src=cookie), второй уступает", () => {
    const р = запустить({ lang: "en", mark: "cookie" });
    expect(р.lang).toBe("en");
    expect(р.src).toBe("cookie");
  });

  it("КОНТРОЛЬ прибора: латинская страница без явного выбора lang не трогает", () => {
    const р = запустить({ lang: "en", text: "Describe it. Get a deployed project. ".repeat(10) });
    expect(р.lang).toBe("en");
    expect(р.src).toBeNull();
  });
});
