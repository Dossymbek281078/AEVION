/**
 * Словарь оболочки QBuild (меню, нижняя панель, вход, уведомления) — ru/en/kk.
 *
 * До 24.10.2026 BuildShell не звал перевод вовсе: 25 пунктов меню, подвал,
 * форма входа и подписи кнопок были английскими при любом языке; русские
 * «Тарифы/Помощь» на проде появлялись только от живого слоя перевода.
 * Язык — из общего механизма сайта (useI18nOptional). kk — черновик.
 */
import { useCallback } from "react";
import { useI18nOptional } from "@/lib/i18n";

const EN = {
  "nav.projects": "Projects", "nav.vacancies": "Vacancies", "nav.talent": "Talent", "nav.coach": "AI Coach",
  "nav.apps": "My Apps", "nav.interviews": "📅 Interviews", "nav.alerts": "🔔 Alerts", "nav.safety": "⚠️ Safety",
  "nav.trials": "Trials", "nav.reviews": "Reviews", "nav.saved": "Saved", "nav.dashboard": "Dashboard",
  "nav.newProject": "New project", "nav.profile": "Profile", "nav.docs": "📄 Docs", "nav.portfolio": "🖼 Portfolio",
  "nav.messages": "Messages", "nav.pipeline": "Pipeline", "nav.calendar": "Calendar", "nav.pricing": "Pricing",
  "nav.loyalty": "Loyalty", "nav.leaderboard": "Leaderboard", "nav.stories": "Success Stories", "nav.help": "Help",
  "nav.why": "Why us",
  "tab.home": "Home", "tab.feed": "Feed", "tab.chats": "Chats", "tab.stats": "Stats", "tab.me": "Me",
  "head.sub": "AEVION Construction & Recruiting", "head.openMenu": "Open menu", "head.moreMenu": "More menu",
  "head.more": "More…", "head.admin": "Admin", "head.account": "Account settings", "head.notSigned": "Not signed in",
  "foot.help": "Help", "foot.stats": "Platform stats", "foot.leaderboard": "Leaderboard", "foot.stories": "Success stories",
  "foot.why": "Why AEVION", "foot.pricing": "Pricing", "foot.dev": "Developers", "foot.changelog": "Changelog",
  "foot.start": "Get started",
  "aria.bottom": "Bottom navigation", "aria.drawer": "Navigation menu", "drawer.menu": "Menu", "drawer.close": "Close menu",
  "drawer.logout": "Log out",
  "coach.open": "Open AI coach", "coach.label": "AI coach", "coach.close": "Close", "coach.loading": "Loading coach…",
  "plan.title": "Your current plan — click to compare or upgrade", "plan.pph": "Pay-per-Hire", "plan.free": "Free",
  "notif.label": "Notifications", "notif.new": "{n} new notifications", "notif.all": "See all →", "loading": "Loading…",
  "notif.none": "All caught up.", "notif.unread": "Unread messages", "notif.pending": "Pending applications",
  "notif.mine": "My application updates",
  "auth.signIn": "Sign in", "auth.create": "Create account", "auth.need": "Need an account?", "auth.have": "Have an account?",
  "auth.name": "Full name", "auth.email": "Email", "auth.password": "Password", "auth.passwordPh": "Password (min 6 chars)",
  "auth.single": "Single AEVION account — works across QBuild, QRight, QSign and other modules.",
};

export type ShellKey = keyof typeof EN;

const RU: Record<ShellKey, string> = {
  "nav.projects": "Проекты", "nav.vacancies": "Вакансии", "nav.talent": "Таланты", "nav.coach": "ИИ-коуч",
  "nav.apps": "Мои отклики", "nav.interviews": "📅 Собеседования", "nav.alerts": "🔔 Алерты", "nav.safety": "⚠️ Безопасность",
  "nav.trials": "Пробные смены", "nav.reviews": "Отзывы", "nav.saved": "Сохранённое", "nav.dashboard": "Панель",
  "nav.newProject": "Новый проект", "nav.profile": "Профиль", "nav.docs": "📄 Документы", "nav.portfolio": "🖼 Портфолио",
  "nav.messages": "Сообщения", "nav.pipeline": "Воронка", "nav.calendar": "Календарь", "nav.pricing": "Тарифы",
  "nav.loyalty": "Лояльность", "nav.leaderboard": "Лидерборд", "nav.stories": "Истории успеха", "nav.help": "Помощь",
  "nav.why": "Почему мы",
  "tab.home": "Главная", "tab.feed": "Лента", "tab.chats": "Чаты", "tab.stats": "Статистика", "tab.me": "Я",
  "head.sub": "AEVION: стройка и найм", "head.openMenu": "Открыть меню", "head.moreMenu": "Ещё пункты меню",
  "head.more": "Ещё…", "head.admin": "Админка", "head.account": "Настройки аккаунта", "head.notSigned": "Вход не выполнен",
  "foot.help": "Помощь", "foot.stats": "Статистика платформы", "foot.leaderboard": "Лидерборд", "foot.stories": "Истории успеха",
  "foot.why": "Почему AEVION", "foot.pricing": "Тарифы", "foot.dev": "Разработчикам", "foot.changelog": "Что нового",
  "foot.start": "С чего начать",
  "aria.bottom": "Нижнее меню", "aria.drawer": "Меню навигации", "drawer.menu": "Меню", "drawer.close": "Закрыть меню",
  "drawer.logout": "Выйти",
  "coach.open": "Открыть ИИ-коуча", "coach.label": "ИИ-коуч", "coach.close": "Закрыть", "coach.loading": "Загружаем коуча…",
  "plan.title": "Ваш текущий план — нажмите, чтобы сравнить или улучшить", "plan.pph": "Оплата за найм", "plan.free": "Бесплатный",
  "notif.label": "Уведомления", "notif.new": "Новых уведомлений: {n}", "notif.all": "Все →", "loading": "Загружаем…",
  "notif.none": "Ничего нового.", "notif.unread": "Непрочитанные сообщения", "notif.pending": "Отклики на рассмотрении",
  "notif.mine": "Обновления по моим откликам",
  "auth.signIn": "Войти", "auth.create": "Создать аккаунт", "auth.need": "Нет аккаунта?", "auth.have": "Уже есть аккаунт?",
  "auth.name": "Имя и фамилия", "auth.email": "Почта", "auth.password": "Пароль", "auth.passwordPh": "Пароль (не короче 6 знаков)",
  "auth.single": "Один аккаунт AEVION — работает в QBuild, QRight, QSign и других модулях.",
};

const KK: Record<ShellKey, string> = {
  "nav.projects": "Жобалар", "nav.vacancies": "Бос орындар", "nav.talent": "Таланттар", "nav.coach": "ЖИ-коуч",
  "nav.apps": "Менің өтінімдерім", "nav.interviews": "📅 Сұхбаттар", "nav.alerts": "🔔 Ескертулер", "nav.safety": "⚠️ Қауіпсіздік",
  "nav.trials": "Сынақ ауысымдары", "nav.reviews": "Пікірлер", "nav.saved": "Сақталғандар", "nav.dashboard": "Панель",
  "nav.newProject": "Жаңа жоба", "nav.profile": "Жеке бет", "nav.docs": "📄 Құжаттар", "nav.portfolio": "🖼 Жұмыстарым",
  "nav.messages": "Хабарламалар", "nav.pipeline": "Іріктеу кезеңдері", "nav.calendar": "Күнтізбе", "nav.pricing": "Тарифтер",
  "nav.loyalty": "Адалдық", "nav.leaderboard": "Көшбасшылар", "nav.stories": "Сәттілік тарихы", "nav.help": "Көмек",
  "nav.why": "Неге біз",
  "tab.home": "Басты", "tab.feed": "Лента", "tab.chats": "Чаттар", "tab.stats": "Статистика", "tab.me": "Мен",
  "head.sub": "AEVION: құрылыс және жалдау", "head.openMenu": "Мәзірді ашу", "head.moreMenu": "Мәзірдің қосымша пункттері",
  "head.more": "Тағы…", "head.admin": "Әкімші", "head.account": "Аккаунт баптаулары", "head.notSigned": "Кірмегенсіз",
  "foot.help": "Көмек", "foot.stats": "Платформа статистикасы", "foot.leaderboard": "Көшбасшылар", "foot.stories": "Сәттілік тарихы",
  "foot.why": "Неге AEVION", "foot.pricing": "Тарифтер", "foot.dev": "Әзірлеушілерге", "foot.changelog": "Не жаңа",
  "foot.start": "Неден бастау",
  "aria.bottom": "Төменгі мәзір", "aria.drawer": "Навигация мәзірі", "drawer.menu": "Мәзір", "drawer.close": "Мәзірді жабу",
  "drawer.logout": "Шығу",
  "coach.open": "ЖИ-коучты ашу", "coach.label": "ЖИ-коуч", "coach.close": "Жабу", "coach.loading": "Коуч жүктелуде…",
  "plan.title": "Ағымдағы жоспарыңыз — салыстыру немесе жақсарту үшін басыңыз", "plan.pph": "Жалдау үшін төлем", "plan.free": "Тегін",
  "notif.label": "Хабарландырулар", "notif.new": "Жаңа хабарландырулар: {n}", "notif.all": "Барлығы →", "loading": "Жүктелуде…",
  "notif.none": "Жаңа ештеңе жоқ.", "notif.unread": "Оқылмаған хабарламалар", "notif.pending": "Қаралудағы өтінімдер",
  "notif.mine": "Өтінімдерім бойынша жаңалықтар",
  "auth.signIn": "Кіру", "auth.create": "Аккаунт құру", "auth.need": "Аккаунт жоқ па?", "auth.have": "Аккаунт бар ма?",
  "auth.name": "Аты-жөні", "auth.email": "Пошта", "auth.password": "Құпиясөз", "auth.passwordPh": "Құпиясөз (кемінде 6 таңба)",
  "auth.single": "Бір AEVION аккаунты — QBuild, QRight, QSign және басқа модульдерде жұмыс істейді.",
};

const DICT: Partial<Record<string, Record<ShellKey, string>>> = { en: EN, ru: RU, kk: KK };

export function tShell(lang: string, key: ShellKey, vars?: Record<string, string | number>): string {
  let s = DICT[lang]?.[key] ?? EN[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const SHELL_KEYS = Object.keys(EN) as ShellKey[];
export const SHELL_DICT = DICT;

export function useShellT() {
  const lang = useI18nOptional()?.lang ?? "ru";
  return useCallback((key: ShellKey, vars?: Record<string, string | number>) => tShell(lang, key, vars), [lang]);
}
