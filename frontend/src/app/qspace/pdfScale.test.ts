// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { масштабПоРазмерам, словаИзТекста, type СловоНаЛисте } from "./dimensionScale";
import { planFromPdfSegments, readPdfSegments } from "./pdf";

/** Цепочка размеров вдоль оси: надписи посередине своих отрезков, масштаб k мм/пт. */
function цепочка(размеры: number[], k: number, axis: "h" | "v", ключ: number, старт = 0): СловоНаЛисте[] {
  const out: СловоНаЛисте[] = [];
  let мм = старт;
  for (const r of размеры) {
    const центр = (мм + r / 2) / k;
    out.push(axis === "h" ? { text: String(r), x: центр, y: ключ, axis } : { text: String(r), x: ключ, y: центр, axis });
    мм += r;
  }
  return out;
}

describe("масштаб по размерным числам", () => {
  it("цепочка 1400-2000-750-600-1800 в масштабе 40 мм/пт даёт ровно 40", () => {
    const r = масштабПоРазмерам(цепочка([1400, 2000, 750, 600, 1800], 40, "h", 100));
    expect(r).not.toBeNull();
    expect(r!.mmPerPt).toBeCloseTo(40, 6);
    expect(r!.agree).toBe(4);
  });

  it("вертикальная цепочка считается так же", () => {
    const r = масштабПоРазмерам(цепочка([3350, 4470, 3110, 1500], 25, "v", 50));
    expect(r!.mmPerPt).toBeCloseTo(25, 6);
  });

  it("пары через стену (сдвиг на 3.7 %) и случайные числа не сбивают ответ", () => {
    const основная = цепочка([1400, 2000, 750, 600, 1800, 290, 650], 42.57, "h", 10);
    // вторая цепочка с разрывом-стеной между отрезками: отношения выходят меньше
    const сРазрывом = [...цепочка([4950], 42.57, "h", 40), ...цепочка([2090], 42.57, "h", 40, 4950 + 150)];
    const шум: СловоНаЛисте[] = [
      { text: "9999", x: 3, y: 70, axis: "h" }, { text: "150", x: 211, y: 70, axis: "h" },
      { text: "2500", x: 400, y: 70, axis: "h" },
    ];
    const r = масштабПоРазмерам([...основная, ...сРазрывом, ...шум]);
    expect(r!.mmPerPt).toBeCloseTo(42.57, 2);
    expect(r!.agree).toBe(6);
  });

  it("меньше трёх согласных пар — ответа нет, а не угаданное число", () => {
    expect(масштабПоРазмерам(цепочка([1400, 2000, 750], 40, "h", 0))).toBeNull();
    expect(масштабПоРазмерам([])).toBeNull();
  });

  it("надписи в разных рядах не склеиваются в одну цепочку", () => {
    const ряд1 = цепочка([1400, 2000], 40, "h", 0);
    const ряд2 = цепочка([750, 600], 40, "h", 30);
    // по отдельности в каждом ряду одна пара — согласных пар всего 2
    expect(масштабПоРазмерам([...ряд1, ...ряд2])).toBeNull();
  });
});

describe("надписи из элементов pdf.js", () => {
  it("горизонтальная: центр = начало + половина ширины; нечисла и наклонные пропущены", () => {
    const слова = словаИзТекста([
      { str: "1400", transform: [8, 0, 0, 8, 100, 50], width: 20 },
      { str: " 2000 ", transform: [8, 0, 0, 8, 140, 50], width: 20 },
      { str: "Кухня", transform: [8, 0, 0, 8, 10, 10], width: 30 },
      { str: "15.6", transform: [8, 0, 0, 8, 10, 20], width: 30 },
      { str: "1200", transform: [5.66, 5.66, -5.66, 5.66, 0, 0], width: 20 },
    ]);
    expect(слова).toEqual([
      { text: "1400", x: 110, y: 50, axis: "h" },
      { text: "2000", x: 150, y: 50, axis: "h" },
    ]);
  });

  it("повёрнутая на 90°: центр смещён вдоль оси Y", () => {
    const [с] = словаИзТекста([{ str: "3110", transform: [0, 8, -8, 0, 30, 200], width: 24 }]);
    expect(с.axis).toBe("v");
    expect(с.x).toBeCloseTo(30, 6);
    expect(с.y).toBeCloseTo(212, 6);
  });
});

// Настоящий план основателя. Ответы известны из разбора PyMuPDF: 42.59 мм/пт,
// габарит стен 18.72 × 17.21 м, то есть ~440 пт листа по большей стороне.
const ПАПКА = process.env.QSPACE_EXAMPLES ?? "C:/Users/user/OneDrive/Desktop/АЕВИОН/21-QSpace-3D-модельер/примеры";
const LAVIE = `${ПАПКА}/LA VIE.pdf`;

describe.skipIf(!existsSync(LAVIE))("LA VIE.pdf: масштаб без ввода", () => {
  it("pdf.js находит размерные цепочки, масштаб 42.59 мм/пт", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(LAVIE)), isEvalSupported: false, disableFontFace: true }).promise;
    const tc = await (await doc.getPage(1)).getTextContent();
    await doc.destroy();
    const items = tc.items.flatMap((it) => ("str" in it ? [{ str: it.str, transform: it.transform, width: it.width }] : []));
    const r = масштабПоРазмерам(словаИзТекста(items));
    expect(r).not.toBeNull();
    expect(r!.mmPerPt).toBeGreaterThan(42.59 * 0.995);
    expect(r!.mmPerPt).toBeLessThan(42.59 * 1.005);
    expect(r!.agree).toBeGreaterThanOrEqual(8);
  }, 60_000);

  it("отрезки в пунктах ЛИСТА (матрица cm): габарит стен ~440 пт, а не 3663", async () => {
    const src = await readPdfSegments(new Uint8Array(readFileSync(LAVIE)));
    expect(src.extentPt).toBeGreaterThan(440 * 0.97);
    expect(src.extentPt).toBeLessThan(440 * 1.03);
    const p = planFromPdfSegments(src, (src.extentPt * 42.59) / 1000);
    expect(p.plan).not.toBeNull();
    let maxX = -Infinity, minX = Infinity, maxY = -Infinity, minY = Infinity;
    for (const w of p.plan!.walls) {
      minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
    }
    const большая = Math.max(maxX - minX, maxY - minY);
    expect(большая).toBeGreaterThan(18.72 * 0.95);
    expect(большая).toBeLessThan(18.72 * 1.05);
  }, 60_000);
});
