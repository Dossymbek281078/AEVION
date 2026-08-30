"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LANG_COOKIE,
  LANG_FLAG,
  LANG_FULL,
  LANG_KEY_COUNT,
  LANG_RTL,
  LANG_SHORT,
  LANGS,
  interpolate,
  type Lang,
} from "./i18n-data";

/**
 * English is the only dictionary compiled into the page.
 *
 * Not a preference — a hydration requirement. The provider's first render must
 * match what the server sent, and the server renders client components with
 * `lang` still at its initial "en"; the visitor's real language is only known
 * after mount, from localStorage or the browser. So `en` has to be there
 * synchronously, and every other language is fetched.
 *
 * Before 10.08.2026 all eleven were compiled in: 1.3 MB on every page of the
 * platform, eleven times more than one person can read. See i18n-data.ts.
 */
import en from "./i18n-lang/en";

// Re-export the data layer so existing client imports from "@/lib/i18n" keep
// working unchanged (Lang, LANGS, LANG_SHORT, LANG_FULL, LANG_COOKIE,
// interpolate). Server code imports the same names from "@/lib/i18n-data"
// directly — this file's "use client" directive turns non-component exports
// into opaque client-reference stubs on the server.
export {
  LANG_COOKIE,
  LANG_FLAG,
  LANG_FULL,
  LANG_KEY_COUNT,
  LANG_RTL,
  LANG_SHORT,
  LANGS,
  interpolate,
  type Lang,
};

/** Dictionaries fetched so far, English included from the start. */
const loaded: Partial<Record<Lang, Record<string, string>>> = { en };
const inFlight = new Map<Lang, Promise<Record<string, string>>>();

/**
 * One entry per language, written out rather than built from a template.
 *
 * `import(\`./i18n-lang/${lang}\`)` reads better and every bundler here would
 * take it, but Vite — which runs the unit tests — refuses a variable path
 * without a file extension, and a `.ts` extension is not something the app
 * build accepts. Spelled out, all three agree, and each language is its own
 * chunk.
 */
const LOADERS: Record<Lang, () => Promise<{ default: Record<string, string> }>> = {
  ru: () => import("./i18n-lang/ru"),
  en: () => import("./i18n-lang/en"),
  kk: () => import("./i18n-lang/kk"),
  de: () => import("./i18n-lang/de"),
  fr: () => import("./i18n-lang/fr"),
  es: () => import("./i18n-lang/es"),
  zh: () => import("./i18n-lang/zh"),
  ja: () => import("./i18n-lang/ja"),
  ar: () => import("./i18n-lang/ar"),
  pt: () => import("./i18n-lang/pt"),
  tr: () => import("./i18n-lang/tr"),
};

/**
 * Fetches one language's dictionary, once.
 *
 * Callers that need a dictionary they do not have — the provider on a language
 * change, AutoTranslate building its source→target map — go through here rather
 * than importing a language module directly, so a page never compiles in more
 * than English.
 */
export function loadDict(lang: Lang): Promise<Record<string, string>> {
  const have = loaded[lang];
  if (have) return Promise.resolve(have);

  const existing = inFlight.get(lang);
  if (existing) return existing;

  const p = LOADERS[lang]()
    .then((m) => {
      loaded[lang] = m.default;
      inFlight.delete(lang);
      return m.default;
    })
    .catch((e) => {
      inFlight.delete(lang);
      // An empty dictionary falls back to English key by key, which is what the
      // visitor already sees; swallowing it silently would hide a broken deploy,
      // so it is reported.
      console.error(`[i18n] could not load "${lang}"`, e);
      return {};
    });

  inFlight.set(lang, p);
  return p;
}

/** The dictionary for `lang` if it has already arrived, otherwise undefined. */
export function peekDict(lang: Lang): Record<string, string> | undefined {
  return loaded[lang];
}

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /**
   * Определён ли язык окончательно.
   *
   * Первый рендер обязан совпасть с сервером, поэтому `lang` стартует с "en"
   * и только потом эффект подставляет сохранённый или язык браузера. До этого
   * момента "en" — не выбор пользователя, а заглушка, и потребителям, которые
   * на смене языка делают что-то дорогое (AutoTranslate перемонтирует всё
   * поддерево), нужно уметь отличать заглушку от настоящего значения.
   */
  langReady: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "aevion_lang_v1";

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as string[]).includes(x);
}

function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "ru";
  const raw = (navigator.language || "en").toLowerCase();
  if (raw.startsWith("kk") || raw.startsWith("kz")) return "kk";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("ar")) return "ar";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("tr")) return "tr";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [langReady, setLangReady] = useState(false);
  /**
   * Bumped when a dictionary arrives, to re-render with the new strings.
   *
   * The dictionaries live in a module-level cache rather than in state so that
   * two providers (tests mount several) share one fetch; this counter is the
   * only thing React needs to know changed.
   */
  const [dictsLoaded, setDictsLoaded] = useState(0);

  useEffect(() => {
    if (peekDict(lang)) return;
    let alive = true;
    loadDict(lang).then(() => {
      if (alive) setDictsLoaded((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLang(saved)) {
        setLangState(saved);
        setLangReady(true);
        return;
      }
    } catch {}
    setLangState(detectBrowserLang());
    setLangReady(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
      // Mirror choice into a cookie so SSR pages render with the right language
      // on the next request — without this the user sees EN on cold loads of
      // /awards / /[id] / /pitch even after picking RU/KK in the client UI.
      try {
        document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = LANG_RTL[lang] ? "rtl" : "ltr";
    }
  }, [lang]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      // `dictsLoaded` is not read here on purpose — it exists to make this
      // callback new once the dictionary lands, so consumers re-render with the
      // translated string instead of the English one they hydrated with.
      const raw = peekDict(lang)?.[key] || en[key] || key;
      return interpolate(raw, vars);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, dictsLoaded],
  );

  const value = useMemo(() => ({ lang, setLang, t, langReady }), [lang, setLang, t, langReady]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Compact language switcher component (EN / RU / KZ) */
export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        borderRadius: 8,
        border: "1px solid rgba(15,23,42,0.12)",
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      {LANGS.map((l, i) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            title={LANG_FULL[l]}
            style={{
              padding: "5px 10px",
              border: "none",
              borderLeft: i === 0 ? "none" : "1px solid rgba(15,23,42,0.12)",
              background: active ? "#0f172a" : "transparent",
              color: active ? "#fff" : "#64748b",
              fontWeight: active ? 800 : 500,
              cursor: "pointer",
            }}
          >
            {LANG_SHORT[l]}
          </button>
        );
      })}
    </div>
  );
}
