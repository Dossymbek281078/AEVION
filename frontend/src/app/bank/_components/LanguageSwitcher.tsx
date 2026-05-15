"use client";

import { LANGS, LANG_FULL, LANG_SHORT, useI18n, type Lang } from "@/lib/i18n";

// Hero-themed LanguageSwitcher: dark gradient backdrop variant of the global LangSwitch.
// Uses the same I18nContext — switching here syncs with SiteHeader's LangSwitch.
export function LanguageSwitcher({
  variant = "hero",
}: {
  variant?: "hero" | "inline";
}) {
  const { lang, setLang, t } = useI18n();
  const isHero = variant === "hero";

  return (
    <div
      role="group"
      aria-label={t("common.lang")}
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 3,
        borderRadius: 999,
        background: isHero ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.06)",
        border: isHero ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(15,23,42,0.10)",
      }}
    >
      {LANGS.map((l: Lang) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            title={LANG_FULL[l]}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "none",
              background: active
                ? isHero
                  ? "rgba(255,255,255,0.95)"
                  : "#0f172a"
                : "transparent",
              color: active ? (isHero ? "#0f172a" : "#fff") : isHero ? "#fff" : "#334155",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              transition: "background 140ms ease, color 140ms ease",
            }}
          >
            {LANG_SHORT[l]}
          </button>
        );
      })}
    </div>
  );
}
