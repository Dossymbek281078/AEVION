import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { блокиИзЛиний, классифицироватьБлок, fixturesFromSegments, isFurnitureLayer, applianceFromLabel, appliancesFromLabels, furnitureFromLabel } from "./fixtures";
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
    const подписиМ = подписиИзТекста(items).map((l) => ({ text: l.text, x: (l.x - o.x) * r.metersPerPt, y: (l.y - o.y) * r.metersPerPt }));
    const f = fixturesFromSegments(segs, rooms.roomAt, все, (id) => CATALOG.find((c) => c.id === id)?.size, подписиМ);
    const ids = f.items.map((i) => i.catalogId);
    const счёт = ids.reduce<Record<string, number>>((m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }), {});
    const строка = `блоков ${f.blocks}, узнано ${f.items.length}: ${JSON.stringify(счёт)}`;
    expect(ids.filter((i) => i === "toilet").length, строка).toBeGreaterThanOrEqual(1);
    expect(ids.some((i) => i === "bathtub" || i === "shower"), строка).toBe(true);
    expect(ids.filter((i) => i === "bed" || i === "bed-single").length, строка).toBeGreaterThanOrEqual(2);
    expect(ids.includes("kitchen"), строка).toBe(true);
    // дублей одного предмета от вложенных блоков быть не должно: холодильник и гарнитур по одному
    expect(ids.filter((i) => i === "fridge").length, строка).toBeLessThanOrEqual(1);
    // («учебный стол» в LA VIE стоит вне найденных комнат, а блоки 1.46×0.56 в детской — секции
    // гардеробной с подписью «Гардероб» между ними: «шкаф» по габариту верен — desk здесь не ждём)
    // мастер-санузел — слипшаяся группа 2×2.7: после разрезки в ней душ или тумба с раковиной
    expect(ids.some((i) => i === "shower" || i === "vanity"), строка).toBe(true);
    // техника по подписям: «дух свч» на кухне LA VIE → плита
    const техника = appliancesFromLabels(подписиИзТекста(items), o, r.metersPerPt, rooms.roomAt, f.items);
    expect(техника.some((t) => t.catalogId === "stove"), JSON.stringify(техника)).toBe(true);
  }, 90_000);
});

describe("дубли и техника по подписям", () => {
  it("вложенный блок того же предмета не даёт «холодильник ×2»: крупный первым, малый внутри — пропущен", () => {
    const внешний = [...прямоугольник(1, 1, 0.66, 0.66), { x1: 1, y1: 1, x2: 1.66, y2: 1.66 }, { x1: 1, y1: 1.66, x2: 1.66, y2: 1 }];
    const внутренний = [...прямоугольник(1.04, 1.04, 0.58, 0.58), { x1: 1.04, y1: 1.04, x2: 1.62, y2: 1.62 }, { x1: 1.04, y1: 1.62, x2: 1.62, y2: 1.04 }];
    const r = fixturesFromSegments([...внутренний, ...внешний], () => 1, { 1: "kitchen" }, (id) => CATALOG.find((c) => c.id === id)?.size);
    expect(r.items.map((i) => i.catalogId)).toEqual(["fridge"]);
  });
  it("подписи: «дух свч» → плита, «п/м» → посудомойка, «с/м» → стиральная, «суш/м» и «термомикс» — ничего", () => {
    expect(applianceFromLabel("дух свч")).toBe("stove");
    expect(applianceFromLabel("п/м")).toBe("dishwasher");
    expect(applianceFromLabel("с/м")).toBe("washer");
    expect(applianceFromLabel("суш/м")).toBeNull();
    expect(applianceFromLabel("термомикс и тд.")).toBeNull();
  });
  it("техника ставится в точку подписи в метрах; рядом с уже узнанным блоком того же предмета — пропускается", () => {
    const labels = [{ text: "п/м", x: 20, y: 30 }, { text: "дух свч", x: 50, y: 30 }];
    const уже = [{ catalogId: "stove", x: 4.2, z: 2, rotY: 0, room: 1 }];
    const r = appliancesFromLabels(labels, { x: 10, y: 10 }, 0.1, () => 1, уже);
    expect(r).toEqual([{ catalogId: "dishwasher", x: 1, z: 2, rotY: 0, room: 1 }]);
  });
});

describe("подпись внутри блока и разрезка слипшихся групп", () => {
  const sizeOf = (id: string) => CATALOG.find((c) => c.id === id)?.size;
  const блок = (x: number, y: number, w: number, d: number) => [...прямоугольник(x, y, w, d), { x1: x, y1: y, x2: x + w, y2: y + d }, { x1: x, y1: y + d, x2: x + w, y2: y }];
  it("«учебный стол» внутри блока 1.46×0.56 в спальне — стол, а не шкаф; «стол» в кухне — обеденный", () => {
    expect(furnitureFromLabel("учебный стол", "bedroom")).toBe("desk");
    expect(furnitureFromLabel("стол", "kitchen")).toBe("dining");
    expect(furnitureFromLabel("полки", "bedroom")).toBe("shelf");
    const r = fixturesFromSegments(блок(1, 1, 1.46, 0.56), () => 1, { 1: "bedroom" }, sizeOf, [{ text: "учебный стол", x: 1.7, y: 1.3 }]);
    expect(r.items.map((i) => i.catalogId)).toEqual(["desk"]);
    const без = fixturesFromSegments(блок(1, 1, 1.46, 0.56), () => 1, { 1: "bedroom" }, sizeOf);
    expect(без.items.map((i) => i.catalogId)).toEqual(["wardrobe"]);
  });
  it("душ и унитаз, соединённые линией с концами в 3 см, — один блок (не узнан) → разрезка даёт оба", () => {
    const душ = блок(1, 1, 0.9, 0.9);
    const унитаз = блок(2.2, 2.2, 0.36, 0.65);
    const мостик = [{ x1: 1.93, y1: 1.93, x2: 2.17, y2: 2.17 }]; // при 4 см склеит, при 2 см — нет
    const r = fixturesFromSegments([...душ, ...унитаз, ...мостик], () => 1, { 1: "bath" }, sizeOf);
    expect(r.items.map((i) => i.catalogId).sort()).toEqual(["shower", "toilet"]);
  });
});
