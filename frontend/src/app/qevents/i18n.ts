/**
 * Словарь QEvents (ru/en/kk).
 *
 * До 24.10.2026 список, карточка и форма были на английском, а календарь —
 * зашит по-русски (месяцы, дни недели, ru-RU в датах): страница смешивала
 * языки при любом выборе. Язык — из общего механизма сайта (`useI18n`), как
 * у DevHub и DeepSan. Ключи задаёт EN; ru/kk — Record<Key> под tsc.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";

const EN = {
  "hero.sub": "Discover and RSVP to upcoming events in the AEVION ecosystem.",
  "hero.create": "+ Create Event",
  "view.list": "☰ List",
  "view.calendar": "🗓 Calendar",
  "time.aria": "Time filter",
  "time.upcoming": "🔜 Upcoming",
  "time.past": "📜 Past",
  "loading": "Loading events...",
  "empty.upcomingH": "No upcoming events",
  "empty.pastH": "No past events",
  "empty.upcoming": "Be the first to create an event!",
  "empty.past": "Past events will appear here once they end.",
  "cat.all": "All",
  "cat.tech": "Tech",
  "cat.business": "Business",
  "cat.art": "Art",
  "cat.music": "Music",
  "cat.sports": "Sports",
  "cat.education": "Education",
  "cat.networking": "Networking",
  "cat.other": "Other",
  "card.free": "Free",
  "card.hide": "Hide details ▲",
  "card.details": "Details ▼",
  "card.going": "Going ✓",
  "card.rsvp": "RSVP",
  "card.signIn": "Sign in to RSVP",
  "card.past": "Past event",
  "card.ics": "Download .ics file to add this event to your calendar",
  "card.addCal": "📅 Add to calendar",
  "form.title": "Create Event",
  "form.titlePh": "Event title *",
  "form.descPh": "Description",
  "form.locationPh": "Location (default: Online)",
  "form.start": "Start date & time *",
  "form.end": "End date & time",
  "form.capacityPh": "Capacity (default: 100)",
  "form.pricePh": "Price in USD (0 = free)",
  "form.creating": "Creating...",
  "form.submit": "Create Event",
  "form.cancel": "Cancel",
  "err.required": "Title and start date are required",
  "err.create": "Failed to create",
  "err.network": "Network error",
  "storage.bold": "The event is not saved permanently.",
  "storage.warn": "Storage is temporarily unavailable. The event was created but will NOT survive a service restart — save the details and create it again later.",
  "cal.more": "+{n} more",
  "cal.count": "{n} events",
  "cal.none": "No events on this day.",
};

export type Key = keyof typeof EN;

const RU: Record<Key, string> = {
  "hero.sub": "События экосистемы AEVION: найдите интересное и запишитесь.",
  "hero.create": "+ Создать событие",
  "view.list": "☰ Список",
  "view.calendar": "🗓 Календарь",
  "time.aria": "Фильтр по времени",
  "time.upcoming": "🔜 Предстоящие",
  "time.past": "📜 Прошедшие",
  "loading": "Загружаем события…",
  "empty.upcomingH": "Предстоящих событий нет",
  "empty.pastH": "Прошедших событий нет",
  "empty.upcoming": "Станьте первым — создайте событие!",
  "empty.past": "Прошедшие события появятся здесь, когда закончатся.",
  "cat.all": "Все",
  "cat.tech": "Технологии",
  "cat.business": "Бизнес",
  "cat.art": "Искусство",
  "cat.music": "Музыка",
  "cat.sports": "Спорт",
  "cat.education": "Образование",
  "cat.networking": "Нетворкинг",
  "cat.other": "Другое",
  "card.free": "Бесплатно",
  "card.hide": "Скрыть подробности ▲",
  "card.details": "Подробнее ▼",
  "card.going": "Иду ✓",
  "card.rsvp": "Записаться",
  "card.signIn": "Войдите, чтобы записаться",
  "card.past": "Событие прошло",
  "card.ics": "Скачать файл .ics, чтобы добавить событие в свой календарь",
  "card.addCal": "📅 В календарь",
  "form.title": "Новое событие",
  "form.titlePh": "Название события *",
  "form.descPh": "Описание",
  "form.locationPh": "Место (по умолчанию: онлайн)",
  "form.start": "Дата и время начала *",
  "form.end": "Дата и время окончания",
  "form.capacityPh": "Мест (по умолчанию: 100)",
  "form.pricePh": "Цена в USD (0 = бесплатно)",
  "form.creating": "Создаём…",
  "form.submit": "Создать событие",
  "form.cancel": "Отмена",
  "err.required": "Нужны название и дата начала",
  "err.create": "Не удалось создать событие",
  "err.network": "Нет связи с сервером",
  "storage.bold": "Событие сохранено не насовсем.",
  "storage.warn": "Хранилище временно недоступно. Событие создано, но НЕ переживёт перезапуск сервиса — сохраните данные и создайте его заново позже.",
  "cal.more": "+{n} ещё",
  "cal.count": "событий: {n}",
  "cal.none": "Событий в этот день нет.",
};

const KK: Record<Key, string> = {
  "hero.sub": "AEVION экожүйесінің іс-шаралары: қызықтысын тауып, жазылыңыз.",
  "hero.create": "+ Іс-шара құру",
  "view.list": "☰ Тізім",
  "view.calendar": "🗓 Күнтізбе",
  "time.aria": "Уақыт бойынша сүзгі",
  "time.upcoming": "🔜 Алдағы",
  "time.past": "📜 Өткен",
  "loading": "Іс-шаралар жүктелуде…",
  "empty.upcomingH": "Алдағы іс-шаралар жоқ",
  "empty.pastH": "Өткен іс-шаралар жоқ",
  "empty.upcoming": "Бірінші болыңыз — іс-шара құрыңыз!",
  "empty.past": "Өткен іс-шаралар аяқталған соң осында шығады.",
  "cat.all": "Барлығы",
  "cat.tech": "Технология",
  "cat.business": "Бизнес",
  "cat.art": "Өнер",
  "cat.music": "Музыка",
  "cat.sports": "Спорт",
  "cat.education": "Білім",
  "cat.networking": "Нетворкинг",
  "cat.other": "Басқа",
  "card.free": "Тегін",
  "card.hide": "Толығын жасыру ▲",
  "card.details": "Толығырақ ▼",
  "card.going": "Барамын ✓",
  "card.rsvp": "Жазылу",
  "card.signIn": "Жазылу үшін кіріңіз",
  "card.past": "Іс-шара өтті",
  "card.ics": "Іс-шараны күнтізбеңізге қосу үшін .ics файлын жүктеп алыңыз",
  "card.addCal": "📅 Күнтізбеге қосу",
  "form.title": "Жаңа іс-шара",
  "form.titlePh": "Іс-шара атауы *",
  "form.descPh": "Сипаттама",
  "form.locationPh": "Орны (әдепкі: онлайн)",
  "form.start": "Басталу күні мен уақыты *",
  "form.end": "Аяқталу күні мен уақыты",
  "form.capacityPh": "Орын саны (әдепкі: 100)",
  "form.pricePh": "Бағасы USD (0 = тегін)",
  "form.creating": "Құрылуда…",
  "form.submit": "Іс-шара құру",
  "form.cancel": "Бас тарту",
  "err.required": "Атауы мен басталу күні қажет",
  "err.create": "Іс-шараны құру мүмкін болмады",
  "err.network": "Сервермен байланыс жоқ",
  "storage.bold": "Іс-шара біржола сақталмады.",
  "storage.warn": "Қойма уақытша қолжетімсіз. Іс-шара құрылды, бірақ қызмет қайта іске қосылғанда сақталмайды — деректерді сақтап, кейін қайта құрыңыз.",
  "cal.more": "+{n} тағы",
  "cal.count": "іс-шара: {n}",
  "cal.none": "Бұл күні іс-шара жоқ.",
};

const DICT: Partial<Record<string, Record<Key, string>>> = { en: EN, ru: RU, kk: KK };
const LOCALE: Record<string, string> = { ru: "ru-RU", en: "en-US", kk: "kk-KZ" };

export function tQevents(lang: string, key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang]?.[key] ?? EN[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Локаль дат под язык сайта — месяцы и дни недели не зашиты массивами. */
export function qeventsLocale(lang: string): string {
  return LOCALE[lang] ?? "en-US";
}

export const QEVENTS_KEYS = Object.keys(EN) as Key[];
export const QEVENTS_DICT = DICT;

export function useQeventsT() {
  const { lang } = useI18n();
  const t = useCallback((key: Key, vars?: Record<string, string | number>) => tQevents(lang, key, vars), [lang]);
  return { t, locale: qeventsLocale(lang) };
}
