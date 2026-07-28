/**
 * Что витрина имеет право обещать про оплату — и в каком виде показывать цену.
 *
 * 28.07.2026, замер на проде: `/api/pricing/checkout/healthz` отвечал
 * `paybox.configured: false`, а страница при выборе KZT писала «локальные карты
 * КЗ + Kaspi (PayBox)». POST на `/api/pricing/checkout/session` с
 * `currency: "KZT"` и без неё возвращал одного и того же провайдера —
 * lemonsqueezy. То есть выбор тенге не менял ничего, кроме текста на экране:
 * покупатель читал про Kaspi, а попадал на долларовый чекаут.
 *
 * Второй конец той же ошибки — сама цена. Курс в CURRENCY_RATES зашит в коде
 * (KZT 470), списание идёт в USD. «₸11 280» без пометки читается как сумма,
 * которую спишут; спишут $24 по курсу банка покупателя.
 *
 * Обе решения вынесены сюда, а не оставлены в разметке, чтобы их можно было
 * проверить прогоном, а не чтением файла.
 */

export type PaymentNoteKey = "kztNote" | "usdNote" | "fxNote";

/**
 * @param payboxLive `null` — ещё не спросили у бэкенда. Неизвестность
 *   трактуется как «канала нет»: обещать Kaspi авансом хуже, чем промолчать.
 */
export function paymentNoteKey(currency: string, payboxLive: boolean | null): PaymentNoteKey {
  if (currency === "KZT" && payboxLive === true) return "kztNote";
  if (currency === "USD") return "usdNote";
  return "fxNote";
}

/** Цена в валюте, отличной от валюты списания, помечается как пересчёт. */
export function formatDisplayPrice(amount: string, currency: string): string {
  return currency === "USD" ? amount : `≈ ${amount}`;
}
