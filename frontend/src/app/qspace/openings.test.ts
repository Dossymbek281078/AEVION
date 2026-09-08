import { describe, expect, it } from "vitest";
import { demoPlan, type Plan } from "./planModel";
import { PRESETS, nearestWall, placeOpening, removeOpeningNear } from "./openings";

/** Голая коробка 8×6 без проёмов — как приходит из DXF/PDF/картинки. */
function boxPlan(): Plan {
  return {
    name: "коробка",
    walls: [
      { x1: 0, y1: 0, x2: 8, y2: 0, thickness: 0.3, height: 2.7 },
      { x1: 8, y1: 0, x2: 8, y2: 6, thickness: 0.3, height: 2.7 },
      { x1: 8, y1: 6, x2: 0, y2: 6, thickness: 0.3, height: 2.7 },
      { x1: 0, y1: 6, x2: 0, y2: 0, thickness: 0.3, height: 2.7 },
    ],
    openings: [],
    source: "dxf",
  };
}

describe("поиск стены под кликом", () => {
  const p = boxPlan();

  it("находит ту стену, рядом с которой кликнули, и место на ней", () => {
    const h = nearestWall(p, 3, 0.05);
    expect(h).not.toBeNull();
    expect(h!.wall).toBe(0);          // южная стена
    expect(h!.t).toBeCloseTo(3, 9);   // 3 м от её начала
    expect(h!.distance).toBeCloseTo(0.05, 9);
  });

  it("клик в пустоту — это НЕ «первая стена»", () => {
    expect(nearestWall(p, 4, 3)).toBeNull();      // середина комнаты
    expect(nearestWall(p, -5, -5)).toBeNull();    // вне плана
  });

  it("между двумя стенами выбирает ближайшую, а не первую по списку", () => {
    // угол (8,6): рядом стены 1, 2 и 3; ближе всего к точке (7.9, 5.0) стена 1
    const h = nearestWall(p, 7.9, 5.0);
    expect(h!.wall).toBe(1);
  });
});

describe("установка проёма", () => {
  it("дверь встаёт по центру клика и получает типовые размеры", () => {
    const p = boxPlan();
    const h = nearestWall(p, 3, 0.05)!;
    const r = placeOpening(p, h, "door");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = r.plan.openings[0];
    expect(o.wall).toBe(0);
    expect(o.width).toBe(PRESETS.door.width);
    expect(o.sill).toBe(0);
    // центр проёма — там, где кликнули
    expect(o.offset + o.width / 2).toBeCloseTo(3, 9);
  });

  it("окно получает подоконник, дверь — нет", () => {
    const p = boxPlan();
    const h = nearestWall(p, 5, 0.05)!;
    const w = placeOpening(p, h, "window");
    expect(w.ok && w.plan.openings[0].sill).toBe(PRESETS.window.sill);
    const d = placeOpening(p, h, "door");
    expect(d.ok && d.plan.openings[0].sill).toBe(0);
  });

  it("исходный план НЕ меняется — возвращается новый", () => {
    const p = boxPlan();
    const h = nearestWall(p, 3, 0.05)!;
    placeOpening(p, h, "door");
    expect(p.openings.length).toBe(0);
  });

  it("у края проём сдвигается внутрь, а не вылезает за стену", () => {
    const p = boxPlan();
    const h = nearestWall(p, 0.05, 0.05)!; // почти в углу
    const r = placeOpening(p, h, "door");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const o = r.plan.openings[0];
    expect(o.offset).toBeGreaterThanOrEqual(0.1);
    expect(o.offset + o.width).toBeLessThanOrEqual(8 - 0.1 + 1e-9);
  });

  it("в короткую стену проём не лезет — и отказ объяснён словами", () => {
    const short: Plan = {
      ...boxPlan(),
      walls: [{ x1: 0, y1: 0, x2: 0.8, y2: 0, thickness: 0.15, height: 2.7 }],
    };
    const h = nearestWall(short, 0.4, 0.05)!;
    const r = placeOpening(short, h, "door");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("0.80 м");
    expect(r.reason).toMatch(/не встанет/);
  });

  it("проём выше стены отклоняется", () => {
    const p = boxPlan();
    const h = nearestWall(p, 3, 0.05)!;
    const r = placeOpening(p, h, "window", { width: 1, height: 2.5, sill: 0.9 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("выше стены");
  });

  it("два проёма внахлёст не ставятся, а рядом — ставятся", () => {
    const p = boxPlan();
    const first = placeOpening(p, nearestWall(p, 3, 0.05)!, "door");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const overlap = placeOpening(first.plan, nearestWall(first.plan, 3.2, 0.05)!, "door");
    expect(overlap.ok).toBe(false);
    if (overlap.ok) return;
    expect(overlap.reason).toContain("уже есть проём");

    const beside = placeOpening(first.plan, nearestWall(first.plan, 5.5, 0.05)!, "window");
    expect(beside.ok).toBe(true);
    if (beside.ok) expect(beside.plan.openings.length).toBe(2);
  });
});

describe("удаление проёма", () => {
  it("убирает ближайший к клику на той же стене", () => {
    const p = demoPlan();
    const before = p.openings.length;
    // на южной стене (0) в демо-плане два окна: на 1.4 и 5.6
    const h = nearestWall(p, 2.1, 0.05)!;
    expect(h.wall).toBe(0);
    const r = removeOpeningNear(p, h);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.openings.length).toBe(before - 1);
    // ушло именно ближнее окно (центр 2.15), дальнее осталось
    const left = r.plan.openings.filter((o) => o.wall === 0);
    expect(left.length).toBe(1);
    expect(left[0].offset).toBe(5.6);
  });

  it("на стене без проёмов честно говорит, что убирать нечего", () => {
    const p = boxPlan();
    const r = removeOpeningNear(p, nearestWall(p, 3, 0.05)!);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("проёмов нет");
  });
});
