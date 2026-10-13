/**
 * Заголовок первого экрана /devhub повторяет обещание ролика или поста, с которого
 * человек пришёл (метка ?c=), на языке читателя. Без метки — общее обещание.
 *
 * Повод 13.10.2026 (разрез devhubUshliBezShaga): 12 живых за сутки открыли /devhub
 * и ушли без единого шага — десять со стола, днём. Кадр первого экрана по метке
 * yt-devhub-1: первые 2 секунды человек видел навигацию планеты и слово «DevHub»,
 * тогда как ролик обещал «сайт кофейни — от слов до живого адреса». Поле уже было
 * заполнено примером и кнопка стояла в кадре — не хватало только заголовка.
 *
 * Ключ обещания — ПОСТ метки после разбора (`postFrom`): `yt-devhub-1`/`li-devhub-1`
 * дают пост `devhub-1`, `x-devhub-1` — пост `1`, автомойка в X — `avto-1`. Поэтому
 * нормализуем пост, а канал не смотрим: обещание принадлежит ролику, не площадке.
 */
export type ЯзыкОбещания = "ru" | "en" | "kk";

export type Obeshchanie = {
  /** Заголовок первого экрана. */
  h1: string;
  /** Пример запроса, который кладётся в поле (отправляемый, не плейсхолдер). null — пример словаря. */
  primer: string | null;
  /** Какое обещание сработало: номер ролика или "общее". Для приёмки и отладки. */
  istochnik: string;
};

const ОБЩЕЕ: Record<ЯзыкОбещания, string> = {
  ru: "Сайт по описанию — до живого адреса за минуту",
  en: "A site from a description — a live address in a minute",
  kk: "Сипаттама бойынша сайт — бір минутта тірі мекенжайға дейін",
};

/** Обещания роликов DevHub (папка 13-Бренд-медиа-реклама/2026-10-12-РОЛИКИ-DevHub). */
const ПО_РОЛИКАМ: Record<string, Record<ЯзыкОбещания, { h1: string; primer: string | null }>> = {
  // ролик 1: сайт кофейни за 80 секунд
  "1": {
    ru: { h1: "Сайт кофейни — от слов до живого адреса", primer: "лендинг кофейни с меню, часами работы и картой проезда" },
    en: { h1: "A coffee-shop site — from words to a live address", primer: "coffee shop landing page with a menu, opening hours and a map" },
    kk: { h1: "Кофехана сайты — сөзден тірі мекенжайға дейін", primer: "мәзірі, жұмыс уақыты және картасы бар кофехана лендингі" },
  },
  // ролик 3: ИИ оставил «[Название кофейни]» — починили словами
  "3": {
    ru: { h1: "ИИ ошибся — починили словами за минуту", primer: "лендинг кофейни с меню, часами работы и картой проезда" },
    en: { h1: "The AI slipped — fixed with words in a minute", primer: "coffee shop landing page with a menu, opening hours and a map" },
    kk: { h1: "ЖИ қателесті — сөзбен бір минутта түзеттік", primer: "мәзірі, жұмыс уақыты және картасы бар кофехана лендингі" },
  },
  // ролик 4: визитка мастера маникюра
  "4": {
    ru: { h1: "Визитка мастера маникюра — из одной фразы", primer: "визитка мастера маникюра: услуги с ценами, фото работ, запись по телефону" },
    en: { h1: "A nail artist's card — from one sentence", primer: "nail artist's card: services with prices, photos of work, booking by phone" },
    kk: { h1: "Маникюр шеберінің визиткасы — бір сөйлемнен", primer: "маникюр шеберінің визиткасы: бағасы бар қызметтер, жұмыс фотолары, телефон арқылы жазылу" },
  },
  // ролик 5: автомойка — цены не выдуманы
  "5": {
    ru: { h1: "Сайт автомойки — цены не выдуманы", primer: "страница автомойки: услуги с ценами, часы работы, запись по телефону" },
    en: { h1: "A car-wash site — no made-up prices", primer: "car wash page: services with prices, opening hours, booking by phone" },
    kk: { h1: "Автожуу сайты — бағалар ойдан шығарылмаған", primer: "автожуу беті: бағасы бар қызметтер, жұмыс уақыты, телефон арқылы жазылу" },
  },
};

/** Номер ролика из поста метки: devhub-1 / 1 → "1"; avto-1 → "5"; иное — null. */
export function nomerRolika(post: string | null | undefined): string | null {
  const p = String(post ?? "").trim().toLowerCase();
  if (!p) return null;
  if (p === "avto-1") return "5";
  const m = /^(?:devhub-)?([1345])$/.exec(p);
  return m ? m[1] : null;
}

export function yazykObeshchaniya(lang: string | null | undefined): ЯзыкОбещания {
  return lang === "en" || lang === "kk" ? lang : "ru";
}

export function zagolovokPoMetke(lang: string | null | undefined, post: string | null | undefined): Obeshchanie {
  const я = yazykObeshchaniya(lang);
  const номер = nomerRolika(post);
  const запись = номер ? ПО_РОЛИКАМ[номер]?.[я] : undefined;
  if (запись) return { h1: запись.h1, primer: запись.primer, istochnik: `ролик-${номер}` };
  return { h1: ОБЩЕЕ[я], primer: null, istochnik: "общее" };
}
