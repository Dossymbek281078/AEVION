import type { Room } from "./rooms";

/**
 * Назначение комнаты — по нему стиль выбирает отделку и мебель.
 *
 * Чертёж названий комнат нам не отдаёт (подписи в PDF разбиты по буквам,
 * см. записку 15.09), поэтому тип УГАДЫВАЕТСЯ по площади и порядку, а человек
 * поправляет в окне пожеланий. Догадка обязана быть правдоподобной, а не
 * точной: цена ошибки — паркет в ванной на экране, который исправляют одним
 * выбором из списка.
 */
export type RoomType = "living" | "bedroom" | "kitchen" | "bath" | "hall";

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  living: "Гостиная",
  bedroom: "Спальня",
  kitchen: "Кухня",
  bath: "Санузел",
  hall: "Прихожая / коридор",
};

export const ROOM_TYPES: RoomType[] = ["living", "bedroom", "kitchen", "bath", "hall"];

/** Санузел — не больше стольких м²; выше это уже кладовая или прихожая. */
export const BATH_MAX_M2 = 6;
/** Кухне нужно хотя бы столько; меньше — прихожая. */
export const KITCHEN_MIN_M2 = 8;

/**
 * Правило (комнаты приходят отсортированными по площади, крупнейшая первой):
 * самая большая — гостиная; до 6 м² — санузел (не больше двух, остальные
 * мелкие — прихожая); вторая по величине от 8 м² — кухня; от 8 м² — спальни;
 * между 6 и 8 — прихожая.
 */
export function guessRoomTypes(rooms: Room[]): Record<number, RoomType> {
  const out: Record<number, RoomType> = {};
  const поПлощади = [...rooms].sort((a, b) => b.area - a.area);
  let baths = 0;
  let kitchenTaken = false;
  поПлощади.forEach((r, i) => {
    if (i === 0) { out[r.index] = "living"; return; }
    if (r.area <= BATH_MAX_M2) {
      out[r.index] = baths < 2 ? "bath" : "hall";
      baths++;
      return;
    }
    if (!kitchenTaken && r.area >= KITCHEN_MIN_M2) { out[r.index] = "kitchen"; kitchenTaken = true; return; }
    out[r.index] = r.area >= KITCHEN_MIN_M2 ? "bedroom" : "hall";
  });
  return out;
}
