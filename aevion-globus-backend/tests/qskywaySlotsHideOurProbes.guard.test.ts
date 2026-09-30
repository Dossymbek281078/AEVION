import { describe, it, expect } from "vitest";
import { isSmokeSlot, isDemoSlot, countLiveSlots } from "../src/lib/slotOrigin";
import { просятПробы } from "../src/lib/probeRows";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Рынок слотов QSkyway не показывает посетителю наши прогоны.
 *
 * ЗАЧЕМ. Замер 30.09.2026 на живом проде: 41 бронь, из них 38 — смоук
 * (`smoke-route-persist-1`, `smoke-cap-route`, держатель `smoke-holder`).
 * 93 % «рыночной активности» сделали мы сами, и страница показывала это как
 * рынок. Пометки `test: true` у каждой записи (с 10.08) не хватило: страница
 * всё равно рисовала все строки.
 *
 * Прячем в РУЧКЕ, а не на странице — тот же порядок, что принят для Planet
 * 20.09: иначе следующий читатель (чужой клиент, сторож витрин, наш второй
 * экран) покажет их снова.
 *
 * Сторож держит три вещи, и вторая с третьей не менее важны первой:
 *   • проба не уходит посетителю;
 *   • настоящая бронь НЕ прячется (слишком жадный фильтр опустошит рынок, и
 *     заметить это будет некому);
 *   • скрытое названо числом и достаётся проверкам по `?includeProbes=1` —
 *     молча пропадать записи не должны.
 */

const РУЧКА = readFileSync(
  join(__dirname, "..", "src", "routes", "qskyway.ts"),
  "utf8",
);

type Бронь = { routeId?: string | null; holder?: string | null };

const ПРОБЫ: Бронь[] = [
  { routeId: "smoke-route-persist-1", holder: "smoke-holder" },
  { routeId: "smoke-cap-route", holder: "h0" },
  { routeId: "route-42", holder: "aevion demo" },
];
const НАСТОЯЩИЕ: Бронь[] = [
  { routeId: "route-42", holder: "Astana Air Taxi" },
  { routeId: "nyc-downtown-1", holder: "Blade" },
  // Контроль на жадность: слово «smoke» внутри осмысленного имени — не проба.
  { routeId: "smokehouse-delivery", holder: "Smokehouse Chef" },
];

describe("рынок слотов не выдаёт наши прогоны за рынок", () => {
  it.each(ПРОБЫ.map((s) => [String(s.routeId), s] as const))(
    "проба %s узнаётся",
    (_имя, бронь) => {
      expect(isSmokeSlot(бронь)).toBe(true);
    },
  );

  it.each(НАСТОЯЩИЕ.map((s) => [String(s.routeId), s] as const))(
    "настоящая бронь %s НЕ прячется",
    (_имя, бронь) => {
      expect(isSmokeSlot(бронь)).toBe(false);
    },
  );

  it("счёт живых броней считает то же самое", () => {
    expect(countLiveSlots([...ПРОБЫ, ...НАСТОЯЩИЕ])).toBe(НАСТОЯЩИЕ.length);
  });

  it("ручка фильтрует выдачу, а не только метит записи", () => {
    // Метка test: true стояла с 10.08 и не помогла — страница рисовала всё.
    // Проверка обновлена 30.09 вместе с самим фильтром: он перестал прятать
    // демо-бронь посетителя, и дословная строка изменилась. Держимся за ФАКТ
    // фильтрации выдачи, а не за её написание.
    expect(
      РУЧКА.includes("slots.filter((s) => !скрыть(s))"),
      "ручка снова отдаёт пробы посетителю — метки недостаточно",
    ).toBe(true);
  });

  it("скрытое названо числом и достаётся по ?includeProbes=1", () => {
    expect(РУЧКА).toContain("probesHidden");
    expect(РУЧКА).toContain("просятПробы(_req.query)");
    expect(просятПробы({ includeProbes: "1" })).toBe(true);
    expect(просятПробы({})).toBe(false);
  });
});

describe("бронь посетителя не исчезает с доски", () => {
  /*
   * Кнопка «Забронировать демо-слот» шлёт holder «AEVION demo» — по признаку
   * это проба. Если прятать её наравне с нашими прогонами, нажатие выглядит
   * успешным и не даёт видимого следа: классический молчаливый отказ. Тем
   * более что пустую доску мы сами подписали приглашением нажать эту кнопку.
   */
  const демо = { routeId: "astana-vp-3_4", holder: "AEVION demo" };
  const прогон = { routeId: "smoke-cap-route", holder: "h0" };

  it("демо-бронь человека узнаётся отдельно от нашего прогона", () => {
    expect(isDemoSlot(демо)).toBe(true);
    expect(isDemoSlot(прогон)).toBe(false);
  });

  it("обе остаются пробами по общему признаку — метка test не пропадает", () => {
    // Показывать демо-бронь можно, выдавать её за рынок — нет.
    expect(isSmokeSlot(демо)).toBe(true);
    expect(isSmokeSlot(прогон)).toBe(true);
    expect(countLiveSlots([демо, прогон])).toBe(0);
  });

  it("ручка прячет ТОЛЬКО наш шум", () => {
    expect(
      РУЧКА.includes("isSmokeSlot(s) && !isDemoSlot(s)"),
      "выдача снова прячет бронь посетителя — нажатие не даст видимого следа",
    ).toBe(true);
  });
});
