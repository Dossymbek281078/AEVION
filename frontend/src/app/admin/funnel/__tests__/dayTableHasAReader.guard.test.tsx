import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FunnelAdminClient, клеткаСуток, этоРазрез } from "../_client";

/*
 * 🔴 У СУТОЧНОГО РАЗРЕЗА ПОЯВИЛСЯ ЧЕЛОВЕЧЕСКИЙ ЧИТАТЕЛЬ.
 *
 * Найдено 11.10.2026, сразу после того как я добавил в `byDay` ступени
 * «нажали», «доиграли» и «задача дня»: страница воронки их НЕ ПОКАЗЫВАЛА — и не
 * показывала даже визиты по дням. Причина не в списке имён, а в форме:
 * `byDay` — МАССИВ, а обобщённая отрисовка разрезов принимает только словарь
 * (`этоРазрез` отвергает массивы, и это проверено отдельным контролем). То есть
 * все суточные числа существовали только для того, кто спросит ручку командой.
 *
 * Это тот же класс «посчитал и не отдал», которым мы уже трижды теряли разрезы,
 * только этажом выше: на сервере поле есть, в глазах человека его нет. Поэтому
 * сторож проверяет не наличие знакомых столбцов, а ДВА обещания:
 *   1. каждый день из ответа виден;
 *   2. столбцы берутся из ответа, поэтому НОВОЕ суточное поле появляется само
 *      (в наборе есть выдуманное поле, которого в коде страницы нет).
 *
 * И третье, дорогое: отсутствие числа не рисуется нулём. `paid: null` значит
 * «не измерялось», отсутствие `visitsOurs` — «неизвестно, сколько из этого
 * наше», и живое число в обоих случаях назвать нельзя.
 */

const ОТВЕТ = {
  known: true,
  days: 14,
  eventsSeen: 300,
  botsExcluded: 20,
  total: {
    visits: 30,
    visitsOurs: 4,
    pricing: 9,
    pricingOurs: 2,
    checkoutStart: 1,
    checkoutStartOurs: 0,
    paid: null,
    paidOurs: null,
  },
  totalUnits: "визиты — сумма суточных уникальных сессий",
  byChannel: {
    youtube: { visits: 20, visitsOurs: 0, pricing: 4, pricingOurs: 0 },
  },
  // Дни приходят от ручки по возрастанию; страница обязана показать свежий первым.
  byDay: [
    {
      day: "2026-10-09",
      visits: 10,
      visitsOurs: 2,
      pricing: 3,
      pricingOurs: 1,
      checkoutStart: 0,
      checkoutStartOurs: 0,
      paid: null,
      paidOurs: null,
      clicked: 2,
      clickedOurs: 0,
      finished: 1,
      finishedOurs: 1,
      dailyOpened: 0,
      dailyOpenedOurs: 0,
    },
    {
      day: "2026-10-10",
      visits: 20,
      // 🔴 Поля visitsOurs здесь НЕТ: так отвечает прод, который старше правки.
      pricing: 6,
      pricingOurs: 1,
      checkoutStart: 1,
      checkoutStartOurs: 0,
      paid: 0,
      paidOurs: 0,
      clicked: 1,
      clickedOurs: 0,
      finished: 0,
      finishedOurs: 0,
      dailyOpened: 3,
      dailyOpenedOurs: 0,
      // Выдуманное суточное поле: в коде страницы его нет нигде.
      поделились: 4,
      поделилисьOurs: 1,
    },
  ],
};

function подменитьРучку(ответ: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => ответ })),
  );
}

beforeEach(() => подменитьРучку(ОТВЕТ));
afterEach(() => vi.unstubAllGlobals());

describe("суточный разрез видно человеку", () => {
  it("🔴 таблица по дням нарисована, и в ней КАЖДЫЙ день из ответа", async () => {
    const { container } = render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(container.querySelector('[data-sutki="byDay"]'), "раздела «По дням» нет").not.toBeNull();
    });
    const раздел = container.querySelector('[data-sutki="byDay"]')!;
    const дни = Array.from(раздел.querySelectorAll("tbody tr")).map(
      (tr) => tr.querySelector("td")?.textContent,
    );
    expect(дни).toEqual(["2026-10-10", "2026-10-09"]);
  });

  it("🔴 НОВОЕ суточное поле появляется само, под техническим именем", async () => {
    const { container } = render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(container.querySelector('[data-sutki="byDay"]')).not.toBeNull();
    });
    const раздел = container.querySelector('[data-sutki="byDay"]')!;
    const заголовки = Array.from(раздел.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(
      заголовки.some((з) => з?.includes("поделились")),
      "новое суточное поле на странице не появилось — отрисовка по списку имён",
    ).toBe(true);
    // И страница честно говорит, что единицу этого поля не знает.
    expect(заголовки.find((з) => з?.includes("поделились"))).toMatch(/НЕ ОПИСАНА/);
    // Столбца «наши» отдельно быть не должно: пара склеивается по имени.
    expect(заголовки.some((з) => з?.includes("Ours")), "поля Ours нарисованы столбцами").toBe(false);
  });

  it("🔴 нет числа — слово, а НЕ ноль: «не измерялось» и «неизвестно»", async () => {
    const { container } = render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(container.querySelector('[data-sutki="byDay"]')).not.toBeNull();
    });
    const строки = Array.from(
      container.querySelectorAll('[data-sutki="byDay"] tbody tr'),
    ) as HTMLElement[];
    const девятое = строки.find((tr) => tr.textContent?.includes("2026-10-09"))!;
    const десятое = строки.find((tr) => tr.textContent?.includes("2026-10-10"))!;

    expect(девятое.textContent, "paid: null нарисован нулём").toMatch(/не измерялось/);
    expect(десятое.textContent, "отсутствие visitsOurs нарисовано нулём").toMatch(
      /наши неизвестно/,
    );
    expect(десятое.textContent, "живое посчитано вычитанием несуществующего числа").toMatch(
      /живые неизвестно/,
    );
    // Контроль в обратную сторону: там, где числа ЕСТЬ, страница считает.
    expect(девятое.textContent).toMatch(/всего 10 · наши 2 · живые 8/);
    expect(десятое.textContent).toMatch(/всего 6 · наши 1 · живые 5/);
  });

  it("КОНТРОЛЬ: три исхода клетки проверяются и без отрисовки", () => {
    expect(клеткаСуток({ visits: 7, visitsOurs: 2 }, "visits")).toBe(
      "всего 7 · наши 2 · живые 5",
    );
    expect(клеткаСуток({ paid: null, paidOurs: null }, "paid")).toBe("не измерялось");
    expect(клеткаСуток({ visits: 7 }, "visits")).toMatch(/наши неизвестно/);
    expect(клеткаСуток({ visits: 7 }, "visits")).not.toMatch(/наши 0/);
    // Ноль — это измеренный ноль, и он обязан печататься числом.
    expect(клеткаСуток({ paid: 0, paidOurs: 0 }, "paid")).toBe("всего 0 · наши 0 · живые 0");
    // Поля нет вовсе — это не ноль и не «не измерялось».
    expect(клеткаСуток({}, "visits")).toBe("нет числа");
  });

  it("КОНТРОЛЬ: массив по-прежнему не считается обычным разрезом", () => {
    // Именно поэтому byDay и нужен свой раздел: если однажды `этоРазрез` начнёт
    // принимать массивы, таблица задвоится, и это надо заметить.
    expect(этоРазрез(ОТВЕТ.byDay)).toBe(false);
  });

  it("КОНТРОЛЬ: пустой byDay не рисует пустую таблицу", async () => {
    подменитьРучку({ ...ОТВЕТ, byDay: [] });
    const { container } = render(<FunnelAdminClient />);
    await waitFor(() => {
      expect(screen.getByText(/Итог за окно/)).toBeTruthy();
    });
    expect(container.querySelector('[data-sutki="byDay"]')).toBeNull();
  });
});
