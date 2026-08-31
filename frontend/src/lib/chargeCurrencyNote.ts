/**
 * Чем на самом деле спишется — решение отдельно от страницы.
 *
 * Две находки 31.08.2026, обе про один экран цен:
 *
 *  1. Заметка «спишется в долларах» существовала и работала, но жила внутри
 *     блока, который включается ТОЛЬКО ссылкой с ?module=. Обычный посетитель
 *     переключал валюту на ₸, видел цены в тенге и не видел ни слова.
 *  2. Касса при недоступном PayBox уходит к запасным провайдерам, считающим в
 *     долларах, а страница уводила туда молча.
 *
 * Решение вынесено сюда, потому что страница цен в тестовой среде не
 * поднимается без полного слепка данных: подделывать её ради проверки текста
 * значит проверять подделку. Здесь же проверяется само правило.
 */

/** Ключ подписи под ценой: чем спишет касса при выбранной валюте. */
export function chargeCurrencyNoteKey(
  currency: string,
  payboxLive: boolean | null,
): string {
  if (currency !== "KZT") return "pricing.home.heroModule.usdNote";
  // Не спросили — не знаем. Ложное «Kaspi не подключён» отпугивает покупателя
  // в тенге ровно так же, как ложное обещание Kaspi его обманывает.
  if (payboxLive === null) return "pricing.home.heroModule.kztUnknownNote";
  return payboxLive
    ? "pricing.home.heroModule.kztNote"
    : "pricing.home.heroModule.kztFallbackNote";
}

/**
 * Нужно ли предупредить перед уходом в кассу.
 *
 * Поле необязательное: пока касса не присылает валюту, отсутствие данных это
 * НЕ «валюта совпала» — предупреждать не о чем, но и молчаливого согласия тут
 * нет. Второй клик после предупреждения считаем осознанным.
 */
export function shouldWarnAboutCurrency(input: {
  shown: string;
  fromCheckout: unknown;
  alreadyWarned: boolean;
}): boolean {
  const charged = typeof input.fromCheckout === "string" ? input.fromCheckout : null;
  if (!charged) return false;
  if (charged === input.shown) return false;
  return !input.alreadyWarned;
}
