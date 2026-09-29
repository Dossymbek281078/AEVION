import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { STANDALONE_APPS } from "@/lib/termPricing";

/**
 * СКОЛЬКО ПРИЛОЖЕНИЙ ПРОДАЁТСЯ ОТДЕЛЬНО — страница говорит то же, что список.
 *
 * Повод 29.09.2026: страница цен дважды писала «пять приложений продаются
 * отдельно», а продавались девять — и тут же сумма «$480 за этот срок»
 * считалась по всем девяти. Число жило СЛОВОМ в трёх словарях (en/ru/kk) и в
 * двух строках словаря цен, поэтому расходилось молча.
 *
 * Теперь число берётся из STANDALONE_APPS — того же списка, из которого
 * рисуются карточки. Сторож держит именно это: словом число больше не пишем.
 */

function ответыСервера() {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    if (адрес.includes("checkout/healthz")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true } } }) } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      return { ok: true, status: 200, json: async () => ({ numbers: [], badges: [] }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({
      currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
      tiers: [], modules: [], bundles: [], notes: [], items: [], runs: [],
    }) } as unknown as Response;
  });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("число отдельных приложений", () => {
  it("на странице стоит то же число, что в списке, и не словом", async () => {
    ответыСервера();
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => import("react").JSX.Element;
    await act(async () => {
      render(
        <I18nProvider>
          <Страница />
        </I18nProvider>,
      );
    });
    const текст = document.body.textContent ?? "";
    const сколько = STANDALONE_APPS.length;

    // Контроль: страница отрисовалась (иначе всё ниже зелено по построению).
    expect(текст.length > 500, "страница не отрисовалась").toBe(true);

    expect(
      текст.includes(`${сколько} apps`) || текст.includes(`${сколько} приложений`),
      `на странице нет числа ${сколько} рядом со словом «приложений» — снова разойдётся со списком`,
    ).toBe(true);

    for (const словом of ["Five apps", "five apps", "Пять приложений", "пять приложений"]) {
      expect(текст.includes(словом), `число снова написано словом: «${словом}»`).toBe(false);
    }
  }, 120000);

  it("КОНТРОЛЬ: список не пуст и не единица — иначе проверка выше бессмысленна", () => {
    expect(STANDALONE_APPS.length).toBeGreaterThan(1);
  });
});
