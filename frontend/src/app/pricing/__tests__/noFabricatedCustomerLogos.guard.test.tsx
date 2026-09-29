import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { standaloneApp } from "@/lib/termPricing";

/**
 * НА СТРАНИЦЕ ЦЕН НЕТ ВЫДУМАННЫХ КЛИЕНТОВ.
 *
 * Повод. 29.09.2026 на /pricing стоял ряд «логотипов клиентов» (INKUBATOR,
 * Acme Legal, FINTECH·5, STORYTELLER…) под заголовком «используют команды из
 * 30+ стран» — при двух продажах за всё время. В самом компоненте было
 * написано, что плашки выдуманы и «имитируют diverse customer base».
 *
 * Почему сторож смотрит ОТРИСОВКУ, а не словари. Свип 20.09.2026 уже убирал с
 * сайта выдуманные отзывы, кейсы и счётчики и оставил три сторожа — но все они
 * смотрят СЛОВАРИ. Этот ряд их пережил, потому что жил отдельным компонентом с
 * зашитым списком. Проверка по словарю такого не увидит никогда.
 *
 * Возвращать ряд можно только с настоящими клиентами и их разрешением.
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
    const тело = {
      currencies: { USD: { symbol: "$", rate: 1 }, KZT: { symbol: "₸", rate: 470 }, EUR: { symbol: "€", rate: 0.92 } },
      tiers: [], modules: [], bundles: [], notes: [], items: [], runs: [],
    };
    return { ok: true, status: 200, json: async () => тело } as unknown as Response;
  });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("страница цен не показывает выдуманных клиентов", () => {
  it("ни плашек, ни заявления о 30+ странах", async () => {
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

    // КОНТРОЛЬ СНАЧАЛА: страница действительно отрисовалась. Без него пустой
    // экран прошёл бы все проверки ниже и сторож был бы зелёным по построению —
    // ровно тот класс, когда отсутствие принимают за чистоту.
    const вход = standaloneApp("multichat");
    expect(
      текст.includes(вход!.name),
      "страница не отрисовалась — проверки ниже ничего не значат",
    ).toBe(true);

    const запрещено = [
      "Acme Legal",
      "INKUBATOR",
      "FINTECH",
      "STORYTELLER",
      "30+ COUNTRIES",
      "30+ СТРАН",
      "TRUSTED BY TEAMS",
    ];
    for (const слово of запрещено) {
      expect(
        текст.includes(слово),
        `на странице цен вернулось выдуманное свидетельство: «${слово}»`,
      ).toBe(false);
    }
  }, 120000);
});
