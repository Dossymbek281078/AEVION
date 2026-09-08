import { describe, expect, it } from "vitest";
import { humidityAdvice, ventilationPlan, type RoomKind } from "./ventilation";

const rooms = [
  { index: 1, area: 20 },
  { index: 2, area: 12 },
  { index: 3, area: 4 },
];

describe("вентиляция", () => {
  it("жилой комнате расход считается от площади, а не берётся из воздуха", () => {
    const r = ventilationPlan([{ index: 1, area: 20 }], { 1: "living" });
    expect(r.rooms[0].flow).toBe(60); // 20 м² × 3 м³/ч
    const bigger = ventilationPlan([{ index: 1, area: 30 }], { 1: "living" });
    expect(bigger.rooms[0].flow).toBe(90);
  });

  it("у кухни и санузла расход фиксированный — он не про площадь", () => {
    const r = ventilationPlan(
      [{ index: 1, area: 8 }, { index: 2, area: 20 }],
      { 1: "kitchen", 2: "kitchen" },
    );
    // площади разные, расход один и тот же: там важен источник, а не объём
    expect(r.rooms[0].flow).toBe(60);
    expect(r.rooms[1].flow).toBe(60);
  });

  it("санузел и туалет различаются — это разные нормы", () => {
    const r = ventilationPlan(rooms, { 1: "bath", 2: "toilet", 3: "corridor" });
    expect(r.rooms[0].flow).toBe(50);
    expect(r.rooms[1].flow).toBe(25);
    expect(r.rooms[2].flow).toBe(0);
  });

  it("влажным помещениям назначается вытяжка, жилым — нет", () => {
    const r = ventilationPlan(rooms, { 1: "living", 2: "kitchen", 3: "bath" });
    expect(r.rooms[0].needsFan).toBe(false);
    expect(r.rooms[1].needsFan).toBe(true);
    expect(r.rooms[2].needsFan).toBe(true);
  });

  it("итог — сумма расходов, и он растёт вместе с площадями", () => {
    const small = ventilationPlan([{ index: 1, area: 10 }], { 1: "living" }).totalFlow;
    const big = ventilationPlan([{ index: 1, area: 30 }], { 1: "living" }).totalFlow;
    expect(big).toBeGreaterThan(small);
    const mixed = ventilationPlan(rooms, { 1: "living", 2: "kitchen", 3: "bath" });
    expect(mixed.totalFlow).toBe(20 * 3 + 60 + 50);
  });

  it("без назначения помещения считаются жилыми — и об этом сказано", () => {
    const r = ventilationPlan(rooms);
    expect(r.rooms.every((x) => x.kind === "living")).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/не отмечено как кухня или санузел/);
  });

  it("объяснение притока и вытяжки даётся всегда — это главная ошибка ремонта", () => {
    const r = ventilationPlan(rooms, { 1: "living", 2: "kitchen", 3: "bath" });
    expect(r.notes.join(" ")).toMatch(/должны сходиться/);
    expect(r.notes.join(" ")).toMatch(/\d+ м³\/ч/);
  });

  it("каждому помещению сказано, ЧЕМ обеспечивается расход", () => {
    const r = ventilationPlan(rooms, { 1: "living", 2: "kitchen", 3: "bath" });
    for (const x of r.rooms) {
      expect(x.how.length, `помещение ${x.index} без объяснения`).toBeGreaterThan(10);
    }
    expect(r.rooms[0].how).toMatch(/клапан/);
    expect(r.rooms[1].how).toMatch(/вытяжка над плитой/);
  });

  it("пустой список не падает и даёт нули", () => {
    const r = ventilationPlan([]);
    expect(r.rooms).toEqual([]);
    expect(r.totalFlow).toBe(0);
  });
});

describe("влажность", () => {
  const kinds: Record<number, RoomKind> = { 1: "living", 2: "kitchen", 3: "bath" };

  it("санузел без окна и без вытяжки назван плесенью прямо", () => {
    const plan = ventilationPlan(rooms, kinds);
    // подменяем вытяжку на отсутствующую — так бывает, если человек её не ставит
    const noFan = plan.rooms.map((r) => (r.index === 3 ? { ...r, needsFan: false } : r));
    const advice = humidityAdvice(noFan, [3]);
    expect(advice.length).toBe(1);
    expect(advice[0]).toMatch(/плесень/);
  });

  it("санузел без окна, но с вытяжкой — совет про задержку, а не тревога", () => {
    const plan = ventilationPlan(rooms, kinds);
    const advice = humidityAdvice(plan.rooms, [3]);
    expect(advice.length).toBe(1);
    expect(advice[0]).toMatch(/задержкой/);
    expect(advice[0]).not.toMatch(/плесень/);
  });

  it("санузел С окном советов не требует — сторож не шумит", () => {
    const plan = ventilationPlan(rooms, kinds);
    expect(humidityAdvice(plan.rooms, [])).toEqual([]);
  });

  it("жилая комната без окна в советы по влажности не попадает", () => {
    const plan = ventilationPlan(rooms, kinds);
    expect(humidityAdvice(plan.rooms, [1])).toEqual([]);
  });
});
