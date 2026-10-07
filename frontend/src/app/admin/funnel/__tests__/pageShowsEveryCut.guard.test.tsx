import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FunnelAdminClient, этоРазрез } from "../_client";

/*
 * 🔴 Сторож на УТВЕРЖДЕНИЕ: страница показывает КАЖДЫЙ разрез, который отдаёт
 * ручка, — включая тот, о котором она ничего не знает.
 *
 * Повод. За сутки до этой страницы класс «посчитал разрез и не отдал» укусил
 * трижды (byPost и byEntryPage 30.09, byUnknownTag и byReferrerHost 06.10), и
 * каждый раз причина была одна: код перечислял известные имена, а новое
 * дописать забывали. Проверка «на странице есть byChannel и byReferrerHost»
 * повторила бы ту же ошибку на новом этаже: она зелёная и ничего не обещает
 * про следующий разрез.
 *
 * Поэтому главный тест кормит страницу ответом с ВЫДУМАННЫМ разрезом, которого
 * в коде нет нигде. Если он отрисовался — новый разрез увидит человек без
 * правки страницы. Если нет — сторож краснеет, и мы знаем об этом до того, как
 * разрез тихо пропадёт из глаз.
 */

const ОТВЕТ = {
  known: true,
  days: 14,
  eventsSeen: 500,
  botsExcluded: 40,
  botsExcludedByWebdriver: 7,
  botsExcludedByUserAgent: 33,
  total: {
    visits: 100,
    visitsOurs: 12,
    pricing: 20,
    pricingOurs: 3,
    checkoutStart: 4,
    checkoutStartOurs: 3,
    paid: 0,
    paidOurs: 0,
  },
  totalUnits: "визиты и доЦен — уникальные сессии за всё окно",
  byChannel: {
    youtube: { visits: 48, visitsOurs: 0, pricing: 0, pricingOurs: 0, paid: 0 },
    direct: { visits: 52, visitsOurs: 12, pricing: 20, pricingOurs: 3, paid: 0 },
  },
  byReferrerHost: {
    "t.co": { visits: 10, visitsOurs: 2, pricing: 4, pricingOurs: 1 },
    "(не назван)": { visits: 30, visitsOurs: 0, pricing: 1, pricingOurs: 0 },
  },
  byUnknownTag: {
    "ref:some-catalog": { visits: 3, visitsOurs: 0, pricing: 0, pricingOurs: 0 },
  },
  // 🔴 Разреза с таким именем в коде страницы НЕТ. Он проверяет, что отрисовка
  // обобщённая, а не по списку.
  byВыдуманныйРазрез: {
    ключ_из_будущего: { visits: 7, visitsOurs: 1, pricing: 2, pricingOurs: 0 },
  },
};

function подменитьРучку(ответ: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok,
        status: ok ? 200 : 503,
        json: () => Promise.resolve(ответ),
      } as Response),
    ),
  );
}

beforeEach(() => {
  подменитьРучку(ОТВЕТ);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("страница воронки показывает всё, что отдаёт ручка", () => {
  it("🔴 разрез, которого страница не знает, всё равно отрисован", async () => {
    const { container } = render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(container.querySelector('[data-razrez="byChannel"]')).not.toBeNull();
    });

    const нарисованы = Array.from(container.querySelectorAll("[data-razrez]")).map((э) =>
      э.getAttribute("data-razrez"),
    );
    const вОтвете = Object.entries(ОТВЕТ)
      .filter(([к, з]) => к.startsWith("by") && этоРазрез(з))
      .map(([к]) => к);

    // Контроль прибора: разрезов в ответе больше одного, иначе утверждение
    // «все на месте» было бы истиной ни о чём.
    expect(вОтвете.length).toBeGreaterThanOrEqual(4);
    expect(вОтвете).toContain("byВыдуманныйРазрез");

    const потерянные = вОтвете.filter((к) => !нарисованы.includes(к));
    expect(потерянные, "разрез пришёл в ответе, но человек его не увидит").toEqual([]);
  });

  it("живое число = всего минус наши, и оно подписано", async () => {
    const { container } = render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(container.querySelector('[data-razrez="byReferrerHost"]')).not.toBeNull();
    });
    const раздел = container.querySelector('[data-razrez="byReferrerHost"]')!;
    const строки = Array.from(раздел.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent),
    );
    // «(не назван)»: 30 всего, 0 наших → 30 живых; t.co: 10 и 2 → 8.
    const неназван = строки.find((с) => с[0] === "(не назван)");
    expect(неназван?.slice(1, 4)).toEqual(["30", "0", "30"]);
    const tco = строки.find((с) => с[0] === "t.co");
    expect(tco?.slice(1, 4)).toEqual(["10", "2", "8"]);
  });

  it("у каждого нарисованного разреза названа единица", async () => {
    const { container } = render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(container.querySelector('[data-razrez="byChannel"]')).not.toBeNull();
    });
    for (const раздел of Array.from(container.querySelectorAll("[data-razrez]"))) {
      expect(раздел.textContent, `разрез без единицы: ${раздел.getAttribute("data-razrez")}`).toMatch(
        /Единица:/,
      );
    }
    // И отдельно: у выдуманного разреза единицы в словаре нет, поэтому страница
    // обязана сказать это ВСЛУХ, а не промолчать — иначе число прочтут наугад.
    const выдуманный = container.querySelector('[data-razrez="byВыдуманныйРазрез"]');
    expect(выдуманный?.textContent).toMatch(/НЕ ОПИСАНА/);
  });

  it("🔴 отказ ручки рисуется словами, а НЕ нулями", async () => {
    // Самая дорогая ошибка панели: ноль читается как «людей не было», тогда
    // как правда — «не спросили».
    подменитьРучку({}, false);
    render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(screen.getByText(/Спросить не удалось/)).toBeTruthy();
    });
    expect(screen.getByText(/НЕ «людей не было»/)).toBeTruthy();
  });

  it("КОНТРОЛЬ: служебные поля ответа за разрезы не принимаются", () => {
    // Иначе страница нарисовала бы «таблицу» из подписи или из числа событий.
    expect(этоРазрез(ОТВЕТ.totalUnits)).toBe(false);
    expect(этоРазрез(ОТВЕТ.eventsSeen)).toBe(false);
    expect(этоРазрез([1, 2, 3])).toBe(false);
    expect(этоРазрез(ОТВЕТ.byChannel)).toBe(true);
  });
});
