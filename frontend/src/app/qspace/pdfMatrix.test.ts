import { describe, expect, it } from "vitest";
import { readPdfSegments } from "./pdf";

const NL = String.fromCharCode(10);

/**
 * Несжатый PDF из нескольких потоков. contents — номера потоков, перечисленные
 * в /Contents страницы; null — словаря страницы нет вовсе (контроль).
 */
function pdf(потоки: string[], contents: number[] | null): Uint8Array {
  const части: string[] = ["%PDF-1.4"];
  if (contents) {
    части.push(`1 0 obj << /Type /Page /Contents [${contents.map((n) => `${n} 0 R`).join(" ")}] >> endobj`);
  }
  потоки.forEach((s, i) => {
    части.push(`${i + 2} 0 obj << /Length ${s.length} >>`, "stream", s, "endstream", "endobj");
  });
  части.push("%%EOF");
  return new TextEncoder().encode(части.join(NL));
}

const длины = (r: { segments: Array<{ x1: number; y1: number; x2: number; y2: number }> }): number[] =>
  r.segments.map((s) => Math.round(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * 1000) / 1000).sort((a, b) => a - b);

describe("матрица преобразования cm в разборе PDF", () => {
  it("матрица из первого потока страницы действует на второй (склейка по /Contents)", async () => {
    const r = await readPdfSegments(pdf(["0.5 0 0 0.5 0 0 cm", "0 0 m 100 0 l S"], [2, 3]));
    expect(длины(r)).toEqual([50]);
  });

  it("контроль: без словаря страницы потоки разбираются порознь, как прежде", async () => {
    const r = await readPdfSegments(pdf(["0.5 0 0 0.5 0 0 cm", "0 0 m 100 0 l S"], null));
    expect(длины(r)).toEqual([100]);
  });

  it("порядок берётся из /Contents, а не из порядка в файле", async () => {
    // в файле рисование стоит раньше матрицы, но страница велит сперва матрицу
    const r = await readPdfSegments(pdf(["0 0 m 100 0 l S", "0.5 0 0 0.5 0 0 cm"], [3, 2]));
    expect(длины(r)).toEqual([50]);
  });

  it("q/Q восстанавливают матрицу: внутри блока ×2, после него ×1", async () => {
    const r = await readPdfSegments(pdf(["q 2 0 0 2 0 0 cm 0 0 m 10 0 l S Q 0 0 m 10 0 l S"], [2]));
    expect(длины(r)).toEqual([10, 20]);
  });

  it("повёрнутый прямоугольник: re под матрицей поворота даёт повёрнутые стороны", async () => {
    const r = await readPdfSegments(pdf(["0 1 -1 0 300 300 cm 0 0 100 50 re S"], [2]));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of r.segments) {
      minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2);
    }
    expect(Math.round(maxX - minX)).toBe(50);
    expect(Math.round(maxY - minY)).toBe(100);
  });

  it("длина потока берётся из ЕГО словаря, а не из соседнего в том же окне", async () => {
    // первый поток 13 знаков, второй 16: по чужой длине второй обрезался бы до
    // «0 0 m 0 2000 » и потерял линию целиком
    const r = await readPdfSegments(pdf(["0 0 m 5 0 l S", "0 0 m 0 2000 l S"], null));
    expect(длины(r)).toEqual([5, 2000]);
  });

  it("матрицы вкладываются: сдвиг внутри масштаба умножается на масштаб", async () => {
    const r = await readPdfSegments(pdf(["2 0 0 2 0 0 cm 1 0 0 1 10 0 cm 0 0 m 5 0 l S"], [2]));
    expect(r.segments[0].x1).toBeCloseTo(20, 6);
    expect(r.segments[0].x2).toBeCloseTo(30, 6);
  });
});
