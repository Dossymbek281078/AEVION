import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { findWallsByThickness } from "./rasterWalls";
import { findRooms } from "./rooms";
import type { Plan, Wall } from "./planModel";
import { WALL_HEIGHT } from "./planModel";

function canvas(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const rect = (x0: number, y0: number, rw: number, rh: number, v = 0) => {
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4; data[i] = v; data[i + 1] = v; data[i + 2] = v;
    }
  };
  return { data, rect, w, h };
}

/** отрезки в px → план в метрах по большей стороне */
function planFrom(segs: ReturnType<typeof findWallsByThickness>["segments"], extentM: number): Plan {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of segs) { minX = Math.min(minX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2); maxX = Math.max(maxX, s.x1, s.x2); maxY = Math.max(maxY, s.y1, s.y2); }
  const k = extentM / Math.max(maxX - minX, maxY - minY);
  const walls: Wall[] = segs.map((s) => ({
    x1: (s.x1 - minX) * k, y1: (maxY - s.y1) * k, x2: (s.x2 - minX) * k, y2: (maxY - s.y2) * k,
    thickness: Math.max(0.08, Math.min(0.4, s.weight * k)), height: WALL_HEIGHT, glass: s.glass,
  }));
  return { name: "растр", walls, openings: [], source: "raster" };
}

describe("стены по толщине штриха", () => {
  it("комната толстыми стенами с перегородкой, текстом и размерной линией: 5 стен, текст и размер — нет", () => {
    const c = canvas(600, 400);
    c.rect(50, 50, 500, 12); c.rect(50, 338, 500, 12); c.rect(50, 50, 12, 300); c.rect(538, 50, 12, 300); // наружные 12 px
    c.rect(300, 50, 6, 300); // перегородка 6 px
    for (let i = 0; i < 8; i++) { c.rect(120 + i * 14, 180, 8, 2); c.rect(120 + i * 14, 180, 2, 10); } // «текст» штрихом 2 px
    c.rect(70, 370, 460, 1); // размерная линия 1 px
    const r = findWallsByThickness(c.data, c.w, c.h);
    const стены = r.segments.filter((s) => !s.glass);
    expect(r.wallPx).toBeGreaterThanOrEqual(10);
    expect(стены.length, JSON.stringify(стены)).toBe(5);
    expect(стены.some((s) => s.axis === "v" && Math.abs(s.x1 - 303) < 3), "перегородка 6 px найдена").toBe(true);
    expect(стены.every((s) => s.weight >= 5)).toBe(true);
    const rooms = findRooms(planFrom(стены, 10));
    expect(rooms.rooms.length).toBe(2);
  });
  it("окно — тонкая линия в разрыве наружной стены — становится стеклом и замыкает комнату", () => {
    const c = canvas(600, 400);
    c.rect(50, 50, 200, 12); c.rect(350, 50, 200, 12); c.rect(250, 55, 100, 2); // разрыв 100 px с тонкой линией
    c.rect(50, 338, 500, 12); c.rect(50, 50, 12, 300); c.rect(538, 50, 12, 300);
    const r = findWallsByThickness(c.data, c.w, c.h);
    expect(r.segments.filter((s) => s.glass).length).toBe(1);
    expect(findRooms(planFrom(r.segments, 10)).rooms.length).toBe(1);
  });
  it("серый фон скана (яркость 190) не мешает: те же 4 стены", () => {
    const c = canvas(400, 300);
    c.rect(0, 0, 400, 300, 190);
    c.rect(40, 40, 320, 10); c.rect(40, 250, 320, 10); c.rect(40, 40, 10, 220); c.rect(350, 40, 10, 220);
    const r = findWallsByThickness(c.data, c.w, c.h);
    expect(r.segments.length).toBe(4);
  });
  it("косая стена 45° находится Хафом одним отрезком с толщиной, а не лесенкой", () => {
    const c = canvas(600, 600);
    c.rect(50, 50, 500, 12); c.rect(50, 538, 500, 12); c.rect(50, 50, 12, 500); c.rect(538, 50, 12, 500);
    for (let i = 0; i < 480; i++) c.rect(60 + i, 60 + i, 12, 1); // диагональ толщиной ~12 px
    const r = findWallsByThickness(c.data, c.w, c.h);
    const косые = r.segments.filter((s) => s.axis === "d").sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1));
    // главный отрезок — вся диагональ с толщиной; обрывки вдоль неё же (плато гребня) не меняют комнат
    expect(косые.length, JSON.stringify(косые)).toBeGreaterThanOrEqual(1);
    expect(Math.hypot(косые[0].x2 - косые[0].x1, косые[0].y2 - косые[0].y1)).toBeGreaterThan(600);
    expect(косые[0].weight).toBeGreaterThanOrEqual(6);
    expect(findRooms(planFrom(r.segments, 10)).rooms.length).toBe(2);
  });
  it("белый лист и тонкие линии — честный отказ словами", () => {
    const c = canvas(300, 200);
    expect(findWallsByThickness(c.data, c.w, c.h).warnings.join(" ")).toMatch(/нет тёмных линий/);
    c.rect(20, 20, 260, 1); c.rect(20, 180, 260, 1); c.rect(20, 20, 1, 160); c.rect(280, 20, 1, 160);
    const r = findWallsByThickness(c.data, c.w, c.h);
    expect(r.segments.length).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/тоньше 4 px/);
  });
});

const PNG_LAVIE = (process.env.QSPACE_EXAMPLES ?? "C:/Users/user/OneDrive/Desktop/АЕВИОН/21-QSpace-3D-модельер/примеры") + "/LA VIE-страница1.png";

describe.skipIf(!existsSync(PNG_LAVIE))("LA VIE как картинка (PNG 2000×1125)", () => {
  // Замер 15.09 (честный): стена 22 px, отрезков ~140 (косых ≥ 6, стёкол ≥ 1), комнат 3 и
  // ~9 м² — контур течёт через ОКНА КОСЫХ стен (стекло ищется только по осям) и широкие
  // проёмы. Прежний способ по прогонам на той же картинке: 41 отрезок, 1 комната, 11.6 м².
  // Цель — как у вектора: ≥ 8 комнат, 120–200 м²; порог ниже — сторож от регресса.
  it("стены по толщине: наружная ~22 px, косое крыло найдено, стекло есть, комнат ≥ 5 (цель ≥ 8)", () => {
    const png = PNG.sync.read(readFileSync(PNG_LAVIE));
    // как в RasterReview: большая сторона до 2000 px (при 1400 перегородки 4 px истончаются до 1.6 и рвутся)
    const scale = Math.min(1, 2000 / Math.max(png.width, png.height));
    const w = Math.round(png.width * scale), h = Math.round(png.height * scale);
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = Math.min(png.width - 1, Math.round(x / scale)), sy = Math.min(png.height - 1, Math.round(y / scale));
      const si = (sy * png.width + sx) * 4, di = (y * w + x) * 4;
      data[di] = png.data[si]; data[di + 1] = png.data[si + 1]; data[di + 2] = png.data[si + 2]; data[di + 3] = png.data[si + 3];
    }
    const r = findWallsByThickness(data, w, h);
    const rooms = findRooms(planFrom(r.segments, 18.72));
    const строка = `стена ${r.wallPx.toFixed(1)} px, порог ${r.minPx.toFixed(1)}, отрезков ${r.segments.length} (стёкол ${r.segments.filter((s) => s.glass).length}), комнат ${rooms.rooms.length}, ${rooms.totalArea.toFixed(1)} м²`;
    expect(r.wallPx, строка).toBeGreaterThanOrEqual(18);
    expect(r.wallPx, строка).toBeLessThanOrEqual(26);
    expect(r.segments.length, строка).toBeGreaterThanOrEqual(100);
    expect(r.segments.filter((s) => s.axis === "d").length, строка).toBeGreaterThanOrEqual(6);
    expect(r.segments.filter((s) => s.glass).length, строка).toBeGreaterThanOrEqual(1);
    // 17.09: простенки у окон (полосы штриховки) + гребень без порога толщины → 7 комнат; сторож — 5
    expect(rooms.rooms.length, строка).toBeGreaterThanOrEqual(5);
  }, 60_000);
});
