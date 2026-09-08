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
  price: string;
};

export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  { label: "cmp.app", cap: "code", rival: "Lovable Pro", price: "$25" },
  { label: "cmp.video", cap: "video", rival: "Runway Pro", price: "$35" },
  { label: "cmp.images", cap: "image", rival: "Midjourney Standard", price: "$30" },
  { label: "cmp.voice", cap: "audio_tts", rival: "ElevenLabs Creator", price: "$22" },
  { label: "cmp.music", cap: "audio_music", rival: "Suno", price: "$10" },
  { label: "cmp.threeD", cap: "3d", rival: "Meshy Pro", price: "$20" },
  { label: "cmp.hosting", cap: "pages", rival: "Vercel Pro", price: "$20" },
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
