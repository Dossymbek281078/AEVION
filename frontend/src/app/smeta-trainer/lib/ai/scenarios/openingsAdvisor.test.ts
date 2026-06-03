import { describe, expect, it } from "vitest";
import {
  analyzeOpenings,
  explainOpeningsDeterministic,
  buildOpeningsAIPrompt,
} from "./openingsAdvisor";
import type { RoomGeometry } from "../../types";

// Класс 7.5×6.5×3.2, 2 окна 1.4×1.6, 1 дверь 0.9×2.1
const ROOM: RoomGeometry = {
  kind: "room",
  length: 7.5,
  width: 6.5,
  height: 3.2,
  openings: [
    { kind: "window", width: 1.4, height: 1.6, count: 2 },
    { kind: "door", width: 0.9, height: 2.1, count: 1 },
  ],
};

describe("analyzeOpenings", () => {
  const a = analyzeOpenings(ROOM);

  it("периметр и брутто", () => {
    expect(a.perimeter).toBe(28); // 2×(7.5+6.5)
    expect(a.gross).toBe(89.6); // 28×3.2
  });

  it("детализирует каждый проём с площадью", () => {
    expect(a.openings).toHaveLength(2);
    const win = a.openings.find((o) => o.kind === "window")!;
    expect(win.area).toBeCloseTo(1.4 * 1.6 * 2, 2); // 4.48
    expect(win.label).toContain("×2");
    const door = a.openings.find((o) => o.kind === "door")!;
    expect(door.area).toBeCloseTo(0.9 * 2.1, 2); // 1.89
  });

  it("итог проёмов и нетто", () => {
    expect(a.openingsTotal).toBeCloseTo(4.48 + 1.89, 2); // 6.37
    expect(a.net).toBeCloseTo(89.6 - 6.37, 2); // 83.23
  });

  it("overstatePct = (gross−net)/net", () => {
    expect(a.overstatePct).toBeCloseTo(((89.6 - 83.23) / 83.23) * 100, 1);
  });
});

describe("explainOpeningsDeterministic", () => {
  const a = analyzeOpenings(ROOM);

  it("содержит ключевые числа разбора", () => {
    const txt = explainOpeningsDeterministic(a);
    expect(txt).toContain("89.6");
    expect(txt).toContain("83.23");
    expect(txt).toContain("СН РК 8.02-01");
  });

  it("распознаёт брутто во введённом объёме и предупреждает", () => {
    const txt = explainOpeningsDeterministic(a, 0.896); // = 89.6 м² (брутто)
    expect(txt).toContain("брутто");
    expect(txt).toContain("Замените");
  });

  it("подтверждает корректный нетто-объём", () => {
    const txt = explainOpeningsDeterministic(a, 0.8323); // = 83.23 м² (нетто)
    expect(txt).toContain("учтены");
  });
});

describe("buildOpeningsAIPrompt", () => {
  const a = analyzeOpenings(ROOM);

  it("вшивает точные числа в extraSystem", () => {
    const { extraSystem } = buildOpeningsAIPrompt(a);
    expect(extraSystem).toContain("83.23");
    expect(extraSystem).toContain("СН РК 8.02-01");
    expect(extraSystem).toContain("Нетто");
  });

  it("включает введённый объём студента, если задан", () => {
    const { extraSystem } = buildOpeningsAIPrompt(a, { enteredVolume: 0.896 });
    expect(extraSystem).toContain("89.6"); // = 0.896×100
  });

  it("вопрос упоминает позицию, если передана", () => {
    const { question } = buildOpeningsAIPrompt(a, { positionTitle: "Окраска стен" });
    expect(question).toContain("Окраска стен");
  });
});
