import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import LongevityClient from "../_client";

/**
 * Деньги: 06–07.10 на /longevity 14 живых зашли с YouTube, попробовали 0. Две причины
 * чинились этой правкой, и сторож держит обе:
 *  1) первый экран требовал НАБРАТЬ 8 анализов прежде любого результата — нет действия
 *     «в один тап». Добавлена кнопка «Показать на примере»: заполняет значения-плейсхолдеры
 *     и сразу считает. Знаменатель: в запрос уходят ВСЕ поля формы, не часть.
 *  2) фиксированная пилюля InstallPrompt (bottom-right) закрывала низ формы на телефоне —
 *     контейнер страницы теперь резервирует место через --aevion-install-h.
 *
 * Рендером, а не браузером: тест идёт всегда, а браузер занят соседней сессией.
 */

// Форма на монтировании зовёт /api/longevity/panel, по кнопке — /api/longevity/assess.
let вызовы: Array<{ url: string; body: any }>;

beforeEach(() => {
  вызовы = [];
  vi.stubGlobal("fetch", vi.fn(async (input: any, init?: any) => {
    const url = String(input);
    вызовы.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    if (url.includes("/assess")) {
      return { ok: true, json: async () => ({ flaggedMarkers: [], measuredCount: 8, recommendedStack: [], contraindicationGated: [], cycle: { phases: [] }, informOnly: [], disclaimer: "" }) } as any;
    }
    // panel и всё прочее — не ok, чтобы страница не зависела от их формы
    return { ok: false, json: async () => ({}) } as any;
  }));
  // Первый-экранная кнопка зовёт scrollIntoView; jsdom его не реализует.
  (Element.prototype as any).scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const пример = { vitD: 35, hsCRP: 1.5, homaIR: 2, omega3Index: 6, glucose: 5.2, apoB: 0.9, vo2max: 35, waist: 90 };

describe("/longevity: один тап и место под install-пилюлю", () => {
  it("кнопка «Показать на примере» есть в первом экране ДО ввода", () => {
    render(<LongevityClient />);
    expect(screen.getByRole("button", { name: "Показать на примере" })).toBeTruthy();
  });

  it("клик по примеру шлёт в /assess ВСЕ 8 полей со значениями-примерами (знаменатель)", async () => {
    const user = userEvent.setup();
    render(<LongevityClient />);
    await user.click(screen.getByRole("button", { name: "Показать на примере" }));

    const assess = вызовы.find((c) => c.url.includes("/assess"));
    expect(assess, "клик по примеру не позвал /assess — один тап не работает").toBeTruthy();
    const values = assess!.body.values;
    // Знаменатель: заполнено ВСЁ, а не часть. 8 полей ASSESS_FIELDS.
    expect(Object.keys(values).length, "в запрос ушло не 8 полей").toBe(8);
    expect(values).toMatchObject(пример);
  });

  it("контейнер страницы резервирует низ под фиксированную пилюлю InstallPrompt", () => {
    render(<LongevityClient />);
    const main = screen.getByRole("main");
    // Без резерва (ревёрт paddingBottom) пилюля снова закроет кнопку на телефоне.
    expect(String(main.style.paddingBottom)).toContain("--aevion-install-h");
  });
});

/**
 * Волна 30: кнопка примера В ПЕРВОМ ЭКРАНЕ. Замер 07.10 (390×844, ru-RU): кнопка в
 * форме была на y≈2275, гость из ролика до неё не доходил. Рядом со ссылкой
 * «Бесплатный протокол — ниже ↓» (y≈475) добавлена кнопка «…за один тап»:
 * заполняет форму и считает. Граница (решение 01.10): порядок платного/бесплатного
 * НЕ меняется — книга (#kniga) выше бесплатной секции (#besplatno).
 */
describe("/longevity: кнопка примера в первом экране + порядок", () => {
  it("первый-экранная кнопка «за один тап» заполняет ВСЕ 8 полей и считает", async () => {
    const user = userEvent.setup();
    render(<LongevityClient />);
    await user.click(screen.getByRole("button", { name: /за один тап/i }));
    const assess = вызовы.find((c) => c.url.includes("/assess"));
    expect(assess, "первый-экранная кнопка не позвала /assess").toBeTruthy();
    expect(Object.keys(assess!.body.values).length, "ушло не 8 полей").toBe(8);
    expect(assess!.body.values).toMatchObject(пример);
  });

  it("порядок в разметке: кнопка выше бесплатной секции, книга (платное) тоже выше неё", () => {
    const src = readFileSync(join(__dirname, "..", "_client.tsx"), "utf8");
    const кнопка = src.indexOf("styles.freeExampleCta");
    const книга = src.indexOf('id="kniga"');
    const беспл = src.indexOf('id="besplatno"');
    expect(кнопка, "нет кнопки freeExampleCta").toBeGreaterThan(-1);
    // Кнопка-CTA в первом экране — выше бесплатной секции.
    expect(кнопка).toBeLessThan(беспл);
    // Решение 01.10 не тронуто: платная книга выше бесплатной секции.
    expect(книга).toBeGreaterThan(-1);
    expect(книга).toBeLessThan(беспл);
  });
});
