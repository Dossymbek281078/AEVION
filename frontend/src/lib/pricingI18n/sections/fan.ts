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
    "fan.pick": "Прикиньте: что у вас уже есть?",
    "fan.pick.note":
      "Это предварительный расчёт. Скидка применится к счёту после входа — покупки мы сверяем у себя, а не по отметкам на этой странице.",
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
    "fan.quote.cta": "цена по запросу →",
    "fan.quote.tooltip": "{module} пока не продаётся поштучно — оставьте заявку, ответим с ценой и условиями",
    "fan.appsUnavailable": "Часть покупок сейчас проверить не удалось — веер может быть неполным. Обновите страницу через минуту.",
    "fan.termsLink": "Условия веера →",
    "fan.terms.title": "Веерная скидка",
    "fan.terms.body":
      "Покупка платного модуля открывает скидку на соседние модули на 14 дней. Скидка действует только на модули, покупаемые отдельно, — на цену тарифов Lite / Medium / Full / Universe она не распространяется.",
    "fan.terms.b1": "Глубина зависит от близости: прямой контур — до −45%, тот же домен — до −30%, остальные модули идут по прайсу. У модулей с оплатой за каждый вызов (AI-генерация, рендеры) максимальная скидка — 30%.",
    "fan.terms.b2": "Каждый следующий купленный модуль поднимает уровень веера и увеличивает скидку на 5 процентных пунктов, до пятого уровня.",
    "fan.terms.b3": "Окно 14 дней считается от покупки и открывается заново с каждой НОВОЙ покупкой. Автоматическое продление действующей подписки окно не открывает.",
    "fan.terms.b4": "Цена, купленная по вееру, фиксируется на весь оплаченный период: при годовой оплате — на год, при месячной — на месяц.",
    "fan.terms.b5": "Веерная скидка вместе с промокодом не превышает 50% суммы заказа; при превышении урезается промокод. На отдельных каналах оплаты скидка может быть недоступна — итоговая сумма к списанию всегда показана до оплаты.",
    "fan.paywall.title": "У вас открыт веер",
    "fan.paywall.offer": "{module} по вееру — {cur}{price}/мес вместо {cur}{list}",
  },
  en: {
    "fan.badge": "FAN DISCOUNT",
    "fan.title": "One product unlocks a discount on its neighbours",
    "fan.subtitle":
      "Buying any module opens the fan: direct circuit up to −45%, same domain up to −30%. Every next module raises the fan level. The fan stays open {days} days from your last purchase and renews with a new one.",
    "fan.pick": "Try it: what do you already own?",
    "fan.pick.note":
      "This is a preview. The discount is applied to your invoice after you sign in — we verify purchases on our side, not from the marks on this page.",
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
    "fan.quote.cta": "price on request →",
    "fan.quote.tooltip": "{module} isn't sold à-la-carte yet — request a quote and we'll reply with pricing and terms",
    "fan.appsUnavailable": "Some of your purchases could not be checked right now — the fan may be incomplete. Refresh in a minute.",
    "fan.termsLink": "Fan terms →",
    "fan.terms.title": "Fan discount",
    "fan.terms.body":
      "Buying a paid module opens a discount on neighbouring modules for 14 days. It applies only to modules bought individually — never to the price of the Lite / Medium / Full / Universe plans.",
    "fan.terms.b1": "Depth depends on proximity: direct circuit up to −45%, same domain up to −30%, everything else stays at list price. Modules billed per call (AI generation, renders) are capped at 30%.",
    "fan.terms.b2": "Every additional module you own raises the fan level and adds 5 percentage points, up to level five.",
    "fan.terms.b3": "The 14-day window starts at purchase and reopens with every NEW purchase. Automatic renewal of an existing subscription does not reopen it.",
    "fan.terms.b4": "A price bought through the fan is locked for the whole paid period — a year on annual billing, a month on monthly.",
    "fan.terms.b5": "The fan discount combined with a promo code never exceeds 50% of the order; the promo code is trimmed first. On some payment channels the discount may be unavailable — the exact amount to be charged is always shown before payment.",
    "fan.paywall.title": "Your fan is open",
    "fan.paywall.offer": "{module} via the fan — {cur}{price}/mo instead of {cur}{list}",
  },
};
