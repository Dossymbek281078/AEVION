/**
 * Словарь QStore (ru/en/kk): лента, карточка товара, форма «оплата скоро».
 *
 * До 05.11.2026 на ru/kk весь интерфейс магазина был английским («+ List a product»,
 * «Sort by», «No products yet»…), а одно сообщение об ошибке каталога — по-русски при
 * любом языке. Язык — из общего механизма сайта (`useI18nOptional`; вне провайдера —
 * английский, как раньше). Ключи задаёт EN; ru/kk — Record<Key> под tsc.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
import { useCallback } from "react";
import { useI18nOptional } from "@/lib/i18n";

const EN = {
  "hero.sub": "Digital marketplace — templates, code, music & more",
  "hero.list": "+ List a product",
  "close": "Close",
  "sort.label": "Sort by:",
  "sort.popular": "Most popular",
  "sort.newest": "Newest",
  "sort.trending": "Trending",
  "sort.rating": "Top rated",
  "cat.all": "All",
  "cat.template": "Templates",
  "cat.preset": "Presets",
  "cat.music": "Music",
  "cat.video": "Video",
  "cat.design": "Design",
  "cat.code": "Code",
  "cat.other": "Other",
  "search": "Search...",
  "search.aria": "Search",
  "free": "Free",
  "paySoon": "Payment soon — leave your email",
  "getFree": "Get free",
  "buy": "Buy",
  "buyNow": "Buy now",
  "buy.aria": "Buy: {title}",
  "getFree.aria": "Get free: {title}",
  "form.heading": "List a new product",
  "form.title": "Title",
  "form.titlePh": "Title *",
  "form.desc": "Description",
  "form.category": "Category",
  "form.price": "Price",
  "form.pricePh": "Price (USD, 0 = free)",
  "form.listing": "Listing...",
  "form.submit": "List product",
  "form.cancel": "Cancel",
  "featured": "✨ Featured",
  "featured.popular": "🔥 Popular",
  "featured.trending": "📈 Trending",
  "featured.newest": "🆕 New",
  "featured.topRated": "⭐ Top rated",
  "featured.empty": "Nothing here yet.",
  "count.one": "{n} product",
  "count.few": "{n} products",
  "count.many": "{n} products",
  "loading": "Loading products...",
  "err.catalogH": "Catalog failed to load",
  "err.catalog": "The catalog failed to load. This does not mean there are no products — try refreshing the page.",
  "empty.h": "No products yet",
  "empty.p": "Be the first to list one!",
  "n.signInBuy": "Sign in to purchase products.",
  "n.bought": "Purchase successful!",
  "n.gateway": "Payment gateway is being verified — available within 1-3 days. Write us at yahiin1978@gmail.com to purchase manually.",
  "n.buyFailed": "Purchase failed",
  "n.network": "Network error",
  "n.signInList": "Sign in to list products",
  "n.titleReq": "Title is required",
  "n.createFailed": "Failed to create",
  "n.signInReview": "Sign in to leave a review.",
  "n.added": "Added to your library!",
  "n.reviewPosted": "Review posted!",
  "n.reviewFailed": "Failed to post review",
  "d.loading": "Loading product...",
  "d.nfH": "Product not found",
  "d.nfP": "The product you're looking for doesn't exist or has been removed.",
  "d.back": "Back to QStore",
  "d.listed": "Listed {date}",
  "d.processing": "Processing...",
  "d.seller": "Seller:",
  "d.viewSeller": "View seller profile →",
  "d.reviews": "Reviews ({n})",
  "d.reviewsOne": "{n} review",
  "d.reviewsFew": "{n} reviews",
  "d.reviewsMany": "{n} reviews",
  "d.leave": "Leave a review",
  "d.stars": "{n} stars",
  "d.reviewPh": "Share your experience (optional)",
  "d.post": "Post review",
  "d.posting": "Posting...",
  "d.noReviews": "No reviews yet. Be the first to share your thoughts!",
  "nt.invalid": "Enter a valid email address.",
  "nt.failed": "Request failed ({status})",
  "nt.temp": "Saved only temporarily — our storage is down. Please also write to yahiin1978@gmail.com about «{title}».",
  "nt.done": "Done — we will write to {email} when payment for «{title}» opens.",
  "nt.network": "Network error — please try again.",
  "nt.note": "Payment for this product is not open yet. We will write once it is — nothing is charged now.",
  "nt.aria": "Email for payment notice",
  "nt.send": "Notify me",
  "nt.sending": "Sending…",
};

export type Key = keyof typeof EN;

const RU: Record<Key, string> = {
  "hero.sub": "Цифровой магазин — шаблоны, код, музыка и не только",
  "hero.list": "+ Добавить товар",
  "close": "Закрыть",
  "sort.label": "Сортировка:",
  "sort.popular": "Самые популярные",
  "sort.newest": "Новые",
  "sort.trending": "В тренде",
  "sort.rating": "С высоким рейтингом",
  "cat.all": "Все",
  "cat.template": "Шаблоны",
  "cat.preset": "Пресеты",
  "cat.music": "Музыка",
  "cat.video": "Видео",
  "cat.design": "Дизайн",
  "cat.code": "Код",
  "cat.other": "Другое",
  "search": "Поиск...",
  "search.aria": "Поиск",
  "free": "Бесплатно",
  "paySoon": "Оплата скоро — оставьте почту",
  "getFree": "Получить бесплатно",
  "buy": "Купить",
  "buyNow": "Купить сейчас",
  "buy.aria": "Купить: {title}",
  "getFree.aria": "Получить бесплатно: {title}",
  "form.heading": "Добавить новый товар",
  "form.title": "Название",
  "form.titlePh": "Название *",
  "form.desc": "Описание",
  "form.category": "Категория",
  "form.price": "Цена",
  "form.pricePh": "Цена (USD, 0 = бесплатно)",
  "form.listing": "Добавляем…",
  "form.submit": "Добавить товар",
  "form.cancel": "Отмена",
  "featured": "✨ Подборка",
  "featured.popular": "🔥 Популярное",
  "featured.trending": "📈 В тренде",
  "featured.newest": "🆕 Новинки",
  "featured.topRated": "⭐ Лучшие по рейтингу",
  "featured.empty": "Здесь пока ничего нет.",
  "count.one": "{n} товар",
  "count.few": "{n} товара",
  "count.many": "{n} товаров",
  "loading": "Загружаем товары…",
  "err.catalogH": "Каталог не загрузился",
  "err.catalog": "Каталог не загрузился. Это не значит, что товаров нет — попробуйте обновить страницу.",
  "empty.h": "Товаров пока нет",
  "empty.p": "Станьте первым — добавьте свой!",
  "n.signInBuy": "Войдите, чтобы покупать товары.",
  "n.bought": "Покупка оформлена!",
  "n.gateway": "Платёжный шлюз проходит проверку — заработает в течение 1–3 дней. Напишите нам на yahiin1978@gmail.com, чтобы купить вручную.",
  "n.buyFailed": "Не удалось оформить покупку",
  "n.network": "Нет связи с сервером",
  "n.signInList": "Войдите, чтобы добавлять товары",
  "n.titleReq": "Нужно название",
  "n.createFailed": "Не удалось добавить товар",
  "n.signInReview": "Войдите, чтобы оставить отзыв.",
  "n.added": "Добавлено в вашу библиотеку!",
  "n.reviewPosted": "Отзыв опубликован!",
  "n.reviewFailed": "Не удалось опубликовать отзыв",
  "d.loading": "Загружаем товар…",
  "d.nfH": "Товар не найден",
  "d.nfP": "Такого товара нет, или его удалили.",
  "d.back": "Назад в QStore",
  "d.listed": "Добавлен {date}",
  "d.processing": "Обрабатываем…",
  "d.seller": "Продавец:",
  "d.viewSeller": "Профиль продавца →",
  "d.reviews": "Отзывы ({n})",
  "d.reviewsOne": "{n} отзыв",
  "d.reviewsFew": "{n} отзыва",
  "d.reviewsMany": "{n} отзывов",
  "d.leave": "Оставить отзыв",
  "d.stars": "Оценка: {n} из 5",
  "d.reviewPh": "Поделитесь впечатлениями (необязательно)",
  "d.post": "Отправить отзыв",
  "d.posting": "Отправляем…",
  "d.noReviews": "Отзывов пока нет. Станьте первым!",
  "nt.invalid": "Введите корректный адрес почты.",
  "nt.failed": "Запрос не удался ({status})",
  "nt.temp": "Сохранено только временно — наше хранилище недоступно. Напишите также на yahiin1978@gmail.com про «{title}».",
  "nt.done": "Готово — мы напишем на {email}, когда откроется оплата «{title}».",
  "nt.network": "Нет связи с сервером — попробуйте ещё раз.",
  "nt.note": "Оплата этого товара пока не открыта. Мы напишем, как только откроется — сейчас ничего не списывается.",
  "nt.aria": "Почта для уведомления об оплате",
  "nt.send": "Сообщить мне",
  "nt.sending": "Отправляем…",
};

const KK: Record<Key, string> = {
  "hero.sub": "Цифрлық дүкен — үлгілер, код, музыка және т.б.",
  "hero.list": "+ Тауар қосу",
  "close": "Жабу",
  "sort.label": "Сұрыптау:",
  "sort.popular": "Ең танымал",
  "sort.newest": "Жаңалары",
  "sort.trending": "Тренд",
  "sort.rating": "Рейтингі жоғары",
  "cat.all": "Барлығы",
  "cat.template": "Үлгілер",
  "cat.preset": "Пресеттер",
  "cat.music": "Музыка",
  "cat.video": "Бейне",
  "cat.design": "Дизайн",
  "cat.code": "Код",
  "cat.other": "Басқа",
  "search": "Іздеу...",
  "search.aria": "Іздеу",
  "free": "Тегін",
  "paySoon": "Төлем жақында — поштаңызды қалдырыңыз",
  "getFree": "Тегін алу",
  "buy": "Сатып алу",
  "buyNow": "Қазір сатып алу",
  "buy.aria": "Сатып алу: {title}",
  "getFree.aria": "Тегін алу: {title}",
  "form.heading": "Жаңа тауар қосу",
  "form.title": "Атауы",
  "form.titlePh": "Атауы *",
  "form.desc": "Сипаттама",
  "form.category": "Санат",
  "form.price": "Бағасы",
  "form.pricePh": "Бағасы (USD, 0 = тегін)",
  "form.listing": "Қосылуда…",
  "form.submit": "Тауар қосу",
  "form.cancel": "Бас тарту",
  "featured": "✨ Таңдаулылар",
  "featured.popular": "🔥 Танымал",
  "featured.trending": "📈 Тренд",
  "featured.newest": "🆕 Жаңа",
  "featured.topRated": "⭐ Үздік рейтинг",
  "featured.empty": "Әзірге мұнда ештеңе жоқ.",
  "count.one": "{n} тауар",
  "count.few": "{n} тауар",
  "count.many": "{n} тауар",
  "loading": "Тауарлар жүктелуде…",
  "err.catalogH": "Каталог жүктелмеді",
  "err.catalog": "Каталог жүктелмеді. Бұл тауар жоқ дегенді білдірмейді — бетті жаңартып көріңіз.",
  "empty.h": "Әзірге тауар жоқ",
  "empty.p": "Бірінші болыңыз — өз тауарыңызды қосыңыз!",
  "n.signInBuy": "Тауар сатып алу үшін кіріңіз.",
  "n.bought": "Сатып алу рәсімделді!",
  "n.gateway": "Төлем шлюзі тексерілуде — 1–3 күн ішінде іске қосылады. Қолмен сатып алу үшін yahiin1978@gmail.com мекенжайына жазыңыз.",
  "n.buyFailed": "Сатып алу рәсімделмеді",
  "n.network": "Сервермен байланыс жоқ",
  "n.signInList": "Тауар қосу үшін кіріңіз",
  "n.titleReq": "Атауы қажет",
  "n.createFailed": "Тауарды қосу мүмкін болмады",
  "n.signInReview": "Пікір қалдыру үшін кіріңіз.",
  "n.added": "Кітапханаңызға қосылды!",
  "n.reviewPosted": "Пікір жарияланды!",
  "n.reviewFailed": "Пікірді жариялау мүмкін болмады",
  "d.loading": "Тауар жүктелуде…",
  "d.nfH": "Тауар табылмады",
  "d.nfP": "Мұндай тауар жоқ немесе ол жойылған.",
  "d.back": "QStore-ға оралу",
  "d.listed": "Қосылған күні: {date}",
  "d.processing": "Өңделуде…",
  "d.seller": "Сатушы:",
  "d.viewSeller": "Сатушы профилі →",
  "d.reviews": "Пікірлер ({n})",
  "d.reviewsOne": "{n} пікір",
  "d.reviewsFew": "{n} пікір",
  "d.reviewsMany": "{n} пікір",
  "d.leave": "Пікір қалдыру",
  "d.stars": "Баға: 5-тен {n}",
  "d.reviewPh": "Әсеріңізбен бөлісіңіз (міндетті емес)",
  "d.post": "Пікір жіберу",
  "d.posting": "Жіберілуде…",
  "d.noReviews": "Әзірге пікір жоқ. Бірінші болыңыз!",
  "nt.invalid": "Дұрыс пошта мекенжайын енгізіңіз.",
  "nt.failed": "Сұрау орындалмады ({status})",
  "nt.temp": "Тек уақытша сақталды — қоймамыз қолжетімсіз. «{title}» туралы yahiin1978@gmail.com мекенжайына да жазыңыз.",
  "nt.done": "Дайын — «{title}» төлемі ашылғанда {email} мекенжайына жазамыз.",
  "nt.network": "Сервермен байланыс жоқ — қайтадан көріңіз.",
  "nt.note": "Бұл тауардың төлемі әлі ашылмаған. Ашылған бойда жазамыз — қазір ештеңе алынбайды.",
  "nt.aria": "Төлем туралы хабарлама үшін пошта",
  "nt.send": "Маған хабарлаңыз",
  "nt.sending": "Жіберілуде…",
};

const DICT: Partial<Record<string, Record<Key, string>>> = { en: EN, ru: RU, kk: KK };
const LOCALE: Record<string, string> = { ru: "ru-RU", en: "en-US", kk: "kk-KZ" };

export function tQstore(lang: string, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang]?.[key] ?? EN[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Форма числительного: ru — 1 / 2–4 / 5+ (11–14 — «много»); en — 1 / остальное; kk — одна форма. */
export function pluralForm(lang: string, n: number): "one" | "few" | "many" {
  if (lang === "ru") {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return "many";
    if (b === 1) return "one";
    if (b >= 2 && b <= 4) return "few";
    return "many";
  }
  return n === 1 ? "one" : "many";
}

export function qstoreLocale(lang: string): string {
  return LOCALE[lang] ?? "en-US";
}

export const QSTORE_KEYS = Object.keys(EN) as Key[];
export const QSTORE_DICT = DICT;

export function useQstoreT() {
  const lang = useI18nOptional()?.lang ?? "en";
  const t = useCallback((key: Key, vars?: Record<string, string | number>) => tQstore(lang, key, vars), [lang]);
  const count = useCallback(
    (base: "count" | "d.reviews", n: number) => {
      const f = pluralForm(lang, n);
      const k = (base === "count" ? `count.${f}` : `d.reviews${f === "one" ? "One" : f === "few" ? "Few" : "Many"}`) as Key;
      return tQstore(lang, k, { n });
    },
    [lang],
  );
  const catName = useCallback(
    (id: string) => {
      const k = `cat.${id}` as Key;
      return k in EN ? tQstore(lang, k) : id;
    },
    [lang],
  );
  return { t, count, catName, lang, locale: qstoreLocale(lang) };
}
