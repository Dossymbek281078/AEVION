/**
 * Словарь QStore (ru/en/kk).
 *
 * До 28.10.2026 витрина, карточка товара, профиль продавца и форма «оплата скоро» были
 * целиком на английском при любом языке сайта, а ошибки сервера выводились сырыми кодами.
 * ЯЗЫК — из общего механизма (`useI18nOptional`), как у соседних модулей.
 * Категории сервер отдаёт id (template, preset, music, video, design, code, other) — имена
 * здесь по id; неизвестный id показывается как пришёл (catName).
 * Адреса почты в словарь НЕ вписаны (подставляются {mail} из страниц): сторожа
 * noNewDeadMailboxes / securityContactMatches ведут их по файлам страниц.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
import { useCallback } from "react";
import { useI18nOptional } from "@/lib/i18n";

const EN = {
  "cat.all": "All",
  "cat.template": "Templates",
  "cat.preset": "Presets",
  "cat.music": "Music",
  "cat.video": "Video",
  "cat.design": "Design",
  "cat.code": "Code",
  "cat.other": "Other",

  "sort.popular": "Most popular",
  "sort.newest": "Newest",
  "sort.trending": "Trending",
  "sort.rating": "Top rated",
  "sort.label": "Sort by:",
  "sort.aria": "Sort products",

  "price.free": "Free",

  "page.subtitle": "Digital goods marketplace: sellers list their own templates, presets, code, music and design.",
  "page.listBtn": "+ List a product",
  "page.searchPh": "Search…",
  "page.searchAria": "Search products",
  "page.count": "Products: {n}",
  "page.loading": "Loading products…",
  "page.loadFailTitle": "The catalog did not load",
  "page.loadFail": "The catalog did not load. This does not mean there are no products — try refreshing the page.",
  "page.emptyTitle": "No products for sale yet",
  "page.emptyBody": "QStore has just opened: sellers list their own digital products here — templates, presets, code, music, design. Nobody has listed one yet.",
  "page.emptyCta": "Become the first seller",
  "page.emptyFiltered": "Nothing found for this category or search.",
  "page.emptyReset": "Show all products",
  "page.close": "Close",

  "featured.heading": "✨ Featured",
  "featured.popular": "🔥 Popular",
  "featured.trending": "📈 Trending",
  "featured.newest": "🆕 New",
  "featured.topRated": "⭐ Top rated",
  "featured.empty": "Nothing in this selection yet.",

  "form.heading": "List a new product",
  "form.titleAria": "Product name",
  "form.titlePh": "Product name *",
  "form.descAria": "Description",
  "form.descPh": "Description",
  "form.categoryAria": "Category",
  "form.priceAria": "Price in USD",
  "form.pricePh": "Price (USD, 0 = free)",
  "form.paidHint": "Payment for paid products is not open yet: buyers will see “Payment soon” and can leave their email. Free products can be taken right away.",
  "form.submit": "List product",
  "form.submitting": "Listing…",
  "form.cancel": "Cancel",
  "form.signIn": "Sign in to list a product.",
  "form.titleRequired": "Enter the product name.",
  "form.fail": "Could not list the product. Try again in a minute.",
  "form.storage": "Storage is temporarily unavailable — the product was not saved. Try again later.",
  "form.done": "Product listed.",

  "card.paymentSoon": "Payment soon — leave your email",
  "card.getFree": "Get free",
  "card.getFreeAria": "Get free: {title}",
  "card.demo": "Demo, not for sale",

  "buy.signIn": "Sign in to get products.",
  "buy.done": "Added to your library.",
  "buy.processing": "Processing…",
  "buy.checkoutPending": "The payment gateway is being verified — available within 1–3 days. Write to {mail} to buy manually.",
  "buy.noProvider": "Payment is temporarily unavailable. Nothing was charged and the product was not issued.",
  "buy.notFound": "This product no longer exists.",
  "buy.fail": "Could not complete the request. Try again in a minute.",
  "net.error": "Network error — check your connection and try again.",

  "demo.badge": "Demo example — not for sale",
  "demo.hint": "This card only shows what a product page looks like. There is no file behind it and it cannot be bought.",

  "item.loading": "Loading product…",
  "item.notFound": "Product not found",
  "item.notFoundBody": "This product does not exist or has been removed.",
  "item.loadFail": "The product did not load. This does not mean it is gone — try refreshing the page.",
  "item.back": "Back to QStore",
  "item.listed": "Listed {date}",
  "item.reviewsShort": "reviews: {n}",
  "item.seller": "Seller:",
  "item.sellerProfile": "View seller profile →",
  "item.reviewsHeading": "Reviews ({n})",
  "item.leaveReview": "Leave a review",
  "item.stars": "{n} out of 5",
  "item.reviewAria": "Review text",
  "item.reviewPh": "Share your experience (optional)",
  "item.postReview": "Post review",
  "item.posting": "Posting…",
  "item.reviewPosted": "Review posted.",
  "item.reviewSignIn": "Sign in to leave a review.",
  "item.reviewFail": "Could not post the review. Try again in a minute.",
  "item.noReviews": "No reviews yet.",

  "seller.notFound": "Seller not found",
  "seller.notFoundBody": "This seller does not have any public products yet.",
  "seller.loadFail": "The seller profile did not load. Try refreshing the page.",
  "seller.crumb": "Seller",
  "seller.count": "products: {n}",
  "seller.products": "Products",
  "seller.payment": "Payment",
  "seller.paymentSoon": "Opens soon",
  "seller.avgRating": "Avg rating",
  "seller.byThis": "Products by this seller",
  "seller.nothing": "This seller has not published anything public yet.",
  "seller.avgPrice": "Average price of listings: {price}",

  "notify.heading": "Payment soon — leave your email",
  "notify.body": "Payment for this product is not open yet. We will write once it is — nothing is charged now.",
  "notify.emailAria": "Email for payment notice",
  "notify.send": "Notify me",
  "notify.sending": "Sending…",
  "notify.badEmail": "Enter a valid email address.",
  "notify.temp": "Saved only temporarily — our storage is down. Please also write to {mail} about «{title}».",
  "notify.done": "Done — we will write to {email} when payment for «{title}» opens.",
  "notify.fail": "Could not save the email. Try again in a minute.",
  "notify.net": "Network error — please try again.",
};

export type Key = keyof typeof EN;

const RU: Record<Key, string> = {
  "cat.all": "Все",
  "cat.template": "Шаблоны",
  "cat.preset": "Пресеты",
  "cat.music": "Музыка",
  "cat.video": "Видео",
  "cat.design": "Дизайн",
  "cat.code": "Код",
  "cat.other": "Другое",

  "sort.popular": "Популярные",
  "sort.newest": "Новые",
  "sort.trending": "В тренде",
  "sort.rating": "Лучшие оценки",
  "sort.label": "Сортировка:",
  "sort.aria": "Сортировка товаров",

  "price.free": "Бесплатно",

  "page.subtitle": "Маркетплейс цифровых товаров: продавцы выставляют свои шаблоны, пресеты, код, музыку и дизайн.",
  "page.listBtn": "+ Выставить товар",
  "page.searchPh": "Поиск…",
  "page.searchAria": "Поиск товаров",
  "page.count": "Товаров: {n}",
  "page.loading": "Загружаем товары…",
  "page.loadFailTitle": "Каталог не загрузился",
  "page.loadFail": "Каталог не загрузился. Это не значит, что товаров нет — попробуйте обновить страницу.",
  "page.emptyTitle": "Товаров в продаже пока нет",
  "page.emptyBody": "QStore только открылся: здесь продавцы выставляют свои цифровые товары — шаблоны, пресеты, код, музыку, дизайн. Пока никто ничего не выставил.",
  "page.emptyCta": "Стать первым продавцом",
  "page.emptyFiltered": "По этой категории или запросу ничего не нашлось.",
  "page.emptyReset": "Показать все товары",
  "page.close": "Закрыть",

  "featured.heading": "✨ Подборки",
  "featured.popular": "🔥 Популярное",
  "featured.trending": "📈 В тренде",
  "featured.newest": "🆕 Новое",
  "featured.topRated": "⭐ Лучшие оценки",
  "featured.empty": "В этой подборке пока пусто.",

  "form.heading": "Выставить новый товар",
  "form.titleAria": "Название товара",
  "form.titlePh": "Название товара *",
  "form.descAria": "Описание",
  "form.descPh": "Описание",
  "form.categoryAria": "Категория",
  "form.priceAria": "Цена в долларах США",
  "form.pricePh": "Цена (USD, 0 — бесплатно)",
  "form.paidHint": "Оплата платных товаров пока не открыта: покупатель увидит «Оплата скоро» и сможет оставить почту. Бесплатные товары можно забрать сразу.",
  "form.submit": "Выставить",
  "form.submitting": "Выставляем…",
  "form.cancel": "Отмена",
  "form.signIn": "Войдите, чтобы выставить товар.",
  "form.titleRequired": "Укажите название товара.",
  "form.fail": "Не удалось выставить товар. Попробуйте через минуту.",
  "form.storage": "Хранилище временно недоступно — товар не сохранён. Попробуйте позже.",
  "form.done": "Товар выставлен.",

  "card.paymentSoon": "Оплата скоро — оставьте почту",
  "card.getFree": "Забрать бесплатно",
  "card.getFreeAria": "Забрать бесплатно: {title}",
  "card.demo": "Демо, не продаётся",

  "buy.signIn": "Войдите, чтобы получать товары.",
  "buy.done": "Добавлено в вашу библиотеку.",
  "buy.processing": "Обрабатываем…",
  "buy.checkoutPending": "Платёжный шлюз проходит проверку — заработает в течение 1–3 дней. Чтобы купить вручную, напишите на {mail}.",
  "buy.noProvider": "Оплата временно недоступна. Деньги не списаны, товар не выдан.",
  "buy.notFound": "Этого товара больше нет.",
  "buy.fail": "Не удалось выполнить запрос. Попробуйте через минуту.",
  "net.error": "Ошибка сети — проверьте подключение и попробуйте ещё раз.",

  "demo.badge": "Демо-пример, не продаётся",
  "demo.hint": "Эта карточка только показывает, как выглядит страница товара. Файла за ней нет, купить его нельзя.",

  "item.loading": "Загружаем товар…",
  "item.notFound": "Товар не найден",
  "item.notFoundBody": "Такого товара нет или он снят с продажи.",
  "item.loadFail": "Товар не загрузился. Это не значит, что его нет — попробуйте обновить страницу.",
  "item.back": "Вернуться в QStore",
  "item.listed": "Выставлен {date}",
  "item.reviewsShort": "отзывов: {n}",
  "item.seller": "Продавец:",
  "item.sellerProfile": "Профиль продавца →",
  "item.reviewsHeading": "Отзывы ({n})",
  "item.leaveReview": "Оставить отзыв",
  "item.stars": "{n} из 5",
  "item.reviewAria": "Текст отзыва",
  "item.reviewPh": "Поделитесь впечатлением (необязательно)",
  "item.postReview": "Опубликовать отзыв",
  "item.posting": "Публикуем…",
  "item.reviewPosted": "Отзыв опубликован.",
  "item.reviewSignIn": "Войдите, чтобы оставить отзыв.",
  "item.reviewFail": "Не удалось опубликовать отзыв. Попробуйте через минуту.",
  "item.noReviews": "Отзывов пока нет.",

  "seller.notFound": "Продавец не найден",
  "seller.notFoundBody": "У этого продавца пока нет открытых товаров.",
  "seller.loadFail": "Профиль продавца не загрузился. Попробуйте обновить страницу.",
  "seller.crumb": "Продавец",
  "seller.count": "товаров: {n}",
  "seller.products": "Товары",
  "seller.payment": "Оплата",
  "seller.paymentSoon": "Скоро откроется",
  "seller.avgRating": "Средняя оценка",
  "seller.byThis": "Товары этого продавца",
  "seller.nothing": "Этот продавец пока ничего не выставил в открытый доступ.",
  "seller.avgPrice": "Средняя цена товаров: {price}",

  "notify.heading": "Оплата скоро — оставьте почту",
  "notify.body": "Оплата этого товара ещё не открыта. Напишем, когда откроется, — сейчас ничего не списывается.",
  "notify.emailAria": "Почта для уведомления об оплате",
  "notify.send": "Сообщить мне",
  "notify.sending": "Отправляем…",
  "notify.badEmail": "Введите правильный адрес почты.",
  "notify.temp": "Сохранено только временно — наше хранилище недоступно. Напишите, пожалуйста, ещё и на {mail} про «{title}».",
  "notify.done": "Готово — напишем на {email}, когда откроется оплата «{title}».",
  "notify.fail": "Не удалось сохранить почту. Попробуйте через минуту.",
  "notify.net": "Ошибка сети — попробуйте ещё раз.",
};

const KK: Record<Key, string> = {
  "cat.all": "Барлығы",
  "cat.template": "Үлгілер",
  "cat.preset": "Пресеттер",
  "cat.music": "Музыка",
  "cat.video": "Бейне",
  "cat.design": "Дизайн",
  "cat.code": "Бағдарлама коды",
  "cat.other": "Басқа",

  "sort.popular": "Ең танымал",
  "sort.newest": "Ең жаңа",
  "sort.trending": "Трендте",
  "sort.rating": "Ең жоғары баға",
  "sort.label": "Сұрыптау:",
  "sort.aria": "Тауарларды сұрыптау",

  "price.free": "Тегін",

  "page.subtitle": "Цифрлық тауарлар маркетплейсі: сатушылар өз үлгілерін, пресеттерін, кодын, музыкасын және дизайнын қояды.",
  "page.listBtn": "+ Тауар қою",
  "page.searchPh": "Іздеу…",
  "page.searchAria": "Тауарларды іздеу",
  "page.count": "Тауарлар: {n}",
  "page.loading": "Тауарлар жүктелуде…",
  "page.loadFailTitle": "Каталог жүктелмеді",
  "page.loadFail": "Каталог жүктелмеді. Бұл тауар жоқ дегенді білдірмейді — бетті жаңартып көріңіз.",
  "page.emptyTitle": "Сатылымда әзірге тауар жоқ",
  "page.emptyBody": "QStore енді ғана ашылды: мұнда сатушылар өз цифрлық тауарларын қояды — үлгілер, пресеттер, код, музыка, дизайн. Әзірге ешкім ештеңе қоймады.",
  "page.emptyCta": "Алғашқы сатушы болу",
  "page.emptyFiltered": "Бұл санат не сұрау бойынша ештеңе табылмады.",
  "page.emptyReset": "Барлық тауарды көрсету",
  "page.close": "Жабу",

  "featured.heading": "✨ Іріктемелер",
  "featured.popular": "🔥 Танымал",
  "featured.trending": "📈 Трендте",
  "featured.newest": "🆕 Жаңа",
  "featured.topRated": "⭐ Ең жоғары баға",
  "featured.empty": "Бұл іріктемеде әзірге бос.",

  "form.heading": "Жаңа тауар қою",
  "form.titleAria": "Тауар атауы",
  "form.titlePh": "Тауар атауы *",
  "form.descAria": "Сипаттама",
  "form.descPh": "Сипаттама",
  "form.categoryAria": "Санат",
  "form.priceAria": "АҚШ долларымен баға",
  "form.pricePh": "Баға (USD, 0 — тегін)",
  "form.paidHint": "Ақылы тауарлардың төлемі әлі ашылған жоқ: сатып алушы «Төлем жақында» деген жазуды көріп, поштасын қалдыра алады. Тегін тауарларды бірден алуға болады.",
  "form.submit": "Қою",
  "form.submitting": "Қойып жатырмыз…",
  "form.cancel": "Болдырмау",
  "form.signIn": "Тауар қою үшін кіріңіз.",
  "form.titleRequired": "Тауар атауын жазыңыз.",
  "form.fail": "Тауарды қою мүмкін болмады. Бір минуттан кейін қайталаңыз.",
  "form.storage": "Қойма уақытша қолжетімсіз — тауар сақталмады. Кейінірек қайталаңыз.",
  "form.done": "Тауар қойылды.",

  "card.paymentSoon": "Төлем жақында — поштаңызды қалдырыңыз",
  "card.getFree": "Тегін алу",
  "card.getFreeAria": "Тегін алу: {title}",
  "card.demo": "Демо, сатылмайды",

  "buy.signIn": "Тауар алу үшін кіріңіз.",
  "buy.done": "Кітапханаңызға қосылды.",
  "buy.processing": "Өңделуде…",
  "buy.checkoutPending": "Төлем шлюзі тексерілуде — 1–3 күн ішінде іске қосылады. Қолмен сатып алу үшін {mail} адресіне жазыңыз.",
  "buy.noProvider": "Төлем уақытша қолжетімсіз. Ақша алынған жоқ, тауар берілген жоқ.",
  "buy.notFound": "Бұл тауар енді жоқ.",
  "buy.fail": "Сұрауды орындау мүмкін болмады. Бір минуттан кейін қайталаңыз.",
  "net.error": "Желі қатесі — байланысты тексеріп, қайталаңыз.",

  "demo.badge": "Демо-үлгі, сатылмайды",
  "demo.hint": "Бұл карточка тек тауар беті қалай көрінетінін көрсетеді. Оның артында файл жоқ, оны сатып алу мүмкін емес.",

  "item.loading": "Тауар жүктелуде…",
  "item.notFound": "Тауар табылмады",
  "item.notFoundBody": "Мұндай тауар жоқ немесе ол сатылымнан алынды.",
  "item.loadFail": "Тауар жүктелмеді. Бұл оның жоқ екенін білдірмейді — бетті жаңартып көріңіз.",
  "item.back": "QStore-ға оралу",
  "item.listed": "Қойылған күні: {date}",
  "item.reviewsShort": "пікірлер: {n}",
  "item.seller": "Сатушы:",
  "item.sellerProfile": "Сатушы профилі →",
  "item.reviewsHeading": "Пікірлер ({n})",
  "item.leaveReview": "Пікір қалдыру",
  "item.stars": "5-тен {n}",
  "item.reviewAria": "Пікір мәтіні",
  "item.reviewPh": "Әсеріңізбен бөлісіңіз (міндетті емес)",
  "item.postReview": "Пікірді жариялау",
  "item.posting": "Жариялап жатырмыз…",
  "item.reviewPosted": "Пікір жарияланды.",
  "item.reviewSignIn": "Пікір қалдыру үшін кіріңіз.",
  "item.reviewFail": "Пікірді жариялау мүмкін болмады. Бір минуттан кейін қайталаңыз.",
  "item.noReviews": "Әзірге пікір жоқ.",

  "seller.notFound": "Сатушы табылмады",
  "seller.notFoundBody": "Бұл сатушының әзірге ашық тауарлары жоқ.",
  "seller.loadFail": "Сатушы профилі жүктелмеді. Бетті жаңартып көріңіз.",
  "seller.crumb": "Сатушы",
  "seller.count": "тауарлар: {n}",
  "seller.products": "Тауарлар",
  "seller.payment": "Төлем",
  "seller.paymentSoon": "Жақында ашылады",
  "seller.avgRating": "Орташа баға",
  "seller.byThis": "Осы сатушының тауарлары",
  "seller.nothing": "Бұл сатушы әзірге ашық түрде ештеңе қоймады.",
  "seller.avgPrice": "Тауарлардың орташа бағасы: {price}",

  "notify.heading": "Төлем жақында — поштаңызды қалдырыңыз",
  "notify.body": "Бұл тауардың төлемі әлі ашылған жоқ. Ашылғанда жазамыз — қазір ештеңе алынбайды.",
  "notify.emailAria": "Төлем туралы хабарлама үшін пошта",
  "notify.send": "Маған хабарлау",
  "notify.sending": "Жіберіп жатырмыз…",
  "notify.badEmail": "Дұрыс пошта адресін енгізіңіз.",
  "notify.temp": "Тек уақытша сақталды — қоймамыз қолжетімсіз. «{title}» туралы {mail} адресіне де жазыңызшы.",
  "notify.done": "Дайын — «{title}» төлемі ашылғанда {email} адресіне жазамыз.",
  "notify.fail": "Поштаны сақтау мүмкін болмады. Бір минуттан кейін қайталаңыз.",
  "notify.net": "Желі қатесі — қайталап көріңіз.",
};

const DICT: Partial<Record<string, Record<Key, string>>> = { en: EN, ru: RU, kk: KK };

export function tQ(lang: string, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang]?.[key] ?? EN[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Имя категории по id сервера; неизвестный id — как пришёл. */
export function catName(lang: string, id: string): string {
  const key = `cat.${id}`;
  return key in EN && id !== "all" ? tQ(lang, key as Key) : id;
}

export function localeOf(lang: string): string {
  return ({ ru: "ru-RU", en: "en-US", kk: "kk-KZ" } as Record<string, string>)[lang] ?? "en-US";
}

/** Цена в центах → строка на языке посетителя; 0 — «бесплатно». */
export function priceText(lang: string, cents: number, currency?: string): string {
  if (cents === 0) return tQ(lang, "price.free");
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat(localeOf(lang), { style: "currency", currency: code }).format(cents / 100);
  } catch {
    return `${code} ${(cents / 100).toFixed(2)}`;
  }
}

export function dateText(lang: string, iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(localeOf(lang));
}

export function useQStoreT() {
  const lang = useI18nOptional()?.lang ?? "en";
  const t = useCallback((key: Key, vars?: Record<string, string | number>) => tQ(lang, key, vars), [lang]);
  return { lang, t };
}

export const QSTORE_KEYS = Object.keys(EN) as Key[];
export const QSTORE_DICT = DICT;
