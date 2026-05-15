"use client";

import { CSSProperties } from "react";

export type LangFilter = "all" | "ru" | "en" | "kk" | "es";
export type MoodFilter =
  | "all"
  | "hopeful"
  | "peaceful"
  | "joyful"
  | "reflective"
  | "uplifting";

const LANG_OPTIONS: { value: LangFilter; label: string; flag: string }[] = [
  { value: "all", label: "Все", flag: "🌍" },
  { value: "ru", label: "Русский", flag: "🇷🇺" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "kk", label: "Қазақша", flag: "🇰🇿" },
  { value: "es", label: "Español", flag: "🇪🇸" },
];

const MOOD_OPTIONS: { value: MoodFilter; label: string; emoji: string }[] = [
  { value: "all", label: "Все настроения", emoji: "✨" },
  { value: "hopeful", label: "Надежда", emoji: "🌅" },
  { value: "peaceful", label: "Покой", emoji: "🕊️" },
  { value: "joyful", label: "Радость", emoji: "💃" },
  { value: "reflective", label: "Размышление", emoji: "🌙" },
  { value: "uplifting", label: "Подъём", emoji: "🔥" },
];

const chipBase: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #e5d4b8",
  background: "#fffaf2",
  cursor: "pointer",
  fontSize: 14,
  color: "#5b4a2e",
  transition: "all 0.15s ease",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const chipActive: CSSProperties = {
  ...chipBase,
  background: "linear-gradient(135deg, #d97f3a, #c75a1f)",
  color: "#fff",
  borderColor: "#c75a1f",
  boxShadow: "0 2px 8px rgba(199,90,31,0.25)",
};

type Props = {
  lang: LangFilter;
  mood: MoodFilter;
  onLangChange: (l: LangFilter) => void;
  onMoodChange: (m: MoodFilter) => void;
};

export default function Filters({
  lang,
  mood,
  onLangChange,
  onMoodChange,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            color: "#8a7250",
            marginBottom: 8,
          }}
        >
          Язык
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onLangChange(opt.value)}
              style={lang === opt.value ? chipActive : chipBase}
            >
              <span>{opt.flag}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            color: "#8a7250",
            marginBottom: 8,
          }}
        >
          Настроение
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onMoodChange(opt.value)}
              style={mood === opt.value ? chipActive : chipBase}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
