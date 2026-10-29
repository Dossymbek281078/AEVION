/**
 * Словарь QMedia (ru/en/kk): /qmedia, /qmedia/music, /qmedia/videos, /qmedia/creative,
 * /qmedia/upload, /qmedia/playlists, /qmedia/likes.
 *
 * До 29.10.2026 модуль говорил смесью: на en upload/playlists/likes — по-русски, на ru/kk
 * витрина, музыка, видео и творческие инструменты — зашитым английским (замер прода
 * yazyk-qmedia-prod-981c-2910.log). ЯЗЫК — из общего механизма сайта (`useI18nOptional`);
 * язык без словаря → en. Каждая запись — тройка [en, ru, kk]: перевод нельзя забыть для
 * одного языка, тип это не пропустит. Ключи — латиницей (ключ-русская-строка удваивал бы
 * счёт храповика). Данные базы (названия треков, видео, плейлистов) НЕ переводятся;
 * значения жанров/категорий/настроений, что уходят на сервер, не меняются — переводится
 * только подпись (genreLabel/categoryLabel/moodLabel).
 *
 * ⚠️ kk — черновик, нужна вычитка носителя.
 */
import { useCallback } from "react";
import { useI18nOptional } from "@/lib/i18n";

const T = {
  // ── общее ─────────────────────────────────────────────────────────
  "common.all": ["All", "Все", "Барлығы"],
  "common.loading": ["Loading…", "Загрузка…", "Жүктелуде…"],
  "common.unknown": ["Unknown", "Неизвестен", "Белгісіз"],
  "common.save": ["Save", "Сохранить", "Сақтау"],
  "common.cancel": ["Cancel", "Отмена", "Болдырмау"],
  "common.delete": ["Delete", "Удалить", "Жою"],
  "common.close": ["Close", "Закрыть", "Жабу"],
  "common.title": ["Title *", "Название *", "Атауы *"],
  "common.titleA": ["Title", "Название", "Атауы"],
  "common.artist": ["Artist", "Исполнитель", "Орындаушы"],
  "common.genre": ["Genre", "Жанр", "Жанр"],
  "common.category": ["Category", "Категория", "Санат"],
  "common.mood": ["Mood", "Настроение", "Көңіл-күй"],
  "common.description": ["Description", "Описание", "Сипаттама"],
  "common.backModules": ["← Modules", "← Модули", "← Модульдер"],

  // ── ошибки (человеку — без сырого ответа сервера) ────────────────
  "err.signIn": ["Sign in to add", "Войдите, чтобы добавить", "Қосу үшін кіріңіз"],
  "err.saveFailed": ["Could not save, please try again", "Не удалось сохранить, попробуйте ещё раз", "Сақтау мүмкін болмады, қайталап көріңіз"],
  "err.deleteFailed": ["Could not delete, please try again", "Не удалось удалить, попробуйте ещё раз", "Жою мүмкін болмады, қайталап көріңіз"],
  "act.like": ["♡ Like", "♡ Нравится", "♡ Ұнайды"],
  "act.liked": ["♥ Liked", "♥ Нравится вам", "♥ Сізге ұнайды"],
  "act.toPlaylist": ["+ To playlist", "+ В плейлист", "+ Ойнату тізіміне"],
  "act.choosePlaylist": ["Choose a playlist", "Выберите плейлист", "Ойнату тізімін таңдаңыз"],
  "act.noPlaylists": ["No playlists yet — create one in Playlists", "Плейлистов пока нет — создайте в разделе «Плейлисты»", "Ойнату тізімдері әзірге жоқ — «Ойнату тізімдері» бөлімінде жасаңыз"],
  "act.added": ["Added to playlist", "Добавлено в плейлист", "Ойнату тізіміне қосылды"],
  "err.signInToLike": ["Sign in to like and build playlists", "Войдите, чтобы отмечать и собирать плейлисты", "Белгілеу және ойнату тізімін жинау үшін кіріңіз"],
  "err.titleRequired":["Enter a title", "Введите название", "Атауын енгізіңіз"],
  "err.genFailed": ["Could not generate, please try again", "Не удалось сгенерировать, попробуйте ещё раз", "Жасау мүмкін болмады, қайталап көріңіз"],
  "err.tooMany": ["Too many requests — wait a minute", "Слишком много запросов — подождите минуту", "Сұраныс тым көп — бір минут күтіңіз"],
  "err.network": ["Network unavailable", "Сеть недоступна", "Желі қолжетімсіз"],
  "err.loadFailed": ["Could not load. Refresh the page.", "Не удалось загрузить. Обновите страницу.", "Жүктеу мүмкін болмады. Бетті жаңартыңыз."],

  // ── жанры (значение на сервер не меняется) ────────────────────────
  "genre.pop": ["Pop", "Поп", "Поп"],
  "genre.rock": ["Rock", "Рок", "Рок"],
  "genre.electronic": ["Electronic", "Электроника", "Электроника"],
  "genre.classical": ["Classical", "Классика", "Классикалық"],
  "genre.jazz": ["Jazz", "Джаз", "Джаз"],
  "genre.hip-hop": ["Hip-hop", "Хип-хоп", "Хип-хоп"],
  "genre.folk": ["Folk", "Фолк", "Фолк"],
  "genre.rnb": ["R&B", "R&B", "R&B"],
  "genre.r&b": ["R&B", "R&B", "R&B"],
  "genre.country": ["Country", "Кантри", "Кантри"],
  "genre.other": ["Other", "Другое", "Басқа"],

  // ── категории видео ───────────────────────────────────────────────
  "vcat.tutorial": ["Tutorial", "Обучение", "Оқыту"],
  "vcat.music-video": ["Music video", "Клип", "Клип"],
  "vcat.short-film": ["Short film", "Короткий метр", "Қысқаметражды фильм"],
  "vcat.shortfilm": ["Short film", "Короткий метр", "Қысқаметражды фильм"],
  "vcat.documentary": ["Documentary", "Документальное", "Деректі"],
  "vcat.live": ["Live performance", "Живое выступление", "Тікелей орындау"],
  "vcat.other": ["Other", "Другое", "Басқа"],

  // ── настроения ────────────────────────────────────────────────────
  "mood.upbeat": ["Upbeat", "Бодрое", "Сергек"],
  "mood.melancholy": ["Melancholy", "Грустное", "Мұңды"],
  "mood.romantic": ["Romantic", "Романтичное", "Романтикалық"],
  "mood.energetic": ["Energetic", "Энергичное", "Қуатты"],
  "mood.calm": ["Calm", "Спокойное", "Сабырлы"],
  "mood.dark": ["Dark", "Мрачное", "Күңгірт"],
  "mood.hopeful": ["Hopeful", "С надеждой", "Үмітті"],
  "mood.happy": ["Happy", "Радостное", "Қуанышты"],
  "mood.sad": ["Sad", "Печальное", "Қайғылы"],

  // ── тип записи ────────────────────────────────────────────────────
  "type.track": ["track", "трек", "трек"],
  "type.video": ["video", "видео", "бейне"],

  // ── витрина /qmedia ───────────────────────────────────────────────
  "hub.tagline": ["Listen to music and watch videos, add your own by link; AI song lyrics and titles.", "Слушайте музыку и смотрите видео, добавляйте свои по ссылке; тексты и названия песен с ИИ.", "Музыка тыңдаңыз, бейне көріңіз, өзіңіздікін сілтеме арқылы қосыңыз; ЖИ арқылы ән мәтіні мен атаулары."],
  "hub.music.title": ["Music", "Музыка", "Музыка"],
  "hub.music.desc": ["Listen to tracks and add your own by link", "Слушайте треки и добавляйте свои по ссылке", "Тректерді тыңдаңыз, өзіңіздікін сілтеме арқылы қосыңыз"],
  "hub.videos.title": ["Videos", "Видео", "Бейне"],
  "hub.videos.desc": ["Watch videos and add your own by link", "Смотрите видео и добавляйте свои по ссылке", "Бейнелерді көріңіз, өзіңіздікін сілтеме арқылы қосыңыз"],
  "hub.creative.title": ["Creative", "Творчество", "Шығармашылық"],
  "hub.creative.desc": ["AI song lyrics and titles, colour palettes by mood", "Тексты и названия песен с ИИ, палитры по настроению", "ЖИ арқылы ән мәтіні мен атаулары, көңіл-күй палитралары"],
  "hub.live.title": ["Live", "Эфир", "Тікелей эфир"],
  "hub.live.desc": ["Planned, not available yet", "В плане, пока недоступно", "Жоспарда, әзірге қолжетімсіз"],
  "hub.open": ["Open →", "Открыть →", "Ашу →"],
  "hub.forYou": ["✨ For you", "✨ Для вас", "✨ Сізге арналған"],
  "hub.popular": ["🔥 Popular tracks", "🔥 Популярные треки", "🔥 Танымал тректер"],
  "hub.signInPersonal": ["Sign in to personalise", "Войдите, чтобы подборка стала личной", "Жеке іріктеме үшін кіріңіз"],
  "hub.trending": ["📈 Trending genres", "📈 Популярные жанры", "📈 Танымал жанрлар"],
  "hub.mostPlayed": ["🎵 Most played", "🎵 Чаще всего слушают", "🎵 Ең көп тыңдалғандар"],
  "hub.popularVideos": ["🎬 Popular videos", "🎬 Популярные видео", "🎬 Танымал бейнелер"],
  "hub.views.one": ["{n} view", "{n} просмотр", "{n} қаралым"],
  "hub.views.few": ["{n} views", "{n} просмотра", "{n} қаралым"],
  "hub.views.many": ["{n} views", "{n} просмотров", "{n} қаралым"],

  // ── плеер ─────────────────────────────────────────────────────────
  "player.prev": ["Previous", "Предыдущий", "Алдыңғы"],
  "player.play": ["Play", "Воспроизвести", "Ойнату"],
  "player.pause": ["Pause", "Пауза", "Кідірту"],
  "player.next": ["Next", "Следующий", "Келесі"],
  "player.seek": ["Seek", "Перемотка", "Айналдыру"],
  "player.speed": ["Playback speed", "Скорость воспроизведения", "Ойнату жылдамдығы"],
  "player.volume": ["Volume", "Громкость", "Дыбыс деңгейі"],
  "player.video": ["Video player", "Видеоплеер", "Бейнеойнатқыш"],

  // ── музыка ────────────────────────────────────────────────────────
  "music.add": ["+ Add track", "+ Добавить трек", "+ Трек қосу"],
  "music.url": ["Audio URL (mp3, ogg…)", "Ссылка на аудио (mp3, ogg…)", "Аудио сілтемесі (mp3, ogg…)"],
  "music.urlA": ["Audio link", "Ссылка на аудио", "Аудио сілтемесі"],
  "music.empty": ["No tracks yet. Be the first to add one!", "Треков пока нет. Добавьте первый!", "Әзірге тректер жоқ. Біріншісін қосыңыз!"],

  // ── видео ─────────────────────────────────────────────────────────
  "videos.add": ["+ Add video", "+ Добавить видео", "+ Бейне қосу"],
  "videos.url": ["Video URL (YouTube, mp4…)", "Ссылка на видео (YouTube, mp4…)", "Бейне сілтемесі (YouTube, mp4…)"],
  "videos.urlA": ["Video link", "Ссылка на видео", "Бейне сілтемесі"],
  "videos.empty": ["No videos yet. Be the first to add one!", "Видео пока нет. Добавьте первое!", "Әзірге бейне жоқ. Біріншісін қосыңыз!"],

  // ── творческие инструменты ────────────────────────────────────────
  "creative.h1": ["🎨 Creative tools", "🎨 Творческие инструменты", "🎨 Шығармашылық құралдар"],
  "creative.lyrics": ["🎵 Song lyrics (AI)", "🎵 Текст песни (ИИ)", "🎵 Ән мәтіні (ЖИ)"],
  "creative.theme": ["Theme (love, city, dreams…)", "Тема (любовь, город, мечты…)", "Тақырып (махаббат, қала, арман…)"],
  "creative.themeA": ["Theme", "Тема", "Тақырып"],
  "creative.generate": ["Generate", "Сгенерировать", "Жасау"],
  "creative.copy": ["Copy", "Копировать", "Көшіру"],
  "creative.copyLyricsA": ["Copy song lyrics", "Скопировать текст песни", "Ән мәтінін көшіру"],
  "creative.lyricsWord": ["song lyrics", "текст песни", "ән мәтіні"],
  "creative.copied": ["Copied: {x}", "Скопировано: {x}", "Көшірілді: {x}"],
  "creative.copyFail": ["Could not copy", "Не удалось скопировать", "Көшіру мүмкін болмады"],
  "creative.titles": ["✏️ Song title ideas (AI)", "✏️ Идеи названий песни (ИИ)", "✏️ Ән атауларының идеялары (ЖИ)"],
  "creative.copyTitleA": ["Copy title: {x}", "Скопировать название: {x}", "Атауын көшіру: {x}"],
  "creative.clickToCopy": ["Click to copy", "Нажмите, чтобы скопировать", "Көшіру үшін басыңыз"],
  "creative.palette": ["🎨 Colour palette", "🎨 Цветовая палитра", "🎨 Түс палитрасы"],
  "creative.paletteNote": ["Ready-made palettes by mood (not AI)", "Готовые палитры по настроению (не ИИ)", "Көңіл-күйге арналған дайын палитралар (ЖИ емес)"],
  "creative.show": ["Show", "Показать", "Көрсету"],
  "creative.copyColorA": ["Copy colour {x}", "Скопировать цвет {x}", "{x} түсін көшіру"],
  "creative.clickToCopyHex": ["Click to copy the colour code", "Нажмите, чтобы скопировать код цвета", "Түс кодын көшіру үшін басыңыз"],
  "creative.enOnly": ["AI writes lyrics and titles in English.", "ИИ пишет тексты и названия по-английски.", "ЖИ мәтіндер мен атауларды ағылшын тілінде жазады."],
  "creative.stub": ["AI is unavailable right now — this is a template, not generated text.", "ИИ сейчас недоступен — это шаблон, а не сгенерированный текст.", "ЖИ қазір қолжетімсіз — бұл жасалған мәтін емес, үлгі."],

  // ── добавление по ссылке (/qmedia/upload) ─────────────────────────
  "upload.h1": ["Add by link", "Добавить по ссылке", "Сілтеме арқылы қосу"],
  "upload.track": ["🎵 Track", "🎵 Трек", "🎵 Трек"],
  "upload.video": ["🎬 Video", "🎬 Видео", "🎬 Бейне"],
  "upload.trackTitle": ["Track title *", "Название трека *", "Трек атауы *"],
  "upload.trackTitleA": ["Track title", "Название трека", "Трек атауы"],
  "upload.videoTitle": ["Video title *", "Название видео *", "Бейне атауы *"],
  "upload.videoTitleA": ["Video title", "Название видео", "Бейне атауы"],
  "upload.desc": ["Video description", "Описание видео", "Бейне сипаттамасы"],
  "upload.url": ["File URL * (https://...)", "Ссылка на файл * (https://...)", "Файл сілтемесі * (https://...)"],
  "upload.urlA": ["Link to file", "Ссылка на файл", "Файлға сілтеме"],
  "upload.cover": ["Cover URL (optional)", "Ссылка на обложку (необязательно)", "Мұқаба сілтемесі (міндетті емес)"],
  "upload.coverA": ["Link to cover", "Ссылка на обложку", "Мұқабаға сілтеме"],
  "upload.tags": ["Comma-separated tags: jazz, piano, acoustic", "Теги через запятую: jazz, piano, acoustic", "Тегтер үтір арқылы: jazz, piano, acoustic"],
  "upload.tagsA": ["Comma-separated tags", "Теги через запятую", "Тегтер үтір арқылы"],
  "upload.public": ["Public access", "Публичный доступ", "Жалпыға ашық"],
  "upload.required": ["Title and link are required", "Название и ссылка обязательны", "Атауы мен сілтеме міндетті"],
  "upload.saving": ["Saving…", "Сохранение…", "Сақталуда…"],
  "upload.submit": ["Publish", "Опубликовать", "Жариялау"],
  "upload.doneTrack": ["Track added!", "Трек добавлен!", "Трек қосылды!"],
  "upload.doneVideo": ["Video added!", "Видео добавлено!", "Бейне қосылды!"],
  "upload.more": ["+ Add another", "+ Ещё", "+ Тағы қосу"],
  "upload.catalog": ["Catalogue", "Каталог", "Каталог"],

  // ── плейлисты ─────────────────────────────────────────────────────
  "pl.h1": ["Playlists", "Плейлисты", "Ойнату тізімдері"],
  "pl.create": ["+ Create", "+ Создать", "+ Жасау"],
  "pl.createBtn": ["Create", "Создать", "Жасау"],
  "pl.mine": ["Mine", "Мои", "Менікі"],
  "pl.public": ["Public", "Публичные", "Жалпыға ашық"],
  "pl.new": ["New playlist", "Новый плейлист", "Жаңа ойнату тізімі"],
  "pl.name": ["Name *", "Название *", "Атауы *"],
  "pl.nameA": ["Playlist name", "Название плейлиста", "Ойнату тізімінің атауы"],
  "pl.desc": ["Description (optional)", "Описание (необязательно)", "Сипаттама (міндетті емес)"],
  "pl.descA": ["Playlist description", "Описание плейлиста", "Ойнату тізімінің сипаттамасы"],
  "pl.isPublic": ["Public", "Публичный", "Жалпыға ашық"],
  "pl.private": ["Private", "Приватный", "Жеке"],
  "pl.emptyMine": ["You have no playlists", "У вас нет плейлистов", "Сізде ойнату тізімі жоқ"],
  "pl.emptyPublic": ["No public playlists", "Публичных плейлистов нет", "Жалпыға ашық ойнату тізімдері жоқ"],
  "pl.signIn": ["Sign in to see your playlists", "Войдите, чтобы увидеть свои плейлисты", "Ойнату тізімдеріңізді көру үшін кіріңіз"],
  "pl.confirmDel": ["Delete playlist?", "Удалить плейлист?", "Ойнату тізімін жою керек пе?"],
  "pl.tracks.one": ["{n} track", "{n} трек", "{n} трек"],
  "pl.tracks.few": ["{n} tracks", "{n} трека", "{n} трек"],
  "pl.tracks.many": ["{n} tracks", "{n} треков", "{n} трек"],

  // ── понравившееся ─────────────────────────────────────────────────
  "likes.h1": ["Liked", "Понравившееся", "Ұнағандар"],
  "likes.empty": ["No liked tracks or videos yet", "Понравившихся треков и видео пока нет", "Әзірге ұнаған тректер мен бейнелер жоқ"],
  "likes.listen": ["Listen to music →", "Слушать музыку →", "Музыка тыңдау →"],
  "likes.signIn": ["Sign in to see what you liked", "Войдите, чтобы увидеть понравившееся", "Ұнағандарды көру үшін кіріңіз"],
  "likes.unlike": ["Remove from liked", "Убрать из понравившегося", "Ұнағандардан алып тастау"],
} as const;

export type QMediaKey = keyof typeof T;
type Dict = Record<QMediaKey, string>;

function column(i: 0 | 1 | 2): Dict {
  const out = {} as Dict;
  for (const k of Object.keys(T) as QMediaKey[]) out[k] = T[k][i];
  return out;
}

const EN = column(0);
const RU = column(1);
const KK = column(2);
const DICT: Record<string, Dict> = { en: EN, ru: RU, kk: KK };

/** Перевод по ключу; язык без словаря → en. Подстановки `{name}`. */
export function tQ(lang: string | null | undefined, key: QMediaKey, vars?: Record<string, string | number>): string {
  const s = (DICT[lang ?? "en"] ?? EN)[key] ?? EN[key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, v: string) => (v in vars ? String(vars[v]) : m)) : s;
}

/** Форма множественного числа: ru — one/few/many, en — one/many, kk — без изменения. */
export function pluralForm(lang: string | null | undefined, n: number): "one" | "few" | "many" {
  const a = Math.abs(n);
  if (lang === "ru") {
    const d = a % 10;
    const h = a % 100;
    if (d === 1 && h !== 11) return "one";
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "few";
    return "many";
  }
  if (lang === "kk") return "many";
  return a === 1 ? "one" : "many";
}

type PluralBase = QMediaKey extends infer K ? (K extends `${infer B}.one` ? B : never) : never;

export function tQN(lang: string | null | undefined, base: PluralBase, n: number): string {
  return tQ(lang, `${base}.${pluralForm(lang, n)}` as QMediaKey, { n });
}

/** Подпись значения (жанр/категория/настроение); неизвестное значение показывается как пришло. */
export function labelOf(lang: string | null | undefined, kind: "genre" | "vcat" | "mood", value: string | null | undefined): string {
  const v = String(value ?? "");
  const k = `${kind}.${v}` as QMediaKey;
  return k in T ? tQ(lang, k) : v;
}

/**
 * Какую ошибку показать человеку, когда сервер не сохранил запись (трек, видео, плейлист).
 * Сырой ответ сервера («auth required», «title required») человеку не выводится.
 * 401 — гость: «Войдите, чтобы добавить»; всё прочее (400, 5xx, 503 хранилища, сеть) —
 * «Не удалось сохранить, попробуйте ещё раз».
 */
export function saveErrorKey(status: number): "err.signIn" | "err.saveFailed" {
  return status === 401 ? "err.signIn" : "err.saveFailed";
}

/** Ошибка генерации ИИ: 429 — ограничитель темпа (5 в минуту), прочее — общий отказ. */
export function genErrorKey(status: number): "err.tooMany" | "err.genFailed" {
  return status === 429 ? "err.tooMany" : "err.genFailed";
}

const LOCALE: Record<string, string> = { en: "en-US", ru: "ru-RU", kk: "kk-KZ" };

/** Категории видео — одни и те же в форме добавления и в фильтре /videos (до 29.10 форма писала «shortfilm», фильтр искал «short-film»). */
export const VIDEO_CATS = ["tutorial", "music-video", "short-film", "documentary", "live", "other"] as const;

export const QMEDIA_KEYS = Object.keys(T) as QMediaKey[];
export const QMEDIA_DICT = DICT;

export function useQMediaT() {
  // без провайдера (компонент в одиночку, тесты) — en: запасной язык компонентов не ru
  const lang = useI18nOptional()?.lang ?? "en";
  const t = useCallback((key: QMediaKey, vars?: Record<string, string | number>) => tQ(lang, key, vars), [lang]);
  const tn = useCallback((base: PluralBase, n: number) => tQN(lang, base, n), [lang]);
  const label = useCallback((kind: "genre" | "vcat" | "mood", value: string | null | undefined) => labelOf(lang, kind, value), [lang]);
  const locale = LOCALE[lang] ?? "en-US";
  const num = useCallback((n: number) => (Number.isFinite(n) ? n.toLocaleString(locale) : String(n ?? "")), [locale]);
  return { t, tn, label, lang, locale, num };
}
