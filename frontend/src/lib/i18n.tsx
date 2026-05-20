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
  LANG_RTL,
  LANG_SHORT,
  LANGS,
  interpolate,
  translations,
  type Lang,
} from "./i18n-data";

// Re-export the data layer so existing client imports from "@/lib/i18n" keep
// working unchanged (Lang, LANGS, LANG_SHORT, LANG_FULL, LANG_COOKIE,
// translations, interpolate). Server code imports the same names from
// "@/lib/i18n-data" directly — this file's "use client" directive turns
// non-component exports into opaque client-reference stubs on the server.
export {
  LANG_COOKIE,
  LANG_FLAG,
  LANG_FULL,
  LANG_RTL,
  LANG_SHORT,
  LANGS,
  interpolate,
  translations,
  type Lang,
};

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLang(saved)) {
        setLangState(saved);
        return;
      }
    } catch {}
    setLangState(detectBrowserLang());
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
      const tbl = translations as unknown as Record<string, Record<string, string>>;
      const raw = tbl[lang]?.[key] || tbl["en"]?.[key] || key;
      return interpolate(raw, vars);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

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
