"use client";

import React from "react";

export type KidsLang = "ru" | "en" | "kz";

const LANGS: { code: KidsLang; label: string; flag: string }[] = [
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "kz", label: "Қазақша", flag: "🇰🇿" },
];

interface Props {
  value: KidsLang;
  onChange: (lang: KidsLang) => void;
}

const wrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "center",
  marginBottom: 24,
};

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: 999,
    border: active ? "2px solid #f59e0b" : "2px solid #fde68a",
    background: active ? "#fef3c7" : "#fffbeb",
    color: active ? "#92400e" : "#78350f",
    fontWeight: active ? 700 : 500,
    fontSize: 16,
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
  };
}

export default function LanguageSelector({ value, onChange }: Props) {
  return (
    <div style={wrapStyle} role="tablist" aria-label="Язык уроков">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="tab"
          aria-selected={value === l.code}
          onClick={() => onChange(l.code)}
          style={buttonStyle(value === l.code)}
        >
          <span style={{ marginRight: 6 }}>{l.flag}</span>
          {l.label}
        </button>
      ))}
    </div>
  );
}
