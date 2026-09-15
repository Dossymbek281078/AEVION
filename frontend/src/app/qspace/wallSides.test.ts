import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { findRooms } from "./rooms";
import { roomsBesideWall } from "./wallSides";
import type { Plan } from "./planModel";

// коробка 6×4, перегородка x=3 с проёмом: слева комната A (x<3), справа B
const plan: Plan = {
  name: "две комнаты",
  walls: [
    { x1: 0, y1: 0, x2: 6, y2: 0, thickness: 0.2, height: 2.7 },
    { x1: 6, y1: 0, x2: 6, y2: 4, thickness: 0.2, height: 2.7 },
    { x1: 6, y1: 4, x2: 0, y2: 4, thickness: 0.2, height: 2.7 },
    { x1: 0, y1: 4, x2: 0, y2: 0, thickness: 0.2, height: 2.7 },
    { x1: 3, y1: 0, x2: 3, y2: 1.5, thickness: 0.1, height: 2.7 },
    { x1: 3, y1: 2.4, x2: 3, y2: 4, thickness: 0.1, height: 2.7 },
  ],
  openings: [],
} as unknown as Plan;

describe("комнаты по сторонам стены", () => {
  const r = findRooms(plan);
  const левая = r.roomAt(1.5, 2)!, правая = r.roomAt(4.5, 2)!;

  it("перегородка снизу вверх: нормаль (-dy, dx) = (-1, 0) → plus слева, minus справа", () => {
    const по = roomsBesideWall(plan.walls[4], 0, 1.5, r.roomAt);
    expect(левая).not.toBe(правая);
    expect(по).toEqual({ plus: левая, minus: правая });
  });

  it("та же перегородка, начерченная в обратную сторону, меняет стороны местами", () => {
    const обратная = { x1: 3, y1: 1.5, x2: 3, y2: 0, thickness: 0.1 };
    expect(roomsBesideWall(обратная, 0, 1.5, r.roomAt)).toEqual({ plus: правая, minus: левая });
  });

  it("наружная стена: с одной стороны комната, с другой — улица (null)", () => {
    const по = roomsBesideWall(plan.walls[0], 0, 6, r.roomAt); // низ, слева направо: нормаль (0, 1) — внутрь
    expect(по.plus).not.toBeNull();
    expect(по.minus).toBeNull();
  });

  it("сцена красит грани 4 и 5 материалами комнат plus и minus", () => {
    const src = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
    expect(src).toContain("мат(по.plus), мат(по.minus)]");
    expect(src).toContain('id={`qspace-room-wall-${r.index}`}');
  });
});
