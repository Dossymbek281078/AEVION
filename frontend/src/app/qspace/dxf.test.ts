import { describe, expect, it } from "vitest";
import { parseDxf } from "./dxf";

/** Собирает ASCII-DXF из пар «код/значение». */
function dxf(pairs: Array<[number | string, string | number]>): string {
  return pairs.map(([c, v]) => `${c}\n${v}`).join("\n") + "\n";
}

function entitiesWrap(inner: Array<[number | string, string | number]>): Array<[number | string, string | number]> {
  return [
    [0, "SECTION"], [2, "ENTITIES"],
    ...inner,
    [0, "ENDSEC"], [0, "EOF"],
  ];
}

const LINE = (x1: number, y1: number, x2: number, y2: number, layer = "0"): Array<[number | string, string | number]> => [
  [0, "LINE"], [8, layer], [10, x1], [20, y1], [11, x2], [21, y2],
];

describe("parseDxf", () => {
  it("миллиметры по габариту: 8000×6000 мм → 8×6 м, координаты нормированы к нулю", () => {
    const text = dxf(entitiesWrap([
      ...LINE(1000, 1000, 9000, 1000),
      ...LINE(9000, 1000, 9000, 7000),
      ...LINE(9000, 7000, 1000, 7000),
      ...LINE(1000, 7000, 1000, 1000),
    ]));
    const r = parseDxf(text);
    expect(r.plan).not.toBeNull();
    expect(r.unitLabel).toContain("мм");
    const walls = r.plan!.walls;
    expect(walls.length).toBe(4);
    // первый отрезок: (1000,1000)→(9000,1000) минус минимум (1000,1000), в метрах
    expect(walls[0].x1).toBeCloseTo(0, 9);
    expect(walls[0].y1).toBeCloseTo(0, 9);
    expect(walls[0].x2).toBeCloseTo(8, 9);
    expect(walls[0].y2).toBeCloseTo(0, 9);
  });

  it("$INSUNITS=6 (метры) уважается даже при большом габарите-числе", () => {
    const text = dxf([
      [0, "SECTION"], [2, "HEADER"],
      [9, "$INSUNITS"], [70, 6],
      [0, "ENDSEC"],
      ...entitiesWrap([...LINE(0, 0, 8, 0), ...LINE(8, 0, 8, 6)]),
    ]);
    const r = parseDxf(text);
    expect(r.unitLabel).toContain("$INSUNITS");
    expect(r.plan!.walls[0].x2).toBeCloseTo(8, 9);
  });

  it("замкнутая LWPOLYLINE из 4 вершин даёт 4 стены", () => {
    const text = dxf(entitiesWrap([
      [0, "LWPOLYLINE"], [8, "WALLS"], [90, 4], [70, 1],
      [10, 0], [20, 0],
      [10, 8], [20, 0],
      [10, 8], [20, 6],
      [10, 0], [20, 6],
    ]));
    const r = parseDxf(text);
    expect(r.plan!.walls.length).toBe(4);
  });

  it("слой стен побеждает мусорные слои, и об этом сказано в warnings", () => {
    const text = dxf(entitiesWrap([
      ...LINE(0, 0, 8, 0, "A-WALL"),
      ...LINE(8, 0, 8, 6, "A-WALL"),
      ...LINE(8, 6, 0, 6, "A-WALL"),
      ...LINE(0, 6, 0, 0, "A-WALL"),
      ...LINE(0, -2, 8, -2, "DIMENSIONS"),
    ]));
    const r = parseDxf(text);
    expect(r.plan!.walls.length).toBe(4); // размерная линия не стала стеной
    expect(r.warnings.join(" ")).toContain("слой стен");
  });

  it("ARC пропускается с честным предупреждением", () => {
    const text = dxf(entitiesWrap([
      ...LINE(0, 0, 8, 0),
      ...LINE(8, 0, 8, 6),
      [0, "ARC"], [8, "0"], [10, 1], [20, 1], [40, 0.5],
    ]));
    const r = parseDxf(text);
    expect(r.warnings.join(" ")).toContain("ARC");
  });

  it("не-DXF даёт null-план и объяснение, а не пустой успех", () => {
    const r = parseDxf("просто текст, не чертёж");
    expect(r.plan).toBeNull();
    expect(r.warnings.length).toBeGreaterThanOrEqual(1);
    expect(r.warnings[0]).toContain("ENTITIES");
  });

  it("обрезка длинного чертежа называет число отброшенных", () => {
    const inner: Array<[number | string, string | number]> = [];
    for (let i = 0; i < 450; i++) inner.push(...LINE(0, i * 10, 1000, i * 10));
    const r = parseDxf(dxf(entitiesWrap(inner)));
    expect(r.truncated).toBe(50);
    expect(r.plan!.walls.length).toBe(400);
    expect(r.warnings.join(" ")).toContain("отброшено 50");
  });
});
