import type { DevhubKey } from "./i18n";

/**
 * Таблица «одно окно вместо семи подписок» — самое продающее место витрины.
 *
 * Замер прода 08.09.2026: таблица обещает семь вещей, включая озвучку и музыку,
 * а обе в этот момент не работали — ключ ElevenLabs отвергнут поставщиком
 * («API key ID used as API key»). Полоса состояния СТРОКОЙ ВЫШЕ говорила правду
 * («Настроено: 12 из 17» и список отключённых), таблица — нет. Два наших ответа
 * об одном и том же, и верили бы тому, который крупнее и продаёт.
 *
 * Поэтому строки таблицы привязаны к тем же идентификаторам возможностей, что
 * приходят с `/studio/capabilities`: одно живое состояние на оба места.
 */
export type ComparisonRow = {
  /** Ключ словаря — что именно мы делаем. */
  label: DevhubKey;
  /** Возможность из /studio/capabilities. */
  cap: string;
  /** С чем сравниваем и почём — цены публичные, тарифы поставщиков. */
  rival: string;
  /** Месячная цена в долларах ЧИСЛОМ: итог считается из строк, а не рядом. */
  usd: number;
};

/**
 * Когда цены сверялись с публичными страницами поставщиков. Дата стоит здесь, а
 * не только в переводе сноски: строку человек читает, а число проверяет сторож.
 *
 * Сверка 08.09.2026 (шесть из семи совпали, одна нет):
 *   Lovable Pro $25 · Runway Pro $35 · Midjourney Standard $30 ·
 *   ElevenLabs Creator $22 · Meshy Pro $20 · Vercel Pro $20 — как было;
 *   Suno Pro — СТАЛО $8, у нас стояло $10, то есть мы завышали конкурента
 *   в свою пользу. Такое находят и предъявляют публично, поэтому исправлено.
 *
 * Перепроверяя цены, поменяй ЭТУ дату и все три перевода сноски value.priceNote.
 */
export const PRICES_CHECKED_AT = "2026-09-08";

export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  { label: "cmp.app", cap: "code", rival: "Lovable Pro", usd: 25 },
  { label: "cmp.video", cap: "video", rival: "Runway Pro", usd: 35 },
  { label: "cmp.images", cap: "image", rival: "Midjourney Standard", usd: 30 },
  { label: "cmp.voice", cap: "audio_tts", rival: "ElevenLabs Creator", usd: 22 },
  { label: "cmp.music", cap: "audio_music", rival: "Suno Pro", usd: 8 },
  { label: "cmp.threeD", cap: "3d", rival: "Meshy Pro", usd: 20 },
  { label: "cmp.hosting", cap: "pages", rival: "Vercel Pro", usd: 20 },
];

/**
 * Отмечать строку как неработающую можно, только если мы ЗНАЕМ, что она не
 * работает. Ручка не ответила, возможности ещё не пришли, идентификатора нет в
 * списке — это «не знаю», и обвинять собственную возможность на основании
 * незнания нельзя: пустая полоса на витрине читается как поломка.
 */
export function capabilityIsKnownOff(
  caps: ReadonlyArray<{ id: string; status: string }> | null | undefined,
  capId: string,
): boolean {
  if (!caps || caps.length === 0) return false;
  const found = caps.find((c) => c.id === capId);
  if (!found) return false;
  return found.status !== "live";
}

/**
 * Итог считается ИЗ СТРОК. Раньше «≈ $162» стояло в разметке отдельным числом —
 * второй ответ о том же самом, который расходится при первой же правке цены.
 */
export function comparisonTotalUsd(rows: readonly ComparisonRow[] = COMPARISON_ROWS): number {
  return rows.reduce((sum, r) => sum + r.usd, 0);
}
