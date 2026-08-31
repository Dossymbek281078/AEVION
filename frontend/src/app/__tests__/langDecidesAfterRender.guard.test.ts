import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Язык объявляется ПОСЛЕ того, как страницу нарисовал React.
 *
 * Скрипт в макете решает язык по содержимому: считает кириллицу против латиницы
 * в теле страницы. Он стоял в конце тела и повторялся на DOMContentLoaded и
 * load — и всё это происходит ДО того, как React нарисует текст.
 *
 * Замер на проде 31.08.2026, прямым запросом (ровно то, что видит браузер в
 * момент разбора документа):
 *
 *     /bank/glossary   кириллицы 11, латиницы 27767
 *     /support         кириллицы 11, латиницы  7436
 *     /pricing/paddle  кириллицы  0, латиницы    24
 *
 * То есть решение принималось по пустой странице, и «латиница» было честным
 * ответом: считать было нечего. Сторож языка настоящим браузером показывал
 * 61 адрес из 62 с неверным объявлением и «починено за всё время: 0» — починка
 * была выкачена и просто не успевала.
 *
 * ⚠️ Этот сторож проверяет ПОВЕДЕНИЕ, а не наличие строки. Проверка «в скрипте
 * есть MutationObserver» закрепила бы форму: наблюдателя можно оставить и
 * лишить силы (наблюдать не то, отключать сразу, решать по пустому телу), и
 * такая проверка осталась бы зелёной. Поэтому скрипт берётся из макета и
 * ИСПОЛНЯЕТСЯ, а текст подставляется с задержкой — так же, как это делает React.
 */

const LAYOUT = join(__dirname, "..", "layout.tsx");

/** Тело скрипта решения языка — без регулярок: они здесь дважды теряли слэши. */
function langScript(): string {
  const src = readFileSync(LAYOUT, "utf8");
  const начало = src.indexOf("(function(){try{var d=document.documentElement;function seen()");
  expect(начало, "скрипт решения языка не найден в макете").toBeGreaterThan(-1);
  const конец = src.indexOf('" }}', начало);
  expect(конец, "конец скрипта не найден").toBeGreaterThan(начало);
  return src.slice(начало, конец);
}

const РУССКИЙ = "Оплата картой и переводом. Тариф включает доступ ко всем модулям платформы.";

describe("язык объявляется после отрисовки, а не до неё", () => {
  it("контроль: скрипт вообще извлекается и исполняется", () => {
    const код = langScript();
    expect(код.length, "скрипт подозрительно короткий").toBeGreaterThan(300);
    expect(() => new Function(код)(), "скрипт не исполняется").not.toThrow();
  });

  it("пустая страница языка НЕ меняет — иначе мы бы врали в другую сторону", () => {
    document.documentElement.lang = "en";
    document.documentElement.removeAttribute("data-lang-src");
    document.body.innerHTML = "<div>Pricing and plans</div>";
    new Function(langScript())();
    expect(document.documentElement.lang, "английская страница обязана остаться английской").toBe("en");
  });

  it("русский текст, пришедший ПОЗЖЕ, переключает язык", async () => {
    document.documentElement.lang = "en";
    document.documentElement.removeAttribute("data-lang-src");
    document.body.innerHTML = "<div id='root'></div>";

    new Function(langScript())();
    // На этот момент решение уже принято — и оно «латиница», честно: текста нет.
    expect(document.documentElement.lang).toBe("en");

    // А теперь страницу рисует React, как на всех наших клиентских страницах.
    const root = document.getElementById("root")!;
    for (let i = 0; i < 3; i++) {
      const p = document.createElement("p");
      p.textContent = РУССКИЙ;
      root.appendChild(p);
    }

    // Наблюдатель срабатывает микрозадачей — ждём её.
    await new Promise((r) => setTimeout(r, 0));

    expect(
      document.documentElement.lang,
      "текст пришёл после отрисовки, а язык остался английским: браузер предложит перевод",
    ).toBe("ru");
    expect(document.documentElement.getAttribute("data-lang-src")).toBe("content");
  });
});
