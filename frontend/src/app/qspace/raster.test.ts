import { describe, expect, it } from "vitest";
import { findWallSegments } from "./raster";

/** Рисует белое полотно и даёт кисть для чёрных прямоугольников. */
function canvas(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
  }
  const rect = (x0: number, y0: number, rw: number, rh: number) => {
    for (let y = y0; y < y0 + rh; y++) {
      for (let x = x0; x < x0 + rw; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      }
    }
  };
  return { data, rect, w, h };
}

describe("распознавание стен на растровом плане", () => {
  it("прямоугольная комната даёт четыре стены, а не сорок полос пикселей", () => {
    const c = canvas(400, 300);
    // рамка толщиной 6 px — так стены и рисуют
    c.rect(40, 40, 320, 6);    // верх
    c.rect(40, 254, 320, 6);   // низ
    c.rect(40, 40, 6, 220);    // лево
    c.rect(354, 40, 6, 220);   // право

    const r = findWallSegments(c.data, c.w, c.h);
    // без слияния было бы ~24 линии (по 6 строк на стену)
    expect(r.segments.length).toBe(4);
    expect(r.segments.filter((s) => s.axis === "h").length).toBe(2);
    expect(r.segments.filter((s) => s.axis === "v").length).toBe(2);
    // толщина стены распознана, а не выдумана
    for (const s of r.segments) expect(s.weight).toBeGreaterThanOrEqual(5);
  });

  it("мелкие подписи и штрихи не становятся стенами", () => {
    const c = canvas(400, 300);
    c.rect(40, 40, 320, 6);          // настоящая стена
    for (let i = 0; i < 12; i++) c.rect(60 + i * 8, 120, 4, 4); // «буквы»
    c.rect(100, 200, 10, 2);         // короткая выноска

    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(1);
    expect(r.segments[0].axis).toBe("h");
  });

  it("длина найденной стены совпадает с нарисованной", () => {
    const c = canvas(400, 300);
    c.rect(50, 100, 300, 4);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(1);
    const s = r.segments[0];
    expect(Math.abs(s.x2 - s.x1) + 1).toBe(300);
  });

  it("две стены на расстоянии НЕ сливаются в одну", () => {
    const c = canvas(400, 300);
    c.rect(40, 40, 320, 5);
    c.rect(40, 200, 320, 5); // 160 px ниже — это другая стена
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(2);
  });

  it("пустая (белая) картинка честно говорит, что линий нет", () => {
    const c = canvas(400, 300);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/почти нет тёмных линий/);
  });

  it("фотография (почти всё тёмное) отвергается объяснением, а не пустотой", () => {
    const c = canvas(200, 200);
    c.rect(0, 0, 200, 160); // 80 % тёмного
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.segments.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/фотографию|инверсный/);
  });

  it("прозрачный фон PNG не считается чернилами", () => {
    const w = 200, h = 200;
    const data = new Uint8ClampedArray(w * h * 4); // всё нули: чёрный, но альфа 0
    const r = findWallSegments(data, w, h);
    expect(r.inkFraction).toBe(0);
    expect(r.segments.length).toBe(0);
  });

  it("результат назван ПРЕДПОЛОЖЕНИЕМ — человек обязан его проверить", () => {
    const c = canvas(400, 300);
    c.rect(40, 40, 320, 6);
    const r = findWallSegments(c.data, c.w, c.h);
    expect(r.warnings.join(" ")).toContain("ПРЕДПОЛОЖЕНИЕ");
  });

  it("порог чувствительности действительно управляет результатом", () => {
    const c = canvas(400, 300);
    // серая линия яркостью ~150: при пороге 128 не видна, при 200 видна
    for (let y = 100; y < 106; y++) {
      for (let x = 50; x < 350; x++) {
        const i = (y * c.w + x) * 4;
        c.data[i] = 150; c.data[i + 1] = 150; c.data[i + 2] = 150;
      }
    }
    expect(findWallSegments(c.data, c.w, c.h, { darkThreshold: 128 }).segments.length).toBe(0);
    expect(findWallSegments(c.data, c.w, c.h, { darkThreshold: 200 }).segments.length).toBe(1);
  });

  it("картинка-марка отвергается, а не обрабатывается как план", () => {
    const r = findWallSegments(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
    expect(r.segments.length).toBe(0);
    expect(r.warnings[0]).toContain("20×20");
  });
});
