import type { RoomType } from "./roomTypes";

/**
 * Готовые стили — «3–10 дизайнов за минуты», о которых просил основатель 15.09.
 *
 * Стиль = отделка ПО ТИПУ КОМНАТЫ (в ванной керамогранит и плитка, в спальне
 * паркет и краска) + набор мебели по типу комнаты из нашего каталога.
 * Всё из каталогов materials.ts и furniture.ts — экран, смета и окно
 * пожеланий смотрят на одни и те же id, расходиться им нечем.
 */
export interface RoomFinish {
  floor: string;
  wall: string;
}

export interface Style {
  id: string;
  name: string;
  /** одна фраза для карточки стиля */
  tagline: string;
  finish: Record<RoomType, RoomFinish>;
  /** мебель по типу комнаты — id из furniture.ts, в порядке важности */
  furniture: Record<RoomType, string[]>;
}

const МЕБЕЛЬ_ОБЫЧНАЯ: Record<RoomType, string[]> = {
  living: ["sofa", "coffee", "tv", "shelf", "rug", "plant"],
  bedroom: ["bed", "nightstand", "nightstand", "wardrobe", "dresser"],
  kitchen: ["kitchen", "fridge", "dining", "chair", "chair", "chair", "chair"],
  bath: ["bathtub", "toilet", "vanity", "washer", "towel-heater"],
  hall: ["wardrobe-sliding", "mirror"],
};

export const STYLES: Style[] = [
  {
    id: "scandi",
    name: "Скандинавский",
    tagline: "светлый дуб, белые стены, много воздуха",
    finish: {
      living: { floor: "laminate-light", wall: "paint-warm-white" },
      bedroom: { floor: "laminate-light", wall: "paint-sage" },
      kitchen: { floor: "porcelain-wood", wall: "tile-wall-white" },
      bath: { floor: "porcelain-grey", wall: "tile-wall-white" },
      hall: { floor: "porcelain-wood", wall: "paint-warm-white" },
    },
    furniture: { ...МЕБЕЛЬ_ОБЫЧНАЯ, living: ["sofa", "coffee", "armchair", "shelf", "rug", "plant", "lamp"] },
  },
  {
    id: "loft",
    name: "Лофт",
    tagline: "бетон, графит, дерево с характером",
    finish: {
      living: { floor: "concrete-floor", wall: "paint-graphite" },
      bedroom: { floor: "parquet-oak", wall: "paint-grey" },
      kitchen: { floor: "concrete-floor", wall: "paint-graphite" },
      bath: { floor: "porcelain-grey", wall: "tile-wall-grey" },
      hall: { floor: "concrete-floor", wall: "paint-grey" },
    },
    furniture: { ...МЕБЕЛЬ_ОБЫЧНАЯ, living: ["sofa-corner", "coffee", "tv", "bookcase", "lamp"], kitchen: ["kitchen", "kitchen-island", "fridge", "barstool", "barstool", "barstool"] },
  },
  {
    id: "minimal",
    name: "Минимализм",
    tagline: "мрамор, серый, ничего лишнего",
    finish: {
      living: { floor: "porcelain-marble", wall: "paint-warm-white" },
      bedroom: { floor: "laminate-grey", wall: "paint-grey" },
      kitchen: { floor: "porcelain-marble", wall: "paint-warm-white" },
      bath: { floor: "porcelain-marble", wall: "porcelain-wall-marble" },
      hall: { floor: "porcelain-marble", wall: "paint-warm-white" },
    },
    furniture: { ...МЕБЕЛЬ_ОБЫЧНАЯ, living: ["sofa", "coffee", "tv"], bedroom: ["bed", "nightstand", "wardrobe-sliding"] },
  },
  {
    id: "classic",
    name: "Классика",
    tagline: "паркет, тёплые стены, книжный шкаф",
    finish: {
      living: { floor: "parquet-oak", wall: "paint-sand" },
      bedroom: { floor: "parquet-oak", wall: "paint-rose" },
      kitchen: { floor: "tile-white", wall: "paint-sand" },
      bath: { floor: "tile-white", wall: "tile-wall-white" },
      hall: { floor: "tile-white", wall: "paint-sand" },
    },
    furniture: { ...МЕБЕЛЬ_ОБЫЧНАЯ, living: ["sofa", "armchair", "armchair", "coffee", "bookcase", "rug", "lamp"], kitchen: ["kitchen", "fridge", "dining-round", "chair", "chair", "chair", "chair"] },
  },
  {
    id: "japandi",
    name: "Японди",
    tagline: "олива, терраццо, низкая мебель",
    finish: {
      living: { floor: "laminate-light", wall: "paint-olive" },
      bedroom: { floor: "laminate-light", wall: "paint-warm-white" },
      kitchen: { floor: "porcelain-terrazzo", wall: "paint-olive" },
      bath: { floor: "porcelain-terrazzo", wall: "tile-wall-grey" },
      hall: { floor: "porcelain-terrazzo", wall: "paint-warm-white" },
    },
    furniture: { ...МЕБЕЛЬ_ОБЫЧНАЯ, living: ["sofa", "coffee", "shelf", "plant", "plant", "rug"], bath: ["shower", "toilet", "vanity", "washer", "towel-heater"] },
  },
  {
    id: "mediterranean",
    name: "Средиземноморский",
    tagline: "терракота, голубая пудра, плитка",
    finish: {
      living: { floor: "porcelain-wood", wall: "paint-powder" },
      bedroom: { floor: "laminate-light", wall: "paint-powder" },
      kitchen: { floor: "tile-white", wall: "paint-terracotta" },
      bath: { floor: "tile-dark", wall: "tile-wall-white" },
      hall: { floor: "tile-dark", wall: "paint-terracotta" },
    },
    furniture: { ...МЕБЕЛЬ_ОБЫЧНАЯ, living: ["sofa", "armchair", "coffee", "shelf", "plant", "rug"] },
  },
];

export function styleById(id: string): Style | undefined {
  return STYLES.find((s) => s.id === id);
}
