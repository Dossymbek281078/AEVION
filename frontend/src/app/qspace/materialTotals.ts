import type { RoomCsvLine } from "./estimate";
import { materialById } from "./materials";

/**
 * Список к покупке по МАТЕРИАЛАМ: сколько метров каждого пола и каждой стены.
 *
 * До этого смета знала одну площадь пола и одну площадь стен на всю квартиру,
 * а отделка по комнатам уже разная: керамогранит в санузле, ламинат в спальне.
 * Покупают по материалу — значит и считать надо по материалу: одна строка на
 * материал, площадь — сумма по комнатам, где он назначен, и список этих комнат.
 *
 * Площадь пола берётся с запасом на подрезку (та же `flooring`, что в разбивке
 * по комнатам), стен — как есть: краску и обои считают от чистой площади.
 */
export interface MaterialLine {
  surface: "floor" | "wall";
  id: string;
  name: string;
  /** м² */
  area: number;
  rooms: number[];
}

export function materialShopping(
  lines: RoomCsvLine[],
  roomFloor: Record<number, string>,
  roomWall: Record<number, string>,
  floorMatId: string,
  wallMatId: string,
): MaterialLine[] {
  const acc = new Map<string, MaterialLine>();
  const add = (surface: "floor" | "wall", id: string, area: number, room: number) => {
    const m = materialById(id);
    const key = `${surface}:${id}`;
    const cur = acc.get(key) ?? { surface, id, name: m?.name ?? id, area: 0, rooms: [] };
    cur.area += area;
    cur.rooms.push(room);
    acc.set(key, cur);
  };
  for (const l of lines) {
    add("floor", roomFloor[l.index] ?? floorMatId, l.flooring, l.index);
    add("wall", roomWall[l.index] ?? wallMatId, l.wallArea, l.index);
  }
  // полы первыми, внутри — по убыванию площади: крупная покупка сверху
  return [...acc.values()].sort((a, b) => (a.surface === b.surface ? b.area - a.area : a.surface === "floor" ? -1 : 1));
}
