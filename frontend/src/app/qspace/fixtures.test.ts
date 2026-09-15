import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { блокиИзЛиний, классифицироватьБлок, fixturesFromSegments, isFurnitureLayer } from "./fixtures";
import { readPdfSegments, planFromPdfSegments } from "./pdf";
import { findRooms } from "./rooms";
import { guessRoomTypes } from "./roomTypes";
import { CATALOG } from "./furniture";
import { масштабПоРазмерам, словаИзТекста } from "./dimensionScale";
import { назначенияПоПодписям, подписиИзТекста } from "./roomLabels";

const прямоугольник = (x: number, y: number, w: number, d: number) => [
  { x1: x, y1: y, x2: x + w, y2: y }, { x1: x + w, y1: y, x2: x + w, y2: y + d },
  { x1: x + w, y1: y + d, x2: x, y2: y + d }, { x1: x, y1: y + d, x2: x, y2: y },
];

describe("блоки из линий", () => {
  it("два замкнутых прямоугольника далеко друг от друга — два блока по 4 линии", () => {
    const b = блокиИзЛиний([...прямоугольник(0, 0, 0.36, 0.65), ...прямоугольник(3, 3, 1.7, 0.75)]);
    expect(b.map((x) => x.n)).toEqual([4, 4]);
    expect(b[1].x1 - b[1].x0).toBeCloseTo(1.7, 5);
  });
  it("концы в 3 см друг от друга — один блок; в 10 см — разные", () => {
    expect(блокиИзЛиний([{ x1: 0, y1: 0, x2: 1, y2: 0 }, { x1: 1.03, y1: 0, x2: 1.03, y2: 1 }]).length).toBe(1);
    expect(блокиИзЛиний([{ x1: 0, y1: 0, x2: 1, y2: 0 }, { x1: 1.10, y1: 0, x2: 1.10, y2: 1 }]).length).toBe(2);
  });
});

describe("классификация по габариту и комнате", () => {
  it("санузел: унитаз, ванна, душ, раковина; кухня: гарнитур; спальня: кровать; чужое — null", () => {
    expect(классифицироватьБлок(0.36, 0.65, "bath")).toBe("toilet");
    expect(классифицироватьБлок(1.7, 0.75, "bath")).toBe("bathtub");
    expect(классифицироватьБлок(0.9, 0.9, "bath")).toBe("shower");
    expect(классифицироватьБлок(0.5, 0.42, "bath")).toBe("sink");
    expect(классифицироватьБлок(2.8, 0.6, "kitchen")).toBe("kitchen");
    expect(классифицироватьБлок(1.6, 2.0, "bedroom")).toBe("bed");
    expect(классифицироватьБлок(2.0, 0.9, "bedroom")).toBe("bed-single");
    expect(классифицироватьБлок(1.6, 2.0, "bath")).toBeNull();
    expect(классифицироватьБлок(0.1, 0.1, "living")).toBeNull();
  });
  it("слои мебели: Мебель, Меbель (смешанная), a-tefriş, Sanitary; Стены и dim — нет", () => {
    for (const l of ["Мебель", "Меbель", "a-tefriş", "Sanitary", "FURNITURE"]) expect(isFurnitureLayer(l), l).toBe(true);
    for (const l of ["Стены", "dim", "Оформление", "Двери"]) expect(isFurnitureLayer(l), l).toBe(false);
  });
});

describe("расстановка с чертежа", () => {
  it("унитаз в санузле ставится с поворотом по длинной стороне, стол в санузле — в unknown", () => {
    const segs = [...прямоугольник(1, 1, 0.65, 0.36), ...прямоугольник(3, 1, 1.2, 0.8)];
    // блок — от 6 линий: контур из 4 плюс две диагонали из углов
    const r = fixturesFromSegments([...segs, { x1: 1, y1: 1, x2: 1.65, y2: 1.36 }, { x1: 1, y1: 1.36, x2: 1.65, y2: 1 }, { x1: 3, y1: 1, x2: 4.2, y2: 1.8 }, { x1: 3, y1: 1.8, x2: 4.2, y2: 1 }],
      () => 1, { 1: "bath" }, (id) => CATALOG.find((c) => c.id === id)?.size);
    expect(r.items.map((i) => [i.catalogId, i.rotY, i.room])).toEqual([["toilet", Math.PI / 2, 1]]);
    expect(r.items[0].x).toBeCloseTo(1.325, 6);
    expect(r.items[0].z).toBeCloseTo(1.18, 6);
    expect(r.unknown.length).toBe(1);
  });
});

const ПАПКА = process.env.QSPACE_EXAMPLES ?? "C:/Users/user/OneDrive/Desktop/АЕВИОН/21-QSpace-3D-модельер/примеры";
const LAVIE = `${ПАПКА}/LA VIE.pdf`;

describe.skipIf(!existsSync(LAVIE))("LA VIE.pdf: сантехника и мебель с чертежа", () => {
  it("находятся унитазы, ванна или душ, кровати и кухонный гарнитур", async () => {
    const bytes = new Uint8Array(readFileSync(LAVIE));
    const src = await readPdfSegments(bytes);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true }).promise;
    const tc = await (await doc.getPage(1)).getTextContent();
    await doc.destroy();
    const items = tc.items.flatMap((it) => ("str" in it ? [{ str: it.str, transform: it.transform, width: it.width }] : []));
    const масштаб = масштабПоРазмерам(словаИзТекста(items));
    expect(масштаб).not.toBeNull();
    const extentM = Math.round((src.extentPt * (масштаб as { mmPerPt: number }).mmPerPt) / 10) / 100;
    const r = planFromPdfSegments(src, extentM, "размеры");
    expect(r.plan).not.toBeNull();
    const rooms = findRooms(r.plan!);
    const o = r.originPt!;
    const { types } = назначенияПоПодписям(подписиИзТекста(items), o, r.metersPerPt, rooms.roomAt);
    const все = { ...guessRoomTypes(rooms.rooms), ...types };
    const segs = (src.otherSegments ?? []).map((s) => ({
      x1: (s.x1 - o.x) * r.metersPerPt, y1: (s.y1 - o.y) * r.metersPerPt, x2: (s.x2 - o.x) * r.metersPerPt, y2: (s.y2 - o.y) * r.metersPerPt, layer: s.layer,
    }));
    const f = fixturesFromSegments(segs, rooms.roomAt, все, (id) => CATALOG.find((c) => c.id === id)?.size);
    const ids = f.items.map((i) => i.catalogId);
    const счёт = ids.reduce<Record<string, number>>((m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }), {});
    const строка = `блоков ${f.blocks}, узнано ${f.items.length}: ${JSON.stringify(счёт)}`;
    expect(ids.filter((i) => i === "toilet").length, строка).toBeGreaterThanOrEqual(1);
    expect(ids.some((i) => i === "bathtub" || i === "shower"), строка).toBe(true);
    expect(ids.filter((i) => i === "bed" || i === "bed-single").length, строка).toBeGreaterThanOrEqual(2);
    expect(ids.includes("kitchen"), строка).toBe(true);
  }, 90_000);
});
