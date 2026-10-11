import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { FunnelAdminClient } from "../_client";

/*
 * 🔴 ДВА ЧИТАТЕЛЯ, КОТОРЫХ НЕ БЫЛО: ЧАСЫ И НАЗВАНИЕ ОКНА.
 *
 * 1. Разрез `byHour` — МАССИВ, а обобщённая отрисовка принимает только словарь,
 *    поэтому часы на странице не показывались ВОВСЕ: ручка их считала и
 *    отдавала, а читателя у них не было. Тот же класс «посчитал и не отдал»,
 *    которым мы уже теряли суточный разрез, только этажом выше.
 *
 *    Цена именно для часов особая: ПЕРВЫЙ непустой час ступени и есть час, с
 *    которого её отправитель заработал. Без этого «ноль за день» не отличить от
 *    «ступень включили вечером» — и ноль читается как «никто не сделал».
 *
 * 2. Окно не называлось. Ручка умеет и скользящие сутки, и календарный день
 *    (`day=`), и числа у них РАЗНЫЕ. Пока на странице стоял только заголовок
 *    «Итог за окно», скользящие сутки читались как «за сегодня» — я сам чуть не
 *    положил их в сводку основателю под видом календарного дня.
 *
 * 3. И третье, дорогое: у разреза БЕЗ оси «наши» живое число назвать нельзя.
 *    Прежде страница печатала там «наши 0 · живые = всего», то есть наши пробы
 *    выглядели людьми. Сейчас все разрезы ось несут, но первый же без неё
 *    соврал бы молча — поэтому проверяется слово «неизвестно», а не ноль.
 */

/** Часов больше предела показа — чтобы проверить, что обрезка НАЗВАНА. */
const МНОГО_ЧАСОВ = Array.from({ length: 30 }, (_, i) => ({
  hour: `2026-10-${String(11 + Math.floor(i / 24)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}`,
  visits: i + 1,
  visitsOurs: 0,
  pricing: 0,
  checkoutStart: 0,
  thankYouOpened: 0,
  paid: null,
  paidOurs: null,
  progressed: i === 29 ? 1 : 0,
  progressedOurs: 0,
  puzzleSolved: 0,
  puzzleSolvedOurs: 0,
  // Выдуманное поле: новое часовое поле обязано появиться САМО.
  поделились: 2,
}));

const ОТВЕТ = {
  known: true,
  days: 14,
  eventsSeen: 300,
  botsExcluded: 20,
  total: { visits: 30, visitsOurs: 4, pricing: 9, pricingOurs: 2 },
  totalUnits: "визиты — сумма суточных уникальных сессий",
  окно: {
    день: null,
    дней: 14,
    от: "2026-09-28T19:00:00.000Z",
    до: "2026-10-12T19:00:00.000Z",
    зона: "скользящее окно, кончается моментом замера",
  },
  byChannel: {
    youtube: { visits: 20, visitsOurs: 3 },
    // 🔴 Разрез БЕЗ оси «наши» — живое число назвать нечем.
    "без-оси": { visits: 7, pricing: 1 },
  },
  byDay: [{ day: "2026-10-11", visits: 10, visitsOurs: 2 }],
  byHour: МНОГО_ЧАСОВ,
};

function подменитьРучку(ответ: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => ответ })),
  );
}

async function нарисовать(ответ: unknown = ОТВЕТ) {
  подменитьРучку(ответ);
  const { container } = render(<FunnelAdminClient />);
  await waitFor(() => {
    expect(container.querySelector("h2"), "страница не отрисовалась").not.toBeNull();
  });
  return container;
}

beforeEach(() => подменитьРучку(ОТВЕТ));
afterEach(() => vi.unstubAllGlobals());

describe("часы и окно видно человеку", () => {
  it("🔴 таблица по часам нарисована, свежий час первым", async () => {
    const container = await нарисовать();
    await waitFor(() => {
      expect(
        container.querySelector('[data-chasy="byHour"]'),
        "раздела «По часам» нет — массив снова некому читать",
      ).not.toBeNull();
    });
    const раздел = container.querySelector('[data-chasy="byHour"]')!;
    const часы = Array.from(раздел.querySelectorAll("tbody tr")).map(
      (tr) => tr.querySelector("td")?.textContent,
    );
    expect(часы.length, "показано не 24 часа").toBe(24);
    expect(часы[0], "свежий час не первым").toBe(МНОГО_ЧАСОВ[29].hour);
  });

  it("🔴 СВОЯ обрезка названа числами", async () => {
    // Обрезал — обязан сказать «показаны первые N», иначе «показано всё» и
    // «показана часть» выглядят одинаково.
    const container = await нарисовать();
    const раздел = container.querySelector('[data-chasy="byHour"]')!;
    expect(раздел.textContent).toMatch(/Показаны последние 24 часов из 30/);
    expect(раздел.textContent, "не сказано, что обрезка наша").toMatch(/обрезка наша/);
  });

  it("🔴 час включения ступени объяснён словами прямо в таблице", async () => {
    const container = await нарисовать();
    const раздел = container.querySelector('[data-chasy="byHour"]')!;
    expect(раздел.textContent).toMatch(/ПЕРВЫЙ непустой час/);
    expect(раздел.textContent).toMatch(/не измерялось/);
    expect(раздел.textContent, "не сказано, что часы нельзя складывать").toMatch(
      /складывать нельзя/,
    );
  });

  it("🔴 новое часовое поле появляется САМО, под техническим именем", async () => {
    const container = await нарисовать();
    const раздел = container.querySelector('[data-chasy="byHour"]')!;
    const заголовки = Array.from(раздел.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(
      заголовки.some((з) => з?.includes("поделились")),
      "новое часовое поле не появилось — отрисовка по списку имён",
    ).toBe(true);
    expect(заголовки.find((з) => з?.includes("поделились"))).toMatch(/НЕ ОПИСАНА/);
    expect(заголовки.some((з) => з?.includes("Ours")), "поля Ours нарисованы столбцами").toBe(
      false,
    );
  });

  it("🔴 окно НАЗВАНО: скользящее не выдаётся за календарный день", async () => {
    const container = await нарисовать();
    expect(container.textContent).toMatch(/Окно: скользящее, 14 сут\./);
    expect(container.textContent).toMatch(/скользящее окно, кончается моментом замера/);
  });

  it("🔴 календарный день назван днём", async () => {
    const container = await нарисовать({
      ...ОТВЕТ,
      окно: {
        день: "2026-10-11",
        дней: 1,
        от: "2026-10-10T19:00:00.000Z",
        до: "2026-10-11T19:00:00.000Z",
        зона: "Asia/Almaty (UTC+5), календарные сутки",
      },
    });
    expect(container.textContent).toMatch(/календарный день 2026-10-11/);
    expect(container.textContent).toMatch(/Almaty/);
  });

  it("🔴 старая сборка прода без поля окна — честное предупреждение, а не тишина", async () => {
    const { окно: _, ...безОкна } = ОТВЕТ;
    const container = await нарисовать(безОкна);
    expect(
      container.textContent,
      "окна нет и страница об этом молчит — читатель решит, что видит сегодняшний день",
    ).toMatch(/Окно НЕ НАЗВАНО ручкой/);
  });

  it("🔴 разрез без оси «наши»: «неизвестно», а НЕ ноль", async () => {
    const container = await нарисовать();
    const раздел = container.querySelector('[data-razrez="byChannel"]')!;
    const строки = Array.from(раздел.querySelectorAll("tbody tr"));
    const безОси = строки.find((tr) => tr.textContent?.includes("без-оси"));
    expect(безОси, "строки без оси «наши» нет").toBeTruthy();
    const клетки = Array.from(безОси!.querySelectorAll("td")).map((td) => td.textContent?.trim());
    expect(клетки[1], "всего не показано").toBe("7");
    expect(клетки[2], "наши показаны нулём — пробы прочтут людьми").toBe("неизвестно");
    expect(клетки[3], "живые посчитаны при неизвестных наших").toBe("неизвестно");
    // Контроль: там, где ось ЕСТЬ, числа считаются как раньше.
    const сОсью = строки.find((tr) => tr.textContent?.includes("youtube"))!;
    const кл = Array.from(сОсью.querySelectorAll("td")).map((td) => td.textContent?.trim());
    expect([кл[1], кл[2], кл[3]]).toEqual(["20", "3", "17"]);
  });
});
