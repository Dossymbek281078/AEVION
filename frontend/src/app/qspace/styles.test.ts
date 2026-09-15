import { describe, expect, it } from "vitest";
import { STYLES, styleById } from "./styles";
import { ROOM_TYPES, guessRoomTypes, type RoomType } from "./roomTypes";
import { materialById } from "./materials";
import { CATALOG } from "./furniture";
import { autoPlace } from "./autoPlace";
import { findRooms } from "./rooms";
import type { Plan } from "./planModel";

describe("готовые стили", () => {
  it("шесть стилей с разными названиями", () => {
    expect(STYLES.length).toBe(6);
    expect(new Set(STYLES.map((s) => s.name)).size).toBe(6);
    expect(styleById("loft")?.name).toBe("Лофт");
  });

  it("у каждого стиля отделка всех пяти типов комнат — материалами нужной поверхности", () => {
    for (const s of STYLES) for (const t of ROOM_TYPES) {
      const f = s.finish[t];
      expect(materialById(f.floor)?.surface, `${s.id}/${t} пол ${f.floor}`).toBe("floor");
      expect(materialById(f.wall)?.surface, `${s.id}/${t} стена ${f.wall}`).toBe("wall");
    }
  });

  it("в ванной у каждого стиля пол — плитка или керамогранит, не паркет", () => {
    for (const s of STYLES) {
      expect(materialById(s.finish.bath.floor)!.pattern, `${s.id}: ${s.finish.bath.floor}`).toBe("tile");
    }
  });

  it("вся мебель стилей существует в каталоге", () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    for (const s of STYLES) for (const t of ROOM_TYPES) for (const id of s.furniture[t]) {
      expect(ids.has(id), `${s.id}/${t}: ${id}`).toBe(true);
    }
  });

  it("стили отличаются друг от друга полом гостиной или стенами — иначе кнопки-близнецы", () => {
    const ключи = STYLES.map((s) => `${s.finish.living.floor}|${s.finish.living.wall}`);
    expect(new Set(ключи).size).toBe(STYLES.length);
  });
});

describe("угадывание типа комнаты", () => {
  const комнаты = (площади: number[]) => площади.map((area, i) => ({ index: i + 1, area, perimeter: 0, cx: 0, cy: 0 }));
  it("квартира 24 / 14 / 12 / 4.5 / 3 → гостиная, кухня, спальня, санузел, санузел", () => {
    expect(guessRoomTypes(комнаты([24, 14, 12, 4.5, 3]))).toEqual({ 1: "living", 2: "kitchen", 3: "bedroom", 4: "bath", 5: "bath" });
  });
  it("третья мелкая комната — уже прихожая, а не третий санузел; 7 м² — прихожая", () => {
    const t = guessRoomTypes(комнаты([20, 9, 7, 4, 4, 3]));
    expect(t).toEqual({ 1: "living", 2: "kitchen", 3: "hall", 4: "bath", 5: "bath", 6: "hall" });
  });
  it("порядок номеров не важен — решает площадь", () => {
    const t = guessRoomTypes([{ index: 1, area: 4, perimeter: 0, cx: 0, cy: 0 }, { index: 2, area: 30, perimeter: 0, cx: 0, cy: 0 }]);
    expect(t).toEqual({ 1: "bath", 2: "living" });
  });
});

describe("авторасстановка мебели", () => {
  // коробка 6×4 с перегородкой: две комнаты 3×4 (дверной проём 0.9 м)
  const plan: Plan = {
    name: "тест",
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
  const sizeOf = (id: string) => CATALOG.find((c) => c.id === id)?.size;

  it("предметы стоят внутри своей комнаты и не пересекаются", () => {
    const r = findRooms(plan);
    expect(r.rooms.length).toBe(2);
    const types: Record<number, RoomType> = { 1: "bedroom", 2: "bath" };
    const p = autoPlace(r.rooms, types, STYLES[0], r.runsOf, r.roomAt, sizeOf);
    expect(p.items.length).toBeGreaterThanOrEqual(5);
    for (const it of p.items) {
      expect(r.roomAt(it.x, it.z), `${it.catalogId} центр в комнате ${it.room}`).toBe(it.room);
      const s = sizeOf(it.catalogId)!;
      const [w, d] = it.rotY === 0 ? [s[0], s[1]] : [s[1], s[0]];
      for (const [px, pz] of [[it.x - w / 2, it.z - d / 2], [it.x + w / 2, it.z + d / 2]]) {
        expect(r.roomAt(px, pz), `${it.catalogId} угол`).toBe(it.room);
      }
    }
    for (let i = 0; i < p.items.length; i++) for (let j = i + 1; j < p.items.length; j++) {
      const a = p.items[i], b = p.items[j];
      const sa = sizeOf(a.catalogId)!, sb = sizeOf(b.catalogId)!;
      const [aw, ad] = a.rotY === 0 ? [sa[0], sa[1]] : [sa[1], sa[0]];
      const [bw, bd] = b.rotY === 0 ? [sb[0], sb[1]] : [sb[1], sb[0]];
      const пересеклись = Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.z - b.z) < (ad + bd) / 2;
      expect(пересеклись, `${a.catalogId} × ${b.catalogId}`).toBe(false);
    }
  });

  it("Г-образная комната: ни один угол предмета не заходит в закуток за стеной", () => {
    // 6×4 с закрытым квадратом 1.2×1.2 в правом верхнем углу: главная комната — буква Г.
    // Проверка только по центру предмета пропускает диван, чей угол лежит в закутке.
    const г: Plan = {
      name: "Г",
      walls: [
        ...plan.walls.slice(0, 4),
        { x1: 4.8, y1: 0, x2: 4.8, y2: 1.2, thickness: 0.1, height: 2.7 },
        { x1: 4.8, y1: 1.2, x2: 6, y2: 1.2, thickness: 0.1, height: 2.7 },
      ],
      openings: [],
    } as unknown as Plan;
    const r = findRooms(г);
    expect(r.rooms.length).toBe(2);
    const главная = r.rooms[0].index; // крупнейшая — Г
    const types: Record<number, RoomType> = { [главная]: "living", [r.rooms[1].index]: "hall" };
    let проверено = 0;
    for (const s of STYLES) {
      const p = autoPlace(r.rooms, types, s, r.runsOf, r.roomAt, sizeOf);
      for (const it of p.items) {
        const sz = sizeOf(it.catalogId)!;
        const [w, d] = it.rotY === 0 ? [sz[0], sz[1]] : [sz[1], sz[0]];
        for (const [px, pz] of [[it.x - w / 2, it.z - d / 2], [it.x + w / 2, it.z - d / 2], [it.x - w / 2, it.z + d / 2], [it.x + w / 2, it.z + d / 2]]) {
          expect(r.roomAt(px, pz), `${s.id}: ${it.catalogId} угол (${px.toFixed(2)}, ${pz.toFixed(2)})`).toBe(it.room);
          проверено++;
        }
      }
    }
    expect(проверено).toBeGreaterThan(40);
  });

  it("в ванную 3×4 не влезает всё — лишнее честно в skipped, а не втиснуто", () => {
    const r = findRooms(plan);
    const p = autoPlace(r.rooms, { 1: "bath", 2: "bath" }, STYLES[0], r.runsOf, r.roomAt, sizeOf);
    expect(p.items.length + p.skipped.length).toBe(STYLES[0].furniture.bath.length * 2);
  });

  it("runsOf: полосы комнаты покрывают её площадь", () => {
    const r = findRooms(plan);
    for (const room of r.rooms) {
      const площадьПолос = r.runsOf(room.index).reduce((s, run) => s + (run.x1 - run.x0) * 0.05, 0);
      expect(площадьПолос).toBeCloseTo(room.area, 1);
    }
  });
});
