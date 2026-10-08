import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const пример = { vitD: 35, hsCRP: 1.5, homaIR: 2, omega3Index: 6, glucose: 5.2, apoB: 0.9, vo2max: 35, waist: 90 };

describe("/longevity: один тап и место под install-пилюлю", () => {
  it("кнопка «Показать на примере» есть в первом экране ДО ввода", () => {
    render(<LongevityClient />);
    expect(screen.getByRole("button", { name: /показать на примере/i })).toBeTruthy();
  });

  it("клик по примеру шлёт в /assess ВСЕ 8 полей со значениями-примерами (знаменатель)", async () => {
    const user = userEvent.setup();
    render(<LongevityClient />);
    await user.click(screen.getByRole("button", { name: /показать на примере/i }));

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
