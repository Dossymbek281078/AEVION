/**
 * Источник трафика, доехавший до оплаты.
 *
 * Метка `?c=` со страницы `/go` подставляется в ссылку оплаты и возвращается
 * назад: у Gumroad — в `url_params` заказа, у LemonSqueezy — в
 * `meta.custom_data.channel` вебхука. Отвечает она на единственный вопрос,
 * ради которого метки заводились: какой канал окупается.
 *
 * ПОЧЕМУ БЕЛЫЙ СПИСОК, А НЕ ЛЮБАЯ СТРОКА. Значение приходит из адресной строки
 * браузера через сторонний процессинг — то есть его пишет кто угодно. Без
 * проверки в отчёт о выручке попадала бы произвольная строка постороннего
 * человека, а в файл подписок — то, что он захотел туда положить.
 *
 * Список совпадает с `CHANNELS` во фронтенде (`frontend/src/lib/products.ts`).
 * Дублирование сознательное: фронт и бэкенд собираются отдельно, общего пакета
 * между ними нет, а тянуть один ради восьми строк дороже, чем держать тест,
 * который ловит расхождение.
 */

/** Полные имена каналов — то, что видно в отчёте. */
export const TRAFFIC_CHANNELS = [
  "instagram",
  "tiktok",
  "threads",
  "youtube",
  "telegram",
  "facebook",
  "x",
  "qr-code",
] as const;

export type TrafficChannel = (typeof TRAFFIC_CHANNELS)[number];

const ALLOWED = new Set<string>(TRAFFIC_CHANNELS);

/**
 * Нормализует пришедшее значение в известный канал.
 *
 * Всё неизвестное → `null`, а не «сохраним как есть на всякий случай»:
 * непроверенная метка в отчёте о деньгах хуже отсутствующей, потому что
 * выглядит как факт.
 */
export function normalizeTrafficChannel(raw: unknown): TrafficChannel | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return ALLOWED.has(v) ? (v as TrafficChannel) : null;
}
