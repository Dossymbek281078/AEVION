import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { isGlassLayer } from "./wallLayer";
import { planFromPdfSegments, readPdfSegments } from "./pdf";
import { findRooms } from "./rooms";
import { estimatePlan } from "./estimate";
import type { Plan } from "./planModel";

const NL = String.fromCharCode(10);

/** PDF со слоями: объекты OCG + Properties, как у AutoCAD. Поток — по слоям. */
function pdfСоСлоями(потоки: Array<{ layer: string; ops: string }>): Uint8Array {
  const имена = [...new Set(потоки.map((p) => p.layer))];
  const objs: string[] = [];
  const props = имена.map((n, i) => `/oc${i + 1} ${10 + i} 0 R`).join(" ");
  const content = потоки
    .map((p) => `/OC /oc${имена.indexOf(p.layer) + 1} BDC ${p.ops} EMC`)
    .join(NL);
  objs.push(`1 0 obj << /Type /Page /Contents 2 0 R /Resources << /Properties << ${props} >> >> >> endobj`);
  objs.push(`2 0 obj << /Length ${content.length} >>`, "stream", content, "endstream", "endobj");
  имена.forEach((n, i) => {
    const hex = "FEFF" + [...n].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    objs.push(`${10 + i} 0 obj << /Type /OCG /Name <${hex}> >> endobj`);
  });
  return new TextEncoder().encode(["%PDF-1.5", ...objs, "%%EOF"].join(NL));
}

describe("слой витражей", () => {
  it("узнаётся по словам витраж/окно/window/glass, импосты и штриховка — нет", () => {
    expect(isGlassLayer("Панели витража")).toBe(true);
    expect(isGlassLayer("A-GLAZ")).toBe(true);
    expect(isGlassLayer("Окна")).toBe(true);
    expect(isGlassLayer("Импосты витража")).toBe(false);
    expect(isGlassLayer("Стены")).toBe(false);
    expect(isGlassLayer("A-WALL-PATT")).toBe(false);
  });
});

describe("витражи замыкают контур помещения", () => {
  // коробка 400×300 пт: три стороны на слое «Стены», четвёртая (справа) — на «Панели витража»
  const стены = "0 0 m 400 0 l S 0 0 m 0 300 l S 0 300 m 400 300 l S 100 0 m 100 300 l S";
  const витраж = "400 0 m 400 300 l S";

  it("со стеклянной стороной комнаты есть, стекло — стены с glass: true и без отделки в смете", async () => {
    const src = await readPdfSegments(pdfСоСлоями([{ layer: "Стены", ops: стены }, { layer: "Панели витража", ops: витраж }]));
    expect(src.glassSegments?.length).toBe(1);
    expect(src.warnings.some((w) => w.includes("стеклянные стены"))).toBe(true);
    expect(src.extentPt).toBeCloseTo(400, 3); // витраж на контуре входит в габарит
    const r = planFromPdfSegments(src, 8);
    expect(r.plan).not.toBeNull();
    const стекло = r.plan!.walls.filter((w) => w.glass);
    expect(стекло.length).toBe(1);
    expect(стекло[0].thickness).toBeCloseTo(0.06, 6);
    const комнаты = findRooms(r.plan!);
    expect(комнаты.rooms.length).toBe(2);
    expect(комнаты.totalArea).toBeGreaterThan(20);
    // смета по осям стен: стекло не красят
    const est = estimatePlan(r.plan!, { runs: [], points: [] } as never, { cold: [], hot: [], drain: [] } as never, 0);
    const безСтекла = r.plan!.walls.filter((w) => !w.glass).reduce((s, w) => s + Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * w.height, 0);
    expect(est.wallArea).toBeCloseTo(безСтекла, 3);
  });

  it("контроль: без слоя витража правая часть открыта — комната одна (левая), а не две", async () => {
    const src = await readPdfSegments(pdfСоСлоями([{ layer: "Стены", ops: стены }]));
    expect(src.glassSegments ?? []).toEqual([]);
    const r = planFromPdfSegments(src, 8);
    expect(findRooms(r.plan!).rooms.length).toBe(1);
  });

  it("витраж из двух панелей с зазором 0.3 м под импост всё равно замыкает комнату", async () => {
    // 8 м на 400 пт: зазор 15 пт = 0.3 м — меньше двери, для глухих стен такая щель НЕ закрывается
    const панели = "400 0 m 400 130 l S 400 145 m 400 300 l S";
    const соСтеклом = await readPdfSegments(pdfСоСлоями([{ layer: "Стены", ops: стены }, { layer: "Панели витража", ops: панели }]));
    expect(findRooms(planFromPdfSegments(соСтеклом, 8).plan!).rooms.length).toBe(2);
    // контроль: те же две линии как глухие стены — щель 0.3 м остаётся открытой, комната одна
    const какСтены = await readPdfSegments(pdfСоСлоями([{ layer: "Стены", ops: `${стены} ${панели}` }]));
    expect(findRooms(planFromPdfSegments(какСтены, 8).plan!).rooms.length).toBe(1);
  });

  it("периметр комнаты не считает стеклянную сторону — краски на неё не нужно", async () => {
    const src = await readPdfSegments(pdfСоСлоями([{ layer: "Стены", ops: стены }, { layer: "Панели витража", ops: витраж }]));
    const r = planFromPdfSegments(src, 8);
    const комнаты = findRooms(r.plan!);
    // правая комната 6×6 м (300 пт при 8 м на 400 пт): три глухие стены ≈ 18 м, витраж 6 м не в счёт
    const правая = комнаты.rooms.find((x) => x.cx > 4)!;
    expect(правая.perimeter).toBeLessThan(21);
    expect(правая.perimeter).toBeGreaterThan(15);
  });
});

const ПАПКА = process.env.QSPACE_EXAMPLES ?? "C:/Users/user/OneDrive/Desktop/АЕВИОН/21-QSpace-3D-модельер/примеры";
const LAVIE = `${ПАПКА}/LA VIE.pdf`;

describe.skipIf(!existsSync(LAVIE))("LA VIE.pdf: витражный фасад замыкает открытую зону", () => {
  it("площадь помещений заметно больше прежних 54 м² — открытая зона стала комнатой", async () => {
    const src = await readPdfSegments(new Uint8Array(readFileSync(LAVIE)));
    expect(src.glassSegments!.length).toBeGreaterThan(30);
    const p = planFromPdfSegments(src, (src.extentPt * 42.59) / 1000);
    const комнаты = findRooms(p.plan!);
    expect(комнаты.totalArea).toBeGreaterThan(90);
    expect(Math.max(...комнаты.rooms.map((r) => r.area))).toBeGreaterThan(40);
  }, 60_000);
});

export type { Plan };
