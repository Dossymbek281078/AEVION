/**
 * Словарь QNews (ru/en/kk).
 *
 * До 05.11.2026 страница смешивала языки: категории («Crypto», «Business»,
 * «Science», «World»), «Trending Now», «AI Summarize», «Loading articles...» —
 * по-английски, а шапка, форма публикации, закладки и дайджест — по-русски, при
 * любом выбранном языке. Язык — из общего механизма сайта (`useI18nOptional`).
 * Вне провайдера — русский, как был у страницы раньше (сторожа читают русские
 * строки). Ключи задаёт EN; ru/kk — Record<Key> под tsc.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
import { useCallback } from "react";
import { useI18nOptional } from "@/lib/i18n";

const EN = {
  "time.now": "just now",
  "time.min": "{n}m ago",
  "time.hour": "{n}h ago",
  "time.day": "{n}d ago",
  "cat.all": "All",
  "cat.tech": "Tech",
  "cat.crypto": "Crypto",
  "cat.ai": "AI",
  "cat.business": "Business",
  "cat.science": "Science",
  "cat.world": "World",
  "card.aiSummary": "AI Summary",
  "card.summarize": "✦ AI Summarize",
  "card.summarizing": "Summarizing...",
  "card.readOriginal": "Read Original",
  "card.source": "Source: {name}",
  "card.hnStats": "▲ {points} points · {comments} comments",
  "card.discussion": "Discussion",
  "trending": "Trending Now",
  "hero.sub": "Free feed of tech news from Hacker News — each item links to the original.",
  "hero.countOne": "{n} article",
  "hero.countFew": "{n} articles",
  "hero.countMany": "{n} articles",
  "hero.publish": "+ Publish",
  "form.title": "Publish an article",
  "form.f.title": "Title",
  "form.f.url": "Link",
  "form.f.source": "Source",
  "form.f.summary": "Summary",
  "form.category": "Category",
  "form.submit": "Publish",
  "form.submitting": "Publishing…",
  "form.cancel": "Cancel",
  "msg.signIn": "Sign in to publish articles",
  "msg.memory": "Accepted, but it could not be saved permanently right now — please send it again in a minute.",
  "msg.ok": "Article published!",
  "msg.fail": "Publishing error",
  "search.ph": "🔍 Search titles and descriptions…",
  "search.aria": "Search titles and descriptions",
  "bookmarks.title": "Show bookmarks only",
  "bookmarks": "🔖 Bookmarks",
  "bookmark.add": "Bookmark",
  "bookmark.remove": "Remove bookmark",
  "bookmark.addAria": "Bookmark: {title}",
  "bookmark.removeAria": "Remove from bookmarks: {title}",
  "loading": "Loading articles...",
  "empty.bookmarks": "No bookmarks yet — press 📎 on an article.",
  "empty.paywall": "The QNews feed is included in the “AEVION Planet” plan. Get access with the “Buy” button above — the articles will appear right away.",
  "empty.error": "Could not load the articles. Refresh the page — this is a connection failure, not an empty feed.",
  "empty.none": "No articles found",
  "digest.title": "🤖 AI digest of the day",
  "digest.refresh": "Refresh",
  "digest.hint": "Press “Refresh” for an AI digest of the current news.",
  "stats": "📊 Statistics",
  "board.title": "QNews concept board",
  "board.hint": "Which topics and sources should the feed cover? Which AI features are needed?",
  "board.idea": "Idea / source / feature",
  "board.ideaPh": "e.g.: a digest of 5 key niches every morning",
  "board.why": "Why it is needed",
  "board.whyPh": "What information-overload pain it solves",
  "board.author": "Nickname (optional)",
};

export type Key = keyof typeof EN;

const RU: Record<Key, string> = {
  "time.now": "только что",
  "time.min": "{n} мин назад",
  "time.hour": "{n} ч назад",
  "time.day": "{n} дн. назад",
  "cat.all": "Все",
  "cat.tech": "Технологии",
  "cat.crypto": "Крипто",
  "cat.ai": "ИИ",
  "cat.business": "Бизнес",
  "cat.science": "Наука",
  "cat.world": "В мире",
  "card.aiSummary": "Сводка ИИ",
  "card.summarize": "✦ Сводка от ИИ",
  "card.summarizing": "Готовим сводку…",
  "card.readOriginal": "Читать оригинал",
  "card.source": "Источник: {name}",
  "card.hnStats": "▲ {points} баллов · {comments} комментариев",
  "card.discussion": "Обсуждение",
  "trending": "Сейчас в тренде",
  "hero.sub": "Бесплатная лента технических новостей Hacker News — у каждой записи ссылка на оригинал.",
  "hero.countOne": "{n} статья",
  "hero.countFew": "{n} статьи",
  "hero.countMany": "{n} статей",
  "hero.publish": "+ Опубликовать",
  "form.title": "Опубликовать статью",
  "form.f.title": "Заголовок",
  "form.f.url": "Ссылка",
  "form.f.source": "Источник",
  "form.f.summary": "Краткое описание",
  "form.category": "Категория",
  "form.submit": "Опубликовать",
  "form.submitting": "Публикую…",
  "form.cancel": "Отмена",
  "msg.signIn": "Войдите чтобы публиковать статьи",
  "msg.memory": "Приняли, но сохранить насовсем сейчас не вышло — отправьте ещё раз через минуту.",
  "msg.ok": "Статья опубликована!",
  "msg.fail": "Ошибка публикации",
  "search.ph": "🔍 Поиск по заголовкам и описаниям…",
  "search.aria": "Поиск по заголовкам и описаниям",
  "bookmarks.title": "Показать только закладки",
  "bookmarks": "🔖 Закладки",
  "bookmark.add": "В закладки",
  "bookmark.remove": "Убрать из закладок",
  "bookmark.addAria": "В закладки: {title}",
  "bookmark.removeAria": "Убрать из закладок: {title}",
  "loading": "Загружаем статьи…",
  "empty.bookmarks": "Пока нет закладок — нажми 📎 на статье.",
  "empty.paywall": "Лента QNews входит в план «AEVION Планета». Оформите доступ кнопкой «Купить» выше — статьи появятся сразу.",
  "empty.error": "Не удалось загрузить статьи. Обновите страницу — это сбой связи, а не пустая лента.",
  "empty.none": "Статьи не найдены",
  "digest.title": "🤖 ИИ-дайджест дня",
  "digest.refresh": "Обновить",
  "digest.hint": "Нажмите «Обновить» для ИИ-дайджеста текущих новостей.",
  "stats": "📊 Статистика",
  "board.title": "Доска идей QNews",
  "board.hint": "Какие темы и источники должна покрывать лента? Какие функции ИИ нужны?",
  "board.idea": "Идея / источник / функция",
  "board.ideaPh": "напр.: дайджест по 5 ключевым нишам каждое утро",
  "board.why": "Зачем это нужно",
  "board.whyPh": "Какую боль информационного перегруза решает",
  "board.author": "Псевдоним (необязательно)",
};

const KK: Record<Key, string> = {
  "time.now": "жаңа ғана",
  "time.min": "{n} мин бұрын",
  "time.hour": "{n} сағ бұрын",
  "time.day": "{n} күн бұрын",
  "cat.all": "Барлығы",
  "cat.tech": "Технология",
  "cat.crypto": "Крипто",
  "cat.ai": "ЖИ",
  "cat.business": "Бизнес",
  "cat.science": "Ғылым",
  "cat.world": "Әлем",
  "card.aiSummary": "ЖИ қысқаша мазмұны",
  "card.summarize": "✦ ЖИ арқылы қысқаша мазмұн",
  "card.summarizing": "Қысқаша мазмұн дайындалуда…",
  "card.readOriginal": "Түпнұсқаны оқу",
  "card.source": "Дереккөз: {name}",
  "card.hnStats": "▲ {points} ұпай · {comments} пікір",
  "card.discussion": "Талқылау",
  "trending": "Қазір трендте",
  "hero.sub": "Hacker News техникалық жаңалықтарының тегін лентасы — әр жазбада түпнұсқаға сілтеме бар.",
  "hero.countOne": "{n} мақала",
  "hero.countFew": "{n} мақала",
  "hero.countMany": "{n} мақала",
  "hero.publish": "+ Жариялау",
  "form.title": "Мақаланы жариялау",
  "form.f.title": "Тақырып",
  "form.f.url": "Сілтеме",
  "form.f.source": "Дереккөз",
  "form.f.summary": "Қысқаша сипаттама",
  "form.category": "Санат",
  "form.submit": "Жариялау",
  "form.submitting": "Жариялануда…",
  "form.cancel": "Бас тарту",
  "msg.signIn": "Мақала жариялау үшін кіріңіз",
  "msg.memory": "Қабылданды, бірақ қазір біржола сақтау мүмкін болмады — бір минуттан соң қайта жіберіңіз.",
  "msg.ok": "Мақала жарияланды!",
  "msg.fail": "Жариялау қатесі",
  "search.ph": "🔍 Тақырыптар мен сипаттамалар бойынша іздеу…",
  "search.aria": "Тақырыптар мен сипаттамалар бойынша іздеу",
  "bookmarks.title": "Тек бетбелгілерді көрсету",
  "bookmarks": "🔖 Бетбелгілер",
  "bookmark.add": "Бетбелгіге қосу",
  "bookmark.remove": "Бетбелгіден алып тастау",
  "bookmark.addAria": "Бетбелгіге қосу: {title}",
  "bookmark.removeAria": "Бетбелгіден алып тастау: {title}",
  "loading": "Мақалалар жүктелуде…",
  "empty.bookmarks": "Әзірге бетбелгі жоқ — мақаладағы 📎 басыңыз.",
  "empty.paywall": "QNews таспасы «AEVION Планета» жоспарына кіреді. Жоғарыдағы «Сатып алу» батырмасымен қолжетімділікті рәсімдеңіз — мақалалар бірден шығады.",
  "empty.error": "Мақалаларды жүктеу мүмкін болмады. Бетті жаңартыңыз — бұл байланыс ақауы, таспа бос емес.",
  "empty.none": "Мақалалар табылмады",
  "digest.title": "🤖 Күннің ЖИ дайджесті",
  "digest.refresh": "Жаңарту",
  "digest.hint": "Ағымдағы жаңалықтардың ЖИ дайджесті үшін «Жаңарту» басыңыз.",
  "stats": "📊 Статистика",
  "board.title": "QNews идеялар тақтасы",
  "board.hint": "Лента қандай тақырыптар мен дереккөздерді қамтуы керек? Қандай ЖИ функциялары қажет?",
  "board.idea": "Идея / дереккөз / функция",
  "board.ideaPh": "мыс.: күн сайын 5 негізгі бағыт бойынша дайджест",
  "board.why": "Бұл не үшін керек",
  "board.whyPh": "Ақпарат артықтығы мәселесін қалай шешеді",
  "board.author": "Лақап ат (міндетті емес)",
};

const DICT: Partial<Record<string, Record<Key, string>>> = { en: EN, ru: RU, kk: KK };

export function tQnews(lang: string, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang]?.[key] ?? EN[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Время «N назад» — по языку, без зашитых «m ago». */
export function relativeTimeLang(lang: string, iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tQnews(lang, "time.now");
  if (mins < 60) return tQnews(lang, "time.min", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return tQnews(lang, "time.hour", { n: hrs });
  return tQnews(lang, "time.day", { n: Math.floor(hrs / 24) });
}

/** Число статей: ru — статья/статьи/статей; en — 1 / остальное; kk — одна форма. */
export function articlesCount(lang: string, n: number): string {
  let form: "One" | "Few" | "Many" = n === 1 ? "One" : "Many";
  if (lang === "ru") {
    const a = n % 100;
    const b = n % 10;
    form = a > 10 && a < 20 ? "Many" : b === 1 ? "One" : b >= 2 && b <= 4 ? "Few" : "Many";
  }
  return tQnews(lang, `hero.count${form}` as Key, { n });
}

export const QNEWS_KEYS = Object.keys(EN) as Key[];
export const QNEWS_DICT = DICT;

export function useQnewsT() {
  // Вне провайдера — русский: так страница выглядела до словаря, на нём стоят сторожа.
  const lang = useI18nOptional()?.lang ?? "ru";
  const t = useCallback((key: Key, vars?: Record<string, string | number>) => tQnews(lang, key, vars), [lang]);
  const catName = useCallback(
    (id: string) => {
      const k = `cat.${id}` as Key;
      return k in EN ? tQnews(lang, k) : id;
    },
    [lang],
  );
  return { t, catName, lang };
}
