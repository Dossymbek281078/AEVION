import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { DataProvenanceChip } from "@/components/DataProvenanceChip";

/**
 * Чип обязан говорить на языке СТРАНИЦЫ — проверка следствия, не формы.
 *
 * Соседний сторож (provenanceChipHasNoHardcodedRussian) спрашивает «нет ли
 * русских литералов в разметке» и после выноса подписей в объект умолчаний стал
 * ЧЕСТНО зелёным. При этом посетитель английской страницы читал прежний русский
 * текст: умолчания русские, а страницы подписи не передают. Строка сменила
 * место, а не язык на экране.
 *
 * Поэтому здесь спрашивается ровно то, что видит человек: кириллица в видимом
 * тексте И в атрибуте подсказки, которая показывается по наведению и в обычный
 * textContent не попадает вовсе — именно там жили шесть подписей из семи.
 */

const КИРИЛЛИЦА = /[а-яА-Я]/;

const данные = {
  measured: 50,
  derived: 30,
  guessed: 20,
  total: 100,
  measuredPct: 96,
  realPct: 50.1,
  source: "OpenStreetMap (Overpass, ODbL)",
  // Фикстура повторяет ЖИВОЙ ответ /api/qskyway/cities, а не удобную выдумку.
  // Замер 02.09.2026: note приходит только по-русски, английского варианта в
  // данных нет вовсе. Прежняя фикстура подавала пустую строку — и сторож был
  // слеп к целому пути на экран по построению, оставаясь зелёным.
  note: "hs 0=обмерено властями (в этом городе такого источника нет) 1=выведено",
};

/**
 * Подсказка рисуется ТОЛЬКО открытой: её текст лежит в children элемента с
 * role="tooltip", которого до нажатия в дереве нет вовсе. Именно поэтому шесть
 * подписей из семи и жили незамеченными — обычный textContent их не видит.
 *
 * Контроль этого теста ловил меня ровно здесь: подсаженное русское слово он не
 * находил, потому что выборка не открывала подсказку. Красный контроль назвал
 * слепоту прибора раньше, чем я успел поверить зелёному.
 */
function открытьПодсказки(el: HTMLElement): void {
  el.querySelectorAll("button").forEach((b) => {
    const имя = b.getAttribute("aria-label") ?? "";
    if (имя.startsWith("What is") || имя.includes("?")) fireEvent.click(b);
  });
}

function видимыйИСкрытыйТекст(el: HTMLElement): string {
  открытьПодсказки(el);
  const части: string[] = [el.textContent ?? ""];
  el.querySelectorAll("*").forEach((n) => {
    for (const a of ["title", "aria-label", "placeholder", "alt", "data-tip"]) {
      const v = n.getAttribute(a);
      if (v) части.push(v);
    }
  });
  return части.join(" | ");
}

describe("чип провенанса говорит на языке страницы", () => {
  beforeEach(() => {
    document.documentElement.lang = "en";
    try { window.localStorage.setItem("aevion_lang_v1", "en"); } catch { /* нет хранилища — не беда */ }
  });

  it("на английской локали в чипе нет кириллицы — ни в тексте, ни в подсказках", () => {
    const { container } = render(
      <I18nProvider><DataProvenanceChip dataQuality={данные} /></I18nProvider>,
    );
    const текст = видимыйИСкрытыйТекст(container);
    const найдено = текст
      .split("|")
      .map((s) => s.trim())
      .filter((s) => КИРИЛЛИЦА.test(s));
    expect(найдено, "английская страница показывает русский текст").toEqual([]);
  });

  it("проверка вообще способна увидеть кириллицу — контроль", () => {
    const { container } = render(
      <I18nProvider>
        <DataProvenanceChip dataQuality={данные} labels={{ tipSource: "Источник" }} />
      </I18nProvider>,
    );
    const текст = видимыйИСкрытыйТекст(container);
    expect(КИРИЛЛИЦА.test(текст), "контроль: подсаженное русское слово не найдено").toBe(true);
  });

  it("чип вообще что-то рисует — иначе пустота прошла бы как успех", () => {
    const { container } = render(
      <I18nProvider><DataProvenanceChip dataQuality={данные} /></I18nProvider>,
    );
    expect((container.textContent ?? "").trim().length, "чип пуст").toBeGreaterThan(3);
  });
});
