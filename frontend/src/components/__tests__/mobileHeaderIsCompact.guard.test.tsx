import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/lib/i18n";

/**
 * ШАПКА НА ТЕЛЕФОНЕ — ОДНА КНОПКА, А НЕ ЧЕТЫРЕ РЯДА.
 *
 * Замер 29.09.2026 (390 px, окно QSpace): шапка занимала 154 px — 18 % первого
 * экрана, — и в ней помещались 14 ссылок и два счётчика («AI saved $0.23» и
 * «$1M: 0.00%»). На страницах модулей, куда приходят по роликам, пятая часть
 * первого экрана уходила на навигацию и на два числа, которых гость не
 * понимает, а одно из них прямо говорит «у нас ничего не куплено».
 *
 * Что здесь держится:
 *  1) на телефоне есть кнопка меню, и разделы доступны через неё;
 *  2) списки НЕ раздвоились: каждый раздел и каждая главная кнопка, видимые на
 *     широком экране, есть и в меню (два списка об одном разошлись бы молча);
 *  3) счётчики платформы на телефоне спрятаны классом, а не удалены с сайта;
 *  4) переключатель языка на телефоне ОСТАЁТСЯ виден — трафик смешанный.
 *
 * Чего проверка НЕ делает: не меряет пиксели. Стенд не раскладывает страницу,
 * координаты в нём выдуманные; высоту меряют браузером на проде.
 */

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

// В jsdom нет ResizeObserver, а шапка им публикует свою высоту (чтобы
// прилипающие полосы разделов вставали ПОД ней). Подставляем пустышку: предмет
// проверки — раскладка, а не публикация высоты.
class ПустойНаблюдатель {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ПустойНаблюдатель);

afterEach(() => cleanup());

function отрисовать() {
  const { container } = render(
    <I18nProvider>
      <SiteHeader />
    </I18nProvider>,
  );
  return container;
}

describe("шапка на телефоне", () => {
  it("есть кнопка меню и панель разделов", () => {
    const c = отрисовать();
    const меню = c.querySelector("details.aev-hdr-menu");
    expect(меню, "кнопки меню нет — на телефоне останется четыре ряда ссылок").not.toBeNull();
    expect(меню!.querySelector("summary"), "у меню нет кнопки открытия").not.toBeNull();
    expect(меню!.querySelector("nav.aev-hdr-menu-panel"), "в меню нет панели разделов").not.toBeNull();
  });

  it("списки не раздвоились: что видно на широком экране, есть и в меню", () => {
    const c = отрисовать();
    const полная = c.querySelector(".aev-hdr-full")!;
    const меню = c.querySelector(".aev-hdr-menu-panel")!;
    // Ссылки с атрибутом hidden НЕ считаем: они есть в разметке и невидимы
    // человеку. Первая версия собирала их наравне с остальными — и мутация
    // «показать в меню только три раздела через hidden» прошла мимо сторожа.
    // Полную видимость (display/visibility) стенд не считает: это ограничение
    // jsdom, и меряется оно браузером на проде.
    const адреса = (узел: Element) =>
      new Set(
        [...узел.querySelectorAll("a[href]")]
          .filter((a) => !a.hasAttribute("hidden"))
          .map((a) => (a.getAttribute("href") || "").split("?")[0]),
      );

    const вСтроке = адреса(полная);
    const вМеню = адреса(меню);
    // Контроль осмысленности: если бы любая из сторон оказалась пустой,
    // проверка ниже прошла бы, не проверив ничего.
    expect(вСтроке.size, "в полной строке нет ссылок — проверка пуста").toBeGreaterThan(5);
    expect(вМеню.size, "в меню нет ссылок — проверка пуста").toBeGreaterThan(5);

    const потеряно = [...вСтроке].filter((href) => !вМеню.has(href));
    expect(
      потеряно,
      "на телефоне пропали разделы, которые есть на широком экране",
    ).toEqual([]);
  });

  it("счётчики платформы спрятаны на телефоне классом, а не удалены", () => {
    const c = отрисовать();
    const обёртка = c.querySelector(".aev-hdr-counters");
    expect(обёртка, "счётчики не в своей обёртке — их нечем спрятать на телефоне").not.toBeNull();
  });

  it("переключатель языка остаётся ВНЕ скрываемой части", () => {
    const c = отрисовать();
    const полная = c.querySelector(".aev-hdr-full")!;
    // Переключатель — это кнопка, а не <select>: первая версия проверки искала
    // select и не находила НИЧЕГО, то есть краснела на исправной раскладке.
    // Ищем кнопки вне скрываемой части и вне кнопки меню.
    const меню = c.querySelector("details.aev-hdr-menu")!;
    const кнопкиСнаружи = [...c.querySelectorAll("button")].filter(
      (b) => !полная.contains(b) && !меню.contains(b),
    );
    expect(
      кнопкиСнаружи.length,
      "вне скрываемой части нет ни одной кнопки — переключатель языка спрятался вместе с меню",
    ).toBeGreaterThan(0);
  });

  it("панель меню скрыта, пока details закрыт, и раскрывается при [open]", () => {
    /*
     * Добавлено 07.10.2026. Панель задана position: absolute с left/right,
     * и её display обязан стоять под [open], иначе правило живёт всегда.
     *
     * 🔴 Чего эта проверка НЕ доказывает — и это стоило дня двум окнам.
     * Видимого дефекта тут НЕ было: на проде (Chrome 154, окно 390x844)
     * человек панель закрытого меню не видит. Прямоугольник у неё при этом
     * ненулевой (y 52, h 421, w 20), и два окна доложили по нему
     * несуществующую утечку. Прямоугольник — НЕ проверка видимости;
     * видимость это elementFromPoint или кадр, и меряется она браузером,
     * как и сказано в шапке этого файла про пиксели.
     * Кадр: Desktop/АЕВИОН/15-Аудиты-и-сводки/2026-10-07-навигация-телефон/
     */
    const c = отрисовать();
    const details = c.querySelector("details.aev-hdr-menu") as HTMLDetailsElement | null;
    const панель = c.querySelector(".aev-hdr-menu-panel") as HTMLElement | null;
    expect(details, "details.aev-hdr-menu не найден — сторож ослеп").not.toBeNull();
    expect(панель, "панель не найдена — сторож ослеп").not.toBeNull();

    // КОНТРОЛЬ ПРИБОРА: если jsdom не применил <style>, красное ниже означало бы
    // «панель течёт», хотя означает «стили не доехали». Базовое правило
    // .aev-hdr-menu { display: none } стоит в файле безусловно.
    const базовое = getComputedStyle(details!).display;
    expect(
      базовое,
      `jsdom не применил стили компонента (.aev-hdr-menu display=${базовое}, ждали none) — ` +
        "это отказ ПРИБОРА, судить по нему о коде нельзя",
    ).toBe("none");

    const пунктов = панель!.querySelectorAll("a").length;
    process.stderr.write(`[сторож] пунктов в панели меню: ${пунктов}${String.fromCharCode(10)}`);
    expect(пунктов, "в панели нет ссылок — проверять нечего").toBeGreaterThan(0);

    expect(details!.open, "details обязан рождаться закрытым").toBe(false);
    expect(getComputedStyle(панель!).display, "при закрытом details панель обязана быть none").toBe("none");

    details!.open = true;
    expect(getComputedStyle(панель!).display, "при открытом details панель обязана раскрываться в grid").toBe("grid");
  });

  it("медиазапрос прячет полную строку на узком экране", () => {
    const c = отрисовать();
    const стиль = [...c.querySelectorAll("style")].map((s) => s.textContent || "").join(" ");
    expect(стиль, "нет правила скрытия полной строки").toMatch(/max-width:\s*700px/);
    expect(стиль.replace(/\s+/g, ""), "полная строка не прячется").toContain(".aev-hdr-full{display:none");
  });
});
