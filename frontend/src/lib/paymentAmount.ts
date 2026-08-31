/**
 * Одно место, где живёт ответ «сколько минорных единиц в валюте».
 *
 * ЗАЧЕМ. Платёжный API объявляет суммы в МИНОРНЫХ единицах — так написано и в
 * спеке («Minor units of the chosen currency»), и в собственном сообщении об
 * ошибке («amount must be a positive number (minor units)»), и пример в спеке
 * это подтверждает: 9900. А страница оплаты печатала это число как есть, с
 * двумя знаками после запятой, то есть показывала покупателю $9 900.00 там,
 * где продавец выставил $99.00 — цену в СТО РАЗ больше.
 *
 * Расходились две наши собственные стороны: контракт и экран. Верна сторона
 * контракта — её повторяет и сам код при проверке входа.
 */
export type PaymentCurrency = "USD" | "EUR" | "KZT" | "AEC";

/**
 * AEC — наш собственный знак, он всегда считался целыми единицами, и экран
 * печатал его без дробной части. Оснований менять это нет, поэтому 0 здесь
 * не умолчание, а решение. У ISO-валют показатель настоящий: у тенге тоже
 * есть сотая доля (тиын), и контракт распространяется на «выбранную валюту»
 * без исключений.
 */
export const MINOR_UNIT_DIGITS: Record<PaymentCurrency, number> = {
  USD: 2,
  EUR: 2,
  KZT: 2,
  AEC: 0,
};

export function minorUnitDigits(currency: string): number {
  // Поиск по объекту служебным словом ("constructor", "__proto__") вернул бы
  // не число, а функцию из прототипа, и деление дало бы NaN на экране цены.
  return Object.hasOwn(MINOR_UNIT_DIGITS, currency)
    ? MINOR_UNIT_DIGITS[currency as PaymentCurrency]
    : 2;
}

/**
 * Обратное преобразование: то, что ввёл человек, — в минорные единицы.
 *
 * ЗАЧЕМ. Показ и ввод обязаны считать одинаково, иначе цена «чинится» на
 * одном конце и ломается на другом. 31.08.2026 так и вышло: панель ссылок
 * отправляла в API `parseFloat("99.00")` = 99, то есть ДОЛЛАРЫ, при том что
 * контракт API объявляет минорные единицы («amount must be a positive number
 * (minor units)», пример в спецификации — 9900). Пока показ печатал число как
 * есть, ссылки из панели выглядели верно, а ссылки из API — в сто раз дороже.
 * Починка показа поменяла местами, кто именно врёт.
 *
 * Верна сторона контракта, поэтому исправлен производитель: панель теперь
 * шлёт минорные единицы, и обе стороны считают одинаково.
 */
export function toMinorUnits(value: number, currency: string): number {
  return Math.round(value * 10 ** minorUnitDigits(currency));
}

export function formatPaymentAmount(minor: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  const value = minor / 10 ** digits;
  const дробные = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (currency === "AEC") return `${value.toLocaleString("en-US", дробные)} AEC`;
  if (currency === "KZT") return `${value.toLocaleString("ru-RU", дробные)} ₸`;
  return `${currency === "EUR" ? "€" : "$"}${value.toLocaleString("en-US", дробные)}`;
}
