/**
 * Галерея НАСТОЯЩИХ приложений, собранных в DevHub.
 *
 * Правило честности: сюда попадает только то, что реально собрано в DevHub
 * и живёт по публичному адресу. Список ПУСТ до появления первых живых
 * примеров — витрина секцию не рисует, и никакие выдуманные скриншоты или
 * адреса здесь появиться не могут (сторож в __tests__ проверяет форму).
 *
 * Как добавить пример: собрать приложение в DevHub, выкатить на Pages,
 * убедиться, что адрес отвечает, и вписать сюда фразу-запрос, которой оно
 * сделано, и живой адрес. Смоук страниц проверит адрес ежедневно.
 *
 * Языки: `title`/`prompt` — ОРИГИНАЛ (фраза, которой приложение реально
 * построено, по-русски). `en`/`kk` — переводы той же фразы для витрины:
 * посетитель с Show HN первым делом жмёт именно пример, и русская фраза
 * там читается как «не для меня». Кнопка «собрать похожее» подставляет
 * фразу на языке читателя — генерация работает на любом языке.
 */
export type DevhubExampleText = { title: string; prompt: string };

export type DevhubExample = DevhubExampleText & {
  /** Живой публичный адрес (*.pages.dev или *.aevion.build). */
  url: string;
  en: DevhubExampleText;
  kk: DevhubExampleText;
};

/** Текст карточки на языке читателя; оригинал (ru) — запасной вариант. */
export function exampleText(ex: DevhubExample, lang: string): DevhubExampleText {
  if (lang === "en") return ex.en;
  if (lang === "kk") return ex.kk;
  return { title: ex.title, prompt: ex.prompt };
}

// Все три собраны 06.09.2026 через ЖИВОЙ прод как обычный пользователь
// (гость → фраза → генерация → Pages), адреса проверены на 200 и на
// соответствие теме. Ежедневный смоук страниц держит их под наблюдением.
export const DEVHUB_EXAMPLES: DevhubExample[] = [
  {
    title: "Кофейня у моста",
    prompt: "лендинг кофейни с меню и формой брони",
    en: { title: "Coffee shop by the bridge", prompt: "a coffee shop landing page with a menu and a booking form" },
    kk: { title: "Көпір жанындағы кофехана", prompt: "мәзірі мен брондау формасы бар кофехана лендингі" },
    url: "https://465693ea.aevion-project-7760cf.pages.dev",
  },
  {
    title: "Портфолио фотографа",
    prompt: "портфолио фотографа с галереей и тёмной темой",
    en: { title: "Photographer's portfolio", prompt: "a photographer's portfolio with a gallery and a dark theme" },
    kk: { title: "Фотографтың портфолиосы", prompt: "галереясы мен қараңғы темасы бар фотограф портфолиосы" },
    url: "https://909ef2a1.aevion-project-af430e.pages.dev",
  },
  {
    title: "Афиша концерта",
    prompt: "афиша концерта с программой и картой проезда",
    en: { title: "Concert poster page", prompt: "a concert poster page with the program and a directions map" },
    kk: { title: "Концерт афишасы", prompt: "бағдарламасы мен жол картасы бар концерт афишасы" },
    url: "https://75d87932.aevion-project-b85b54.pages.dev",
  },
];
