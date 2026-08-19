import { describe, test, expect } from "vitest";
import {
  computeFan,
  fanTotalUsd,
  capTotalDiscount,
  stepFor,
  MODULE_VOLUME_LADDER,
  SEAT_VOLUME_LADDER,
  COMMITMENT_LADDER,
  MAX_TOTAL_DISCOUNT_RATIO,
} from "../src/data/discounts";

/**
 * Веерные скидки складываются, поэтому главный риск здесь — не «скидка не
 * сработала», а «скидок оказалось больше, чем мы думали». Каждая ступень по
 * отдельности выглядит скромно, а вместе с промо-кодом они способны отдать
 * товар почти даром — и заметить это по одной цифре итога невозможно.
 */

describe("ступени веера", () => {
  test("берётся ПОСЛЕДНЯЯ подходящая ступень, а не первая", () => {
    // 8 модулей подходят под все три порога — должна сработать самая выгодная.
    expect(stepFor(MODULE_VOLUME_LADDER, 8)?.percent).toBe(0.20);
    expect(stepFor(MODULE_VOLUME_LADDER, 5)?.percent).toBe(0.15);
    expect(stepFor(MODULE_VOLUME_LADDER, 3)?.percent).toBe(0.10);
  });

  test("ниже первого порога скидки нет вовсе", () => {
    expect(stepFor(MODULE_VOLUME_LADDER, 2)).toBeNull();
    expect(stepFor(SEAT_VOLUME_LADDER, 1)).toBeNull();
    expect(stepFor(COMMITMENT_LADDER, 12)).toBeNull();
  });

  test("лестницы возрастают — иначе больший объём давал бы меньшую скидку", () => {
    for (const ladder of [MODULE_VOLUME_LADDER, SEAT_VOLUME_LADDER, COMMITMENT_LADDER]) {
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i].from).toBeGreaterThan(ladder[i - 1].from);
        expect(ladder[i].percent).toBeGreaterThan(ladder[i - 1].percent);
      }
    }
  });
});

describe("начисление веера", () => {
  test("скидка за модули считается ТОЛЬКО от суммы модулей", () => {
    const fans = computeFan({
      modulesUsd: 100, moduleCount: 5,
      seatsUsd: 50, seatCount: 1,
      subtotalUsd: 150,
    });

    const mod = fans.find((f) => f.id === "modules_volume")!;
    expect(mod.baseUsd).toBe(100);      // не 150
    expect(mod.amountUsd).toBe(15);     // 15% от модулей
  });

  test("скидка за места не удешевляет модули", () => {
    const fans = computeFan({
      modulesUsd: 100, moduleCount: 1,
      seatsUsd: 60, seatCount: 10,
      subtotalUsd: 160,
    });

    expect(fans.map((f) => f.id)).toEqual(["seats_volume"]);
    expect(fans[0].baseUsd).toBe(60);
    expect(fans[0].amountUsd).toBe(12);
  });

  test("ступени складываются и каждая видна отдельной строкой", () => {
    const fans = computeFan({
      modulesUsd: 100, moduleCount: 8,
      seatsUsd: 100, seatCount: 25,
      commitmentMonths: 36,
      subtotalUsd: 200,
    });

    expect(fans.map((f) => f.id).sort()).toEqual(["commitment", "modules_volume", "seats_volume"]);
    // 20 + 30 + 20 = 70
    expect(fanTotalUsd(fans)).toBe(70);
    for (const f of fans) expect(f.label.length).toBeGreaterThan(0);
  });

  test("нулевые суммы не создают пустых строк", () => {
    const fans = computeFan({
      modulesUsd: 0, moduleCount: 9,
      seatsUsd: 0, seatCount: 30,
      subtotalUsd: 0,
    });

    expect(fans).toEqual([]);
  });
});

describe("потолок на сумму скидок", () => {
  test("веер вместе с промо не может отдать товар даром", () => {
    const subtotal = 200;
    const everything = 70 + 80; // веер + промо-код
    const { applied, cappedBy } = capTotalDiscount(subtotal, everything);

    expect(applied).toBe(subtotal * MAX_TOTAL_DISCOUNT_RATIO); // 100
    expect(cappedBy).toBe(50);
  });

  test("ниже потолка ничего не срезается", () => {
    const { applied, cappedBy } = capTotalDiscount(200, 30);

    expect(applied).toBe(30);
    expect(cappedBy).toBe(0);
  });

  test("контроль: потолок действительно ограничивает, а не пропускает всё", () => {
    // Иначе первый случай прошёл бы и при отсутствии потолка.
    const { applied } = capTotalDiscount(100, 999);
    expect(applied).toBeLessThan(999);
    expect(applied).toBe(50);
  });
});
