import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { planFromPdfSegments, readPdfSegments, type PdfSegments } from "./pdf";
import { isWallLayer } from "./wallLayer";

/**
 * Слои в PDF: стены берутся со своего слоя, а не угадываются.
 *
 * Найдено 14.09.2026 на первом НАСТОЯЩЕМ файле основателя — план квартиры
 * LA VIE из AutoCAD (planirovka.kz). 27 355 линий на странице; разбор без
 * слоёв брал 400 самых длинных и строил 244 «стены» из размерных цепочек,
 * мебели и узоров пола. При этом в PDF 17 слоёв, и стены лежат отдельно:
 * «Стены» — 1628 линий, охват ровно по контуру квартиры.
 *
 * Контрольные PDF собираются строкой, как в pdf.test.ts: слои — объекты /OCG,
 * таблица /Properties связывает метку в потоке с объектом.
 */
const NL = String.fromCharCode(10);

/** Имя слоя в записи UTF-16BE, как её пишет AutoCAD для кириллицы. */
function utf16(имя: string): string {
  let hex = "FEFF";
  for (let i = 0; i < имя.length; i++) hex += имя.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return "<" + hex + ">";
}

/** PDF со слоями: `слои` — пары [метка в потоке, запись имени]. */
function слоистый(поток: string, слои: Array<[string, string]>): Uint8Array {
  let t = "%PDF-1.7" + NL;
  let n = 10;
  let props = "";
  for (const [метка, запись] of слои) {
    t += `${n} 0 obj${NL}<< /Type /OCG /Name ${запись} >>${NL}endobj${NL}`;
    props += ` /${метка} ${n} 0 R`;
    n++;
  }
  t += `2 0 obj${NL}<< /Type /Page /Resources << /Properties <<${props} >> >> /Contents 3 0 R >>${NL}endobj${NL}`;
  t += `3 0 obj${NL}<< /Length ${поток.length} >>${NL}stream${NL}${поток}${NL}endstream${NL}endobj${NL}%%EOF${NL}`;
  return new TextEncoder().encode(t);
}

const СТЕНЫ = "/OC /oc1 BDC 0 0 m 400 0 l 400 300 l 0 300 l h S EMC";
const МЕБЕЛЬ = "/OC /oc2 BDC 50 50 m 150 50 l S 60 60 m 60 160 l S EMC";
const ШТРИХ = "/OC /oc3 BDC 10 10 m 20 20 l S 12 10 m 22 20 l S 14 10 m 24 20 l S 16 10 m 26 20 l S EMC";
const РАЗМЕР = "/OC /oc4 BDC 0 -40 m 400 -40 l S EMC";
const ВСЕ_СЛОИ: Array<[string, string]> = [
  ["oc1", utf16("Стены")], ["oc2", utf16("Мебель")], ["oc3", "(A-WALL-PATT)"], ["oc4", "(dim)"],
];

describe("правило слоя стен — одно на DXF и PDF", () => {
  it("стены — да, штриховка стен, мебель и размеры — нет", () => {
    expect(isWallLayer("Стены")).toBe(true);
    expect(isWallLayer("Стены внутренние")).toBe(true);
    expect(isWallLayer("A-WALL")).toBe(true);
    expect(isWallLayer("A-WALL-PATT"), "штриховка внутри стены стала бы косыми перегородками").toBe(false);
    expect(isWallLayer("Мебель")).toBe(false);
    expect(isWallLayer("dim")).toBe(false);
  });

  it("разбор DXF зовёт общее правило, а не своё", () => {
    const dxf = readFileSync(`${__dirname}/dxf.ts`, "utf8");
    expect(dxf.includes("isWallLayer(s.layer)"), "DXF завёл собственное правило — разойдётся с PDF").toBe(true);
  });
});

describe("readPdfSegments — слой стен", () => {
  it("слой стен найден: взяты только его линии, остальные слои названы не попавшими", async () => {
    const r = await readPdfSegments(слоистый([СТЕНЫ, МЕБЕЛЬ, ШТРИХ, РАЗМЕР].join(" "), ВСЕ_СЛОИ));
    expect(r.segments.length, "в стены попали мебель, штриховка или размеры").toBe(4);
    expect(r.segments.every((s) => s.layer === "Стены"), "кириллическое имя слоя не прочитано").toBe(true);
    expect(r.wallLayers).toEqual(["Стены"]);
    expect(r.warnings.join(" ")).toMatch(/Взят слой стен \(Стены\)/);
  });

  it("габарит считается по стенам, а не по размерной цепочке ниже плана", async () => {
    const r = await readPdfSegments(слоистый([СТЕНЫ, РАЗМЕР].join(" "), ВСЕ_СЛОИ));
    // стены 400 x 300; размер уходит на 40 пунктов ниже — габарит от него не растёт
    expect(r.extentPt).toBe(400);
  });

  it("слой стен найден, но линий меньше четырёх — взяты все, и сказано почему", async () => {
    const мало = "/OC /oc1 BDC 0 0 m 400 0 l S EMC";
    const r = await readPdfSegments(слоистый([мало, МЕБЕЛЬ].join(" "), ВСЕ_СЛОИ));
    expect(r.segments.length).toBe(3);
    expect(r.wallLayers).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/Слой стен найден/);
  });

  it("слои есть, но стен среди них нет — взяты все и названо, какие слои есть", async () => {
    const r = await readPdfSegments(слоистый([МЕБЕЛЬ, ШТРИХ].join(" "), ВСЕ_СЛОИ));
    expect(r.segments.length).toBe(6);
    expect(r.warnings.join(" ")).toMatch(/В PDF есть слои/);
  });

  it("контроль: слоёв в файле нет — всё как прежде, и о слоях ни слова", async () => {
    const r = await readPdfSegments(слоистый("0 0 m 400 0 l 400 300 l 0 300 l h S", []));
    expect(r.segments.length).toBe(4);
    expect(r.wallLayers).toEqual([]);
    expect(r.warnings.join(" ")).not.toMatch(/слой|Слой/);
  });

  it("чужая метка содержимого внутри слоя не сбивает счёт EMC", async () => {
    const поток = "/OC /oc2 BDC /Span BMC 0 0 m 10 0 l S EMC EMC " + СТЕНЫ;
    const r = await readPdfSegments(слоистый(поток, ВСЕ_СЛОИ));
    expect(r.wallLayers).toEqual(["Стены"]);
    expect(r.segments.length, "линия мебели после вложенной метки приписана стенам").toBe(4);
  });
});

describe("planFromPdfSegments после отбора по слою", () => {
  // 600 линий на одной прямой, без перекрытий — ни сведения, ни дублей
  const линии = (): PdfSegments["segments"] =>
    Array.from({ length: 600 }, (_, i) => ({ x1: i * 200, y1: 0, x2: i * 200 + 100, y2: 0 }));

  it("короткие грани стен не режутся потолком в 400 и нет ложного «не видно, что стена»", () => {
    const src: PdfSegments = { segments: линии(), warnings: [], extentPt: 119_900, wallLayers: ["Стены"] };
    const r = planFromPdfSegments(src, 100);
    expect(r.truncated, "потолок отрезал настоящие стены").toBe(0);
    expect(r.warnings.join(" ")).not.toMatch(/не видно, что стена/);
  });

  it("контроль: без отбора по слою потолок и предупреждение на месте", () => {
    const src: PdfSegments = { segments: линии(), warnings: [], extentPt: 119_900 };
    const r = planFromPdfSegments(src, 100);
    expect(r.truncated).toBe(200);
    expect(r.warnings.join(" ")).toMatch(/не видно, что стена/);
  });
});

describe("настоящий план основателя LA VIE", () => {
  const ПУТЬ = process.env.QSPACE_EXAMPLES
    ?? "C:/Users/user/OneDrive/Desktop/АЕВИОН/21-QSpace-3D-модельер/примеры";
  const файл = `${ПУТЬ}/LA VIE.pdf`;

  it("стены взяты со слоя «Стены», штриховка и мебель — нет", async () => {
    if (!existsSync(файл)) { console.warn("ПРОПУСК: нет LA VIE.pdf"); return; }
    const r = await readPdfSegments(new Uint8Array(readFileSync(файл)));
    expect(r.wallLayers, "слой стен не найден в настоящем PDF из AutoCAD").toContain("Стены");
    // PyMuPDF насчитал на «Стены» 1628 линий и 1 на «Стены внутренние»
    expect(r.segments.length).toBeGreaterThan(1000);
    expect(r.segments.length).toBeLessThan(3000);
    expect(r.segments.some((s) => s.layer === "A-WALL-PATT"), "штриховка попала в стены").toBe(false);
    const plan = planFromPdfSegments(r, 20);
    expect(plan.plan).not.toBeNull();
    expect(plan.truncated).toBe(0);
    expect(plan.warnings.join(" ")).not.toMatch(/не видно, что стена/);
  });
});
