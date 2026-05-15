"use client";

import { CSSProperties } from "react";

export type Stats = {
  total: number;
  byLanguage: Record<string, number>;
  byMood: Record<string, number>;
};

const LANG_LABEL: Record<string, { label: string; flag: string }> = {
  ru: { label: "Русский", flag: "🇷🇺" },
  en: { label: "English", flag: "🇬🇧" },
  kk: { label: "Қазақша", flag: "🇰🇿" },
  es: { label: "Español", flag: "🇪🇸" },
  it: { label: "Italiano", flag: "🇮🇹" },
  fr: { label: "Français", flag: "🇫🇷" },
  de: { label: "Deutsch", flag: "🇩🇪" },
  ja: { label: "日本語", flag: "🇯🇵" },
  zh: { label: "中文", flag: "🇨🇳" },
  ar: { label: "العربية", flag: "🇦🇪" },
  pt: { label: "Português", flag: "🇵🇹" },
};

const containerStyle: CSSProperties = {
  background: "linear-gradient(135deg, #fff5e6 0%, #ffe8c8 100%)",
  border: "1px solid #f0d4a0",
  borderRadius: 16,
  padding: "16px 20px",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 16,
};

const totalStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
};

const numStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "#a3501a",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#fff",
  border: "1px solid #f0d4a0",
  borderRadius: 999,
  padding: "5px 11px",
  fontSize: 13,
  color: "#5b4a2e",
};

type Props = { stats: Stats | null };

export default function StatsBar({ stats }: Props) {
  if (!stats) {
    return (
      <div style={containerStyle}>
        <span style={{ color: "#8a7250", fontSize: 14 }}>Загружаем статистику…</span>
      </div>
    );
  }
  const langs = Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1]);
  return (
    <div style={containerStyle}>
      <div style={totalStyle}>
        <span style={numStyle}>{stats.total}</span>
        <span style={{ color: "#5b4a2e", fontSize: 14 }}>треков всего</span>
      </div>
      <div style={{ width: 1, height: 28, background: "#f0d4a0" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {langs.map(([code, n]) => {
          const info = LANG_LABEL[code] || { label: code.toUpperCase(), flag: "🌐" };
          return (
            <span key={code} style={chipStyle}>
              <span>{info.flag}</span>
              <span>{info.label}</span>
              <strong style={{ color: "#a3501a" }}>{n}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}
