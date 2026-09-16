import { ALL_PRODUCTS } from "./products";
import { STANDALONE_APPS } from "./termPricing";

/**
 * Название товара по слагу, который пишет платёжный вебхук.
 *
 * ЗАЧЕМ. В кабинете, в блоке «Оплачено отдельно — доступ активен», слаг
 * выводился КАК ЕСТЬ. То есть человек, оплативший AEVION IP Bureau, видел у
 * себя плашку `ip_bureau`. Внутреннее слово на экране заплатившего — тот же
 * класс, что «Запустите бэкенд на :4001» на публичной странице.
 *
 * ПОЧЕМУ НЕ ПРОСТО ПОИСК ПО appId. Слаг рождается в бэкенде как
 * `ref.slice(4)` от ссылки варианта (`app_ip_bureau` -> `ip_bureau`), а в
 * каталоге у того же товара `appId: "aevion-ip-bureau"`. Для пяти приложений,
 * которые продаются отдельно, пары «слаг → id модуля» живут в STANDALONE_APPS
 * (`./termPricing`) — оттуда их и берём, вторую копию не заводим.
 *
 * ⚠️ СНЯТЫЕ С ПРОДАЖИ (15.09.2026). QPayNet, QContract, Smeta Trainer и
 * Constitution больше не продаются отдельно, их карточек в каталоге нет. Но
 * подписки, купленные ДО этого, доживают оплаченный период, и кабинет обязан
 * назвать их по-человечески. Поэтому названия снятых товаров — отдельным
 * списком, который НЕ продаёт ничего (цен и ссылок в нём нет).
 *
 * Проверка полноты — `__tests__/appSlugTitle.test.ts`: каждая ссылка вебхука
 * обязана разрешаться в название, молча показать сырой слаг снова не выйдет.
 */

/** Слаги, которые записаны в вебхуке иначе, чем appId в каталоге. */
const SLUG_ALIASES: Record<string, string> = {
  ...Object.fromEntries(STANDALONE_APPS.map((a) => [a.slug, a.moduleId])),
  smeta: "smeta-trainer",
  qpaynet: "qpaynet-embedded",
};

/** Названия товаров, снятых с отдельной продажи 15.09.2026, — по appId. */
const RETIRED_TITLES: Record<string, string> = {
  "qpaynet-embedded": "QPayNet",
  qcontract: "QContract",
  "smeta-trainer": "Smeta Trainer",
  constitution: "Constitution",
};

const own = <T,>(o: Record<string, T>, k: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;

/**
 * Возвращает название товара или сам слаг, если товар не найден.
 *
 * Запасной путь — слаг, а НЕ пустая строка и не «Неизвестный модуль»: человек
 * должен видеть хоть что-то опознаваемое, а мы — что список разошёлся.
 */
export function titleForAppSlug(slug: string): string {
  if (!slug) return slug;
  const appId = own(SLUG_ALIASES, slug) ?? slug;
  const found = ALL_PRODUCTS.find((m) => m.appId === appId);
  return found?.title ?? own(RETIRED_TITLES, appId) ?? slug;
}
