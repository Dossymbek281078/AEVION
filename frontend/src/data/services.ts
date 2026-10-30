/**
 * Платные услуги AEVION (слово основателя 28.10.2026 через Оркестратора: цены утверждены).
 * Три услуги, по каждой — образец (сделан нашими же инструментами 28.10, папки
 * 07-Заявки-и-инвесторы/2026-10-28-*) и тарифы. Касса — Lemon Squeezy: ссылки на
 * checkout выдаёт окно Почта; пока ссылки нет (null), кнопка ведёт на форму
 * /pricing/contact с темой услуги — честный путь к заказу, а не мёртвая кнопка.
 * Цены здесь — единственный источник: страница их читает отсюда, сторож
 * servicesPage.guard сверяет с таблицей основателя.
 */
export type ServiceId = "video" | "photo" | "dub";

export interface ServiceTier {
  id: string;
  /** Количество/объём — для подписи кнопки: 3 ролика, 20 карточек, 60 с. */
  qty: number;
  unit: "video" | "card" | "sec" | "min";
  priceUsd: number;
  /** Подписка: «в месяц». */
  monthly?: boolean;
  /** Цена за единицу сверх (перевод: $29/мин) — без пакета. */
  perUnit?: boolean;
  checkoutUrl: string | null;
}

export interface Service {
  id: ServiceId;
  sample: { kind: "video" | "image"; src: string; poster?: string; durationSec?: number };
  tiers: ServiceTier[];
}

export const SERVICES: Service[] = [
  {
    id: "video",
    sample: { kind: "video", src: "/services/sample-video-coffee.mp4", durationSec: 15 },
    tiers: [
      { id: "video-3", qty: 3, unit: "video", priceUsd: 49, checkoutUrl: null },
      { id: "video-10", qty: 10, unit: "video", priceUsd: 149, checkoutUrl: null },
      { id: "video-20m", qty: 20, unit: "video", priceUsd: 249, monthly: true, checkoutUrl: null },
    ],
  },
  {
    id: "photo",
    sample: { kind: "image", src: "/services/sample-photo-before-after.webp" },
    tiers: [
      { id: "photo-5", qty: 5, unit: "card", priceUsd: 15, checkoutUrl: null },
      { id: "photo-20", qty: 20, unit: "card", priceUsd: 49, checkoutUrl: null },
    ],
  },
  {
    id: "dub",
    sample: { kind: "video", src: "/services/sample-dub-ru-en.mp4", durationSec: 15 },
    tiers: [
      { id: "dub-trial", qty: 60, unit: "sec", priceUsd: 19, checkoutUrl: null },
      { id: "dub-min", qty: 1, unit: "min", priceUsd: 29, perUnit: true, checkoutUrl: null },
    ],
  },
];

export function serviceTier(id: string): ServiceTier | undefined {
  for (const s of SERVICES) for (const t of s.tiers) if (t.id === id) return t;
  return undefined;
}
