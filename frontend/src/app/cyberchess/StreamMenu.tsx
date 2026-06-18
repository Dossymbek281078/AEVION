"use client";
/**
 * StreamMenu — единый вход «смотреть YouTube/Twitch».
 *
 * До этого «смотреть стрим» был размазан по 4 местам (header-кнопка 📺,
 * quick-bar 📺/PiP/Панели, плюс пресет "stream" в layout-дропдауне). Это
 * путало пользователя. Теперь — одна кнопка `📺 Стрим` с дропдауном, три
 * понятных режима просмотра. Вещание себя (Streamer Mode / Spectator) —
 * отдельное понятие и живёт в табе «Анализ & Стрим», не здесь.
 *
 * Стиль повторяет WorkspaceToolbar (нейтральная slate-палитра, тот же
 * паттерн backdrop + absolute dropdown), чтобы две соседние кнопки в
 * хедере смотрелись единообразно.
 */

import React, { useState } from "react";

type Props = {
  /** Встроенная медиа-панель активна (wsPreset==="stream"). */
  mediaActive: boolean;
  /** Плавающее PiP-окно открыто. */
  pipOpen: boolean;
  /** Тоггл встроенной медиа-панели. */
  onToggleMedia: () => void;
  /** Открыть PiP (компонент сам спросит URL/детектит источник). */
  onOpenPiP: () => void;
  /** Закрыть PiP. */
  onClosePiP: () => void;
  /** Открыть мульти-панель (несколько стримов). */
  onOpenMulti: () => void;
};

export default function StreamMenu({
  mediaActive, pipOpen, onToggleMedia, onOpenPiP, onClosePiP, onOpenMulti,
}: Props) {
  const [open, setOpen] = useState(false);
  const anyActive = mediaActive || pipOpen;

  const item = (
    icon: string, name: string, desc: string, active: boolean, onClick: () => void,
  ) => (
    <button onClick={() => { onClick(); setOpen(false); }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: 7, border: "none",
        background: active ? "#f1f5f9" : "transparent",
        cursor: "pointer", textAlign: "left", width: "100%",
        transition: "background 0.08s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      <span style={{ fontSize: 16, width: 26, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? "#0f172a" : "#374151" }}>{name}</div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, lineHeight: 1.2 }}>{desc}</div>
      </div>
      {active && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 900, color: "#7c3aed" }}>✓</span>}
    </button>
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Смотреть YouTube/Twitch стрим"
        aria-label="Смотреть стрим"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 10px", minHeight: 36, borderRadius: 8,
          border: `1px solid ${anyActive ? "#7c3aed" : "#cbd5e1"}`,
          background: anyActive ? "#ede9fe" : (open ? "#e2e8f0" : "#f1f5f9"),
          fontSize: 12, fontWeight: 800, cursor: "pointer",
          color: anyActive ? "#6d28d9" : "#334155",
          whiteSpace: "nowrap", transition: "background 0.1s",
        }}>
        <span style={{ fontSize: 14 }}>📺</span>
        <span>Стрим</span>
        <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: 1 }}>▾</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 300,
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
            padding: 5, minWidth: 250,
            display: "flex", flexDirection: "column", gap: 1,
          }}>
            <div style={{ padding: "4px 8px 6px", fontSize: 9.5, fontWeight: 900,
              letterSpacing: 1, textTransform: "uppercase", color: "#94a3b8" }}>
              Смотреть стрим
            </div>
            {item("📺", mediaActive ? "Медиа-панель ✓" : "Медиа-панель",
              "Встроенный YouTube/Twitch сбоку от доски", mediaActive, onToggleMedia)}
            {item("⊡", pipOpen ? "PiP-окно ✓" : "PiP-окно",
              "Плавающее видео поверх доски", pipOpen,
              () => (pipOpen ? onClosePiP() : onOpenPiP()))}
            {item("⊞", "Мульти-панель",
              "Несколько стримов рядом (до 4)", false, onOpenMulti)}
          </div>
        </>
      )}
    </div>
  );
}
