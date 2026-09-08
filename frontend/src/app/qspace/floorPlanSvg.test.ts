import { describe, expect, it } from "vitest";
import { demoPlan, type Plan } from "./planModel";
import { findRooms } from "./rooms";
import { floorPlanSvg } from "./floorPlanSvg";

function box(W: number, H: number): Plan {
  return {
    name: "коробка",
    walls: [
      { x1: 0, y1: 0, x2: W, y2: 0, thickness: 0.2, height: 2.7 },
      { x1: W, y1: 0, x2: W, y2: H, thickness: 0.2, height: 2.7 },
      { x1: W, y1: H, x2: 0, y2: H, thickness: 0.2, height: 2.7 },
      { x1: 0, y1: H, x2: 0, y2: 0, thickness: 0.2, height: 2.7 },
    ],
    openings: [
      { wall: 0, offset: 1, width: 0.9, height: 2.05, sill: 0, kind: "door" },
      { wall: 2, offset: 2, width: 1.4, height: 1.45, sill: 0.85, kind: "window" },
    ],
    source: "demo",
  };
}

describe("чертёж сверху", () => {
  it("это настоящий SVG, а не строка с угловыми скобками", () => {
    const svg = floorPlanSvg(box(6, 4));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("размер листа выведен из размера плана и масштаба", () => {
    const small = floorPlanSvg(box(6, 4), { scale: 50 });
    const big = floorPlanSvg(box(12, 8), { scale: 50 });
    const w = (s: string) => Number(/width="([\d.]+)"/.exec(s)![1]);
    // вдвое больший план даёт заметно больший лист, а не тот же самый
    expect(w(big)).toBeGreaterThan(w(small) * 1.6);
  });

  it("каждая стена нарисована — линий не меньше, чем стен", () => {
    const plan = box(6, 4);
    const svg = floorPlanSvg(plan);
    const lines = (svg.match(/<line /g) || []).length;
    expect(lines).toBeGreaterThanOrEqual(plan.walls.length);
  });

  it("дверь рисуется дугой открывания, окно — линией", () => {
    const svg = floorPlanSvg(box(6, 4));
    expect(svg).toContain("<path d=");          // дуга двери
    expect(svg).toContain('stroke="#4a7fb5"');  // цвет окна
  });

  it("ось Y перевёрнута: север плана выше юга на листе", () => {
    // стена 2 (север, y=4) должна оказаться ВЫШЕ стены 0 (юг, y=0),
    // то есть с МЕНЬШИМ y в SVG — иначе чертёж зеркальный
    const svg = floorPlanSvg(box(6, 4), { scale: 50, margin: 1 });
    const ys = [...svg.matchAll(/<line x1="[\d.]+" y1="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(ys.length).toBeGreaterThanOrEqual(4);
    const south = Math.max(...ys); // юг ниже на листе = больший y
    const north = Math.min(...ys);
    expect(south).toBeGreaterThan(north);
  });

  it("габарит подписан настоящими метрами", () => {
    const svg = floorPlanSvg(box(6, 4));
    expect(svg).toContain("6.00 м");
    expect(svg).toContain("4.00 м");
  });

  it("площади помещений подписаны, если их передали", () => {
    const plan = demoPlan();
    const rooms = findRooms(plan).rooms;
    expect(rooms.length).toBeGreaterThan(0);
    const svg = floorPlanSvg(plan, { rooms });
    for (const r of rooms) {
      expect(svg, `нет подписи площади помещения ${r.index}`).toContain(`${r.area.toFixed(1)} м²`);
    }
  });

  it("без помещений чертёж всё равно строится", () => {
    const svg = floorPlanSvg(box(6, 4));
    expect(svg).toContain("</svg>");
    expect(svg).not.toContain("undefined");
    expect(svg).not.toContain("NaN");
  });

  it("честная подпись на листе есть — он уйдёт без нашего сайта", () => {
    const svg = floorPlanSvg(box(6, 4));
    expect(svg).toMatch(/НЕ рабочий чертёж/);
    expect(svg).toMatch(/измеряйте на месте/);
  });

  it("заголовок подставляется и экранируется", () => {
    const svg = floorPlanSvg(box(6, 4), { title: 'Квартира <b>"на Абая"</b>' });
    expect(svg).toContain("&lt;b&gt;");
    expect(svg).toContain("&quot;");
    expect(svg).not.toContain("<b>");
  });

  it("пустой план не роняет и не даёт NaN", () => {
    const empty: Plan = { name: "пусто", walls: [], openings: [], source: "demo" };
    const svg = floorPlanSvg(empty);
    expect(svg).toContain("</svg>");
    expect(svg).not.toContain("NaN");
  });
});
