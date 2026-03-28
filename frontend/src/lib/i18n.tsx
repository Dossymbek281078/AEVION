"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "en" | "ru";

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "aevion_lang_v1";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    /* Nav & global */
    "nav.demo": "Ecosystem demo",
    "nav.auth": "Auth",
    "nav.qright": "QRight",
    "nav.qsign": "QSign",
    "nav.bureau": "Bureau",
    "nav.planet": "Planet",
    "nav.awards": "Awards",
    "nav.bank": "Bank",
    "nav.chess": "Chess",
    "nav.help": "Help",

    /* Home hero */
    "home.badge": "Product MVP · ready for demo",
    "home.title": "Trust infrastructure for digital assets and intellectual property",
    "home.subtitle": "A unified environment for investment and partnership evaluation: identity, object registry, cryptographic signature, patent bureau, and compliance layer — on an interactive ecosystem map with 27 product nodes and open APIs.",
    "home.cta.auth": "Start with identity (Auth)",
    "home.cta.qright": "QRight Registry",
    "home.cta.music": "Music Awards",
    "home.cta.film": "Film Awards",
    "home.cta.demo": "Full demo →",

    /* Stats */
    "stats.nodes": "Nodes on map",
    "stats.qright": "QRight records",
    "stats.participants": "Planet participants",
    "stats.certified": "Certified",
    "stats.submissions": "Planet submissions",
    "stats.stack": "Stack",

    /* Auth */
    "auth.title": "AEVION Identity",
    "auth.subtitle": "Single account for all ecosystem modules. Register or sign in to get a JWT token.",
    "auth.register": "Register",
    "auth.login": "Sign in",
    "auth.name": "Name",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.password.hint": "Minimum 6 characters",
    "auth.submit.register": "Create account",
    "auth.submit.login": "Sign in",
    "auth.waiting": "Please wait...",
    "auth.session": "Session active",
    "auth.logout": "Sign out",
    "auth.cta.qright": "Create object in QRight →",
    "auth.cta.planet": "Planet Lab",
    "auth.toast.registered": "Account created! Welcome to AEVION",
    "auth.toast.loggedin": "Signed in",
    "auth.toast.loggedout": "Signed out",
    "auth.jwt.label": "JWT token (for developers)",

    /* QRight */
    "qright.title": "QRight",
    "qright.subtitle": "Electronic patenting (MVP): register object → hash → add to registry. Then — sign and bureau in one click.",
    "qright.form.title": "Title *",
    "qright.form.desc": "Description *",
    "qright.form.owner": "Author name (optional)",
    "qright.form.email": "Author email (optional)",
    "qright.form.country": "Country (optional)",
    "qright.form.city": "City (optional)",
    "qright.form.submit": "Register object",
    "qright.form.saving": "Saving...",
    "qright.toast.created": "Object registered in QRight",
    "qright.registry": "QRight Registry",
    "qright.mine": "Only mine (requires Auth)",

    /* Pipeline */
    "pipeline.auth": "Auth",
    "pipeline.qright": "QRight",
    "pipeline.qsign": "QSign",
    "pipeline.bureau": "Bureau",
    "pipeline.planet": "Planet",

    /* Bank */
    "bank.title": "Ecosystem digital bank",
    "bank.subtitle": "Wallet, P2P transfers between creators, automatic royalties for content usage, Awards payouts. Every transaction linked to Trust Graph.",
    "bank.balance": "Balance",
    "bank.available": "Available",
    "bank.frozen": "Frozen",
    "bank.pending": "Pending royalties",
    "bank.transfer": "P2P Transfer",
    "bank.recipient": "Recipient",
    "bank.amount": "Amount AEC",
    "bank.send": "Send",
    "bank.sending": "Sending...",
    "bank.history": "Transaction history",

    /* Chess */
    "chess.title": "Next-gen chess",
    "chess.subtitle": "Play against AI in your browser. Anti-cheat, ratings, and tournaments — coming soon.",
    "chess.your.turn": "Your move (white)",
    "chess.ai.thinking": "AI is thinking...",
    "chess.new.game": "New game",
    "chess.captured.you": "Captured by you",
    "chess.captured.ai": "Captured by AI",
    "chess.moves": "Moves",

    /* Footer */
    "footer.brand": "Global trust infrastructure for digital content, intellectual property and creator economy.",
    "footer.products": "Products",
    "footer.company": "Company",
    "footer.contact": "Contact",
    "footer.rights": "All rights reserved.",

    /* Help */
    "help.title": "Help Center",
    "help.subtitle": "Everything you need to know about using AEVION. Can't find an answer? Email us at info@aevion.app",
    "help.still": "Still need help?",

    /* Misc */
    "planet.dashboard": "Planet Ecosystem — live",
    "planet.lab": "Planet Lab →",
    "awards.hub": "Awards hub →",
  },

  ru: {
    "nav.demo": "Демо экосистемы",
    "nav.auth": "Auth",
    "nav.qright": "QRight",
    "nav.qsign": "QSign",
    "nav.bureau": "Bureau",
    "nav.planet": "Planet",
    "nav.awards": "Awards",
    "nav.bank": "Bank",
    "nav.chess": "Шахматы",
    "nav.help": "Помощь",

    "home.badge": "Продуктовый MVP · готово к демонстрации",
    "home.title": "Инфраструктура доверия для цифровых активов и интеллектуальной собственности",
    "home.subtitle": "Единый контур для инвестиционной и партнёрской оценки: идентичность, реестр объектов, криптоподпись, патентное бюро и слой compliance — на интерактивной карте экосистемы с 27 продуктовыми узлами и открытыми API.",
    "home.cta.auth": "Начать с идентичности (Auth)",
    "home.cta.qright": "Реестр QRight",
    "home.cta.music": "Премия — музыка",
    "home.cta.film": "Премия — кино",
    "home.cta.demo": "Полная демонстрация →",

    "stats.nodes": "Узлов на карте",
    "stats.qright": "Записей QRight",
    "stats.participants": "Planet участников",
    "stats.certified": "Сертифицировано",
    "stats.submissions": "Заявок Planet",
    "stats.stack": "Стек",

    "auth.title": "Идентичность AEVION",
    "auth.subtitle": "Единая учётная запись для всех модулей экосистемы. Зарегистрируйтесь или войдите, чтобы получить JWT-токен.",
    "auth.register": "Регистрация",
    "auth.login": "Вход",
    "auth.name": "Имя",
    "auth.email": "Email",
    "auth.password": "Пароль",
    "auth.password.hint": "Минимум 6 символов",
    "auth.submit.register": "Создать аккаунт",
    "auth.submit.login": "Войти",
    "auth.waiting": "Подождите...",
    "auth.session": "Сессия активна",
    "auth.logout": "Выйти",
    "auth.cta.qright": "Создать объект в QRight →",
    "auth.cta.planet": "🌍 Planet Lab",
    "auth.toast.registered": "Аккаунт создан! Добро пожаловать в AEVION",
    "auth.toast.loggedin": "Вход выполнен",
    "auth.toast.loggedout": "Вы вышли из системы",
    "auth.jwt.label": "JWT-токен (для разработчиков)",

    "qright.title": "QRight",
    "qright.subtitle": "Электронное патентирование (MVP): регистрация объекта → хэш → запись в реестр. Дальше — подпись и бюро в один клик.",
    "qright.form.title": "Название *",
    "qright.form.desc": "Описание *",
    "qright.form.owner": "Имя автора (опционально)",
    "qright.form.email": "Email автора (опционально)",
    "qright.form.country": "Страна (опционально)",
    "qright.form.city": "Город (опционально)",
    "qright.form.submit": "Зарегистрировать объект",
    "qright.form.saving": "Сохранение...",
    "qright.toast.created": "Объект зарегистрирован в QRight",
    "qright.registry": "Реестр QRight",
    "qright.mine": "Только мои (нужен вход в Auth)",

    "pipeline.auth": "Auth",
    "pipeline.qright": "QRight",
    "pipeline.qsign": "QSign",
    "pipeline.bureau": "Bureau",
    "pipeline.planet": "Planet",

    "bank.title": "Цифровой банк экосистемы",
    "bank.subtitle": "Кошелёк, переводы между авторами, автоматические роялти при использовании контента, выплаты за победы в Awards. Каждая транзакция привязана к Trust Graph.",
    "bank.balance": "Баланс",
    "bank.available": "Доступно",
    "bank.frozen": "Заморожено",
    "bank.pending": "Ожидает роялти",
    "bank.transfer": "Перевод P2P",
    "bank.recipient": "Получатель",
    "bank.amount": "Сумма AEC",
    "bank.send": "Отправить",
    "bank.sending": "Отправка...",
    "bank.history": "История транзакций",

    "chess.title": "Шахматы нового поколения",
    "chess.subtitle": "Играйте против ИИ прямо в браузере. Античит, рейтинг и турниры — скоро.",
    "chess.your.turn": "Ваш ход (белые)",
    "chess.ai.thinking": "ИИ думает...",
    "chess.new.game": "Новая игра",
    "chess.captured.you": "Взяты вами",
    "chess.captured.ai": "Взяты ИИ",
    "chess.moves": "Ходы",

    "footer.brand": "Глобальная инфраструктура доверия для цифрового контента, интеллектуальной собственности и экономики создателей.",
    "footer.products": "Продукты",
    "footer.company": "Компания",
    "footer.contact": "Контакты",
    "footer.rights": "Все права защищены.",

    "help.title": "Центр помощи",
    "help.subtitle": "Всё что нужно знать об использовании AEVION. Не нашли ответ? Напишите нам на info@aevion.app",
    "help.still": "Остались вопросы?",

    "planet.dashboard": "Planet Ecosystem — live",
    "planet.lab": "Planet Lab →",
    "awards.hub": "Премии Awards →",
  },
};

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "en" || saved === "ru") setLangState(saved);
    } catch {}
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback(
    (key: string): string => translations[lang][key] || translations.en[key] || key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Compact language switcher component */
export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", overflow: "hidden", fontSize: 12 }}>
      <button
        onClick={() => setLang("en")}
        style={{
          padding: "5px 10px",
          border: "none",
          background: lang === "en" ? "#0f172a" : "transparent",
          color: lang === "en" ? "#fff" : "#64748b",
          fontWeight: lang === "en" ? 800 : 500,
          cursor: "pointer",
        }}
      >
        EN
      </button>
      <button
        onClick={() => setLang("ru")}
        style={{
          padding: "5px 10px",
          border: "none",
          borderLeft: "1px solid rgba(15,23,42,0.12)",
          background: lang === "ru" ? "#0f172a" : "transparent",
          color: lang === "ru" ? "#fff" : "#64748b",
          fontWeight: lang === "ru" ? 800 : 500,
          cursor: "pointer",
        }}
      >
        RU
      </button>
    </div>
  );
}
