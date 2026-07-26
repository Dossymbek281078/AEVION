/**
 * i18n словарь веерных скидок (FanDiscountPanel + веерная строка в
 * ModulePricingChip + веерный блок в paywall).
 *
 * Pattern: `{ ru, en }` — главный pricingI18n.ts подмешивает через spread.
 *
 * Почему секция появилась сразу, а не «потом»: панель веера родилась с жёстко
 * вшитым русским текстом, а платформа живёт на 11 языках через AutoTranslate.
 * Ровно так вышел баг `constitution`, где KK-переключатель переводил 20%
 * страницы — там ключи заводили после факта. Здесь их 18, а не 150.
 *
 * Подстановки: `{n}`, `{days}`, `{sum}`, `{cur}`, `{date}` — через vars у tp().
 */
export const fanDict: { ru: Record<string, string>; en: Record<string, string> } = {
  ru: {
    "fan.badge": "ВЕЕРНАЯ СКИДКА",
    "fan.title": "Один продукт открывает скидку на соседние",
    "fan.subtitle":
      "Покупка любого модуля включает веер: прямой контур — до −45%, тот же домен — до −30%. Каждый следующий модуль поднимает уровень веера. Веер открыт {days} дней с последней покупки и продлевается новой.",
    "fan.pick": "Отметьте, что у вас уже есть",
    "fan.loading": "Загружаем веер…",
    "fan.error": "Не удалось получить веер: {reason}",
    "fan.chip.opens": "веер {n}",
    "fan.chip.tooltip": "{module}: открывает {n} модулей прямого контура",
    "fan.level": "Уровень веера {n}",
    "fan.discountedCount": "со скидкой {n} модулей",
    "fan.maxSaving": "максимум экономии {cur}{sum}/мес",
    "fan.openUntil": "открыт до {date}",
    "fan.empty":
      "Для этого набора скидок нет — выбранные продукты не соседствуют ни с одним платным модулем.",
    "fan.ring.1": "Прямой контур",
    "fan.ring.2": "Тот же домен",
    "fan.ring.3": "Остальная планета",
    "fan.cogsCapped": "глубина ограничена себестоимостью вызовов",
    "fan.footnote":
      "Скидка веера фиксируется на оплаченный период; вместе с промокодом она не превышает 50% заказа.",
    "fan.module.opens": "веер: {n} модулей дешевле на {cur}{sum}/мес",
    "fan.module.loner": "самостоятельный модуль — веер не открывает",
    "fan.module.tooltip": "Покупка {module} включает веер: {list} со скидкой до −45%",
    "fan.paywall.title": "У вас открыт веер",
    "fan.paywall.offer": "{module} по вееру — {cur}{price}/мес вместо {cur}{list}",
  },
  en: {
    "fan.badge": "FAN DISCOUNT",
    "fan.title": "One product unlocks a discount on its neighbours",
    "fan.subtitle":
      "Buying any module opens the fan: direct circuit up to −45%, same domain up to −30%. Every next module raises the fan level. The fan stays open {days} days from your last purchase and renews with a new one.",
    "fan.pick": "Mark what you already own",
    "fan.loading": "Loading the fan…",
    "fan.error": "Could not load the fan: {reason}",
    "fan.chip.opens": "fan {n}",
    "fan.chip.tooltip": "{module}: unlocks {n} direct-circuit modules",
    "fan.level": "Fan level {n}",
    "fan.discountedCount": "{n} modules discounted",
    "fan.maxSaving": "up to {cur}{sum}/mo saved",
    "fan.openUntil": "open until {date}",
    "fan.empty":
      "No discounts for this set — the selected products don't neighbour any paid module.",
    "fan.ring.1": "Direct circuit",
    "fan.ring.2": "Same domain",
    "fan.ring.3": "Rest of the planet",
    "fan.cogsCapped": "depth capped by per-call cost",
    "fan.footnote":
      "The fan discount is locked for the paid period; combined with a promo code it never exceeds 50% of the order.",
    "fan.module.opens": "fan: {n} modules cheaper by {cur}{sum}/mo",
    "fan.module.loner": "standalone module — opens no fan",
    "fan.module.tooltip": "Buying {module} opens the fan: {list} at up to −45%",
    "fan.paywall.title": "Your fan is open",
    "fan.paywall.offer": "{module} via the fan — {cur}{price}/mo instead of {cur}{list}",
  },
};
