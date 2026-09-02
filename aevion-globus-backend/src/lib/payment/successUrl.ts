import type { PaymentIntentInput } from "./provider";

/**
 * ОДИН адрес возврата после оплаты — на всех провайдеров.
 *
 * ЗАЧЕМ. Страница /pricing/checkout/success выбирает купленный продукт по
 * параметру appId, а класть его в адрес не умел НИ ОДИН провайдер. Значит
 * запасной вариант видел каждый покупатель: заплативший за QSign, QLearn или
 * QCoreAI читал «Pro активирован» и кнопку «Открыть QRight». Это первое, что
 * человек видит сразу после списания денег.
 *
 * Разошлись провайдеры потому, что адрес собирали ТРИЖДЫ и порознь: у Lemon
 * Squeezy свой помощник с tier и period, у PayBox и PayPal — строка с одним
 * лишь ref. Отсюда и вторая потеря: покупатель Lite из Казахстана читал «Pro
 * активирован», потому что тарифа в адресе не было вовсе.
 *
 * Поэтому здесь одно место, а не четвёртая копия. Прежние параметры (ref и
 * флаг провайдера) сохранены: их уже читают, и убрать их значило бы починить
 * одно и сломать другое.
 */
export function buildSuccessUrl(
  base: string,
  input: PaymentIntentInput,
  extra?: {
    provider?: string;
    intentId?: string;
    /** Флаги, которые прежние читатели ждут в адресе: paybox=1, paypal=1. */
    flags?: Record<string, string>;
  }
): string {
  const q = new URLSearchParams();
  if (extra?.provider) q.set("provider", extra.provider);
  if (extra?.intentId) q.set("intentId", extra.intentId);
  for (const [k, v] of Object.entries(extra?.flags ?? {})) q.set(k, v);
  if (input.reference) q.set("ref", input.reference);

  const m = /^tier_([a-z]+)_(monthly|annual)$/.exec(input.reference ?? "");
  if (m) {
    q.set("tier", m[1]);
    q.set("period", m[2]);
  }
  // Модуль передаётся ОТДЕЛЬНЫМ полем, а не через customData: customData
  // уезжает провайдеру и возвращается в вебхуке, и трогать его значило бы
  // менять выдачу прав ради подписи на экране.
  if (input.successAppId) q.set("appId", input.successAppId);
  if (typeof input.amountCents === "number") q.set("total", String(input.amountCents));

  return `${base}/pricing/checkout/success?${q.toString()}`;
}

/**
 * Адрес ОТМЕНЫ — симметрично успеху.
 *
 * 🔴 Находка соседнего окна 02.09.2026, проверена отрисовкой. Адреса отмены
 * собирались строкой мимо этого помощника и несли ровно метку кассы:
 *
 *     `${base}/pricing/checkout/cancel?paybox=1`
 *
 * А экран отмены рисует кнопку «вернуться к тарифу X» только при `tier` в
 * адресе. Значит кнопка есть в коде и НЕ ПОЯВЛЯЕТСЯ НИКОГДА — ровно у того
 * человека, которого ещё можно вернуть. Замер соседа: с `?paybox=1` на
 * экране три ссылки, с `?paybox=1&tier=lite` — те же плюс `/pricing/lite`.
 *
 * Метка кассы остаётся обязательной: по ней экран отличает НАСТОЯЩИЙ возврат
 * от захода по адресу из истории и не завышает долю брошенных оплат
 * (`cancelCountsOnlyRealReturns`). Поэтому она передаётся как и раньше, во
 * `flags`, а `ref`/`tier`/`period` добавляются рядом.
 *
 * Сумму и модуль сюда НЕ кладём: на экране отмены платежа не было, и число
 * рядом с «оплата отменена» читается как списание.
 */
export function buildCancelUrl(
  base: string,
  input: PaymentIntentInput,
  extra?: {
    provider?: string;
    /** Метки, которые экран отмены ждёт в адресе: paybox=1, paypal=1. */
    flags?: Record<string, string>;
  }
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(extra?.flags ?? {})) q.set(k, v);
  if (extra?.provider) q.set("provider", extra.provider);
  if (input.reference) q.set("ref", input.reference);

  const m = /^tier_([a-z]+)_(monthly|annual)$/.exec(input.reference ?? "");
  if (m) {
    q.set("tier", m[1]);
    q.set("period", m[2]);
  }

  return `${base}/pricing/checkout/cancel?${q.toString()}`;
}
