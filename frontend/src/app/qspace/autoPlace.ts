import type { Room, RoomRun } from "./rooms";
import type { RoomType } from "./roomTypes";
import type { Style } from "./styles";

/** Что поставить и где — то же, что снимок мебели проекта, без uid. */
export interface Placement {
  catalogId: string;
  x: number;
  z: number;
  rotY: number;
  room: number;
}

export interface PlacementResult {
  items: Placement[];
  /** предметы, которым не нашлось места — по комнатам, для честной строки человеку */
  skipped: Array<{ room: number; catalogId: string }>;
}

/** Зазор между предметами и от стены, м. */
const ЗАЗОР = 0.15;
/** Шаг перебора позиций, м. */
const ШАГ = 0.25;

interface Box { x0: number; z0: number; x1: number; z1: number }

/**
 * Черновая расстановка мебели стиля по комнатам.
 *
 * Не дизайнерская раскладка, а «всё, что по стилю положено, стоит в своей
 * комнате и не пересекается»: человек двигает мышью дальше. Правило
 * простое и объяснимое: предмет ищет первое место, обходя комнату от
 * верхнего левого угла, — крупное встаёт вдоль стен, мелкое добирает
 * середину. Каждая из четырёх вершин и центр обязаны лежать в ЭТОЙ комнате
 * (roomAt), пересечение с уже стоящими — с зазором 15 см — запрещено.
 * Предмет пробуется в двух ориентациях: как есть и повёрнутый на 90°.
 */
export function autoPlace(
  rooms: Room[],
  types: Record<number, RoomType>,
  style: Style,
  runsOf: (index: number) => RoomRun[],
  roomAt: (x: number, y: number) => number | null,
  sizeOf: (catalogId: string) => [number, number, number] | undefined,
  /**
   * Уже стоящее — сантехника и мебель С ЧЕРТЕЖА (fixtures.ts). Идёт в ответ
   * первым, занимает место, и тот же предмет в той же комнате по стилю
   * второй раз не ставится: унитаз с чертежа важнее унитаза «по стилю».
   */
  preplaced: Placement[] = [],
): PlacementResult {
  const items: Placement[] = [];
  const skipped: PlacementResult["skipped"] = [];
  const заняты: Box[] = [];

  const пересекает = (b: Box): boolean =>
    заняты.some((o) => b.x0 < o.x1 + ЗАЗОР && b.x1 > o.x0 - ЗАЗОР && b.z0 < o.z1 + ЗАЗОР && b.z1 > o.z0 - ЗАЗОР);

  const естьСЧертежа = new Set<string>();
  for (const p of preplaced) {
    const size = sizeOf(p.catalogId);
    if (!size) continue;
    const поворот = Math.abs(Math.sin(p.rotY)) > 0.5;
    const w = поворот ? size[1] : size[0], d = поворот ? size[0] : size[1];
    заняты.push({ x0: p.x - w / 2, z0: p.z - d / 2, x1: p.x + w / 2, z1: p.z + d / 2 });
    items.push(p);
    естьСЧертежа.add(`${p.room}:${p.catalogId}`);
  }

  for (const room of rooms) {
    const type = types[room.index] ?? "living";
    const runs = runsOf(room.index);
    if (runs.length === 0) { for (const id of style.furniture[type]) skipped.push({ room: room.index, catalogId: id }); continue; }
    const minX = Math.min(...runs.map((r) => r.x0)), maxX = Math.max(...runs.map((r) => r.x1));
    const minY = Math.min(...runs.map((r) => r.y)), maxY = Math.max(...runs.map((r) => r.y));

    for (const catalogId of style.furniture[type]) {
      if (естьСЧертежа.has(`${room.index}:${catalogId}`)) continue;
      const size = sizeOf(catalogId);
      if (!size) { skipped.push({ room: room.index, catalogId }); continue; }
      let поставлен = false;
      // две ориентации: как в каталоге и повёрнутый на 90°
      for (const [w, d, rotY] of [[size[0], size[1], 0], [size[1], size[0], Math.PI / 2]] as const) {
        const hw = w / 2 + ЗАЗОР, hd = d / 2 + ЗАЗОР;
        for (let z = minY + hd; z <= maxY - hd && !поставлен; z += ШАГ) {
          for (let x = minX + hw; x <= maxX - hw; x += ШАГ) {
            const углы: Array<[number, number]> = [[x - hw, z - hd], [x + hw, z - hd], [x - hw, z + hd], [x + hw, z + hd], [x, z]];
            if (!углы.every(([px, pz]) => roomAt(px, pz) === room.index)) continue;
            const box: Box = { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 };
            if (пересекает(box)) continue;
            заняты.push(box);
            items.push({ catalogId, x, z, rotY, room: room.index });
            поставлен = true;
            break;
          }
        }
        if (поставлен) break;
      }
      if (!поставлен) skipped.push({ room: room.index, catalogId });
    }
  }
  return { items, skipped };
}
