"use client";
/**
 * WorkspaceDock — slim right-edge always-visible icon column.
 *
 * Click any icon → expand to a 280px panel with that section's content.
 * Click again → collapse. ESC also closes.
 *
 * Sections:
 *   • Chessy balance + log
 *   • Daily missions
 *   • Quick notes (per-session)
 *   • Lichess link (open in new tab)
 *   • Hotkeys (cheatsheet)
 *
 * Replaces buried buttons with a compact, always-discoverable surface.
 */

import React, { useState, useEffect, useCallback } from "react";

type Section = "chessy" | "daily" | "notes" | "links" | "hotkeys";

type Props = {
  chessyBalance: number;
  onOpenDailyModal?: () => void;
  onOpenChessyShop?: () => void;
};

const NOTES_STORAGE = "aevion_chess_dock_notes_v1";

const SECTIONS: { id: Section; icon: string; label: string }[] = [
  { id: "chessy",  icon: "💰", label: "Chessy" },
  { id: "daily",   icon: "🎯", label: "Daily" },
  { id: "notes",   icon: "📝", label: "Notes" },
  { id: "links",   icon: "🔗", label: "Links" },
  { id: "hotkeys", icon: "⌨", label: "Hotkeys" },
];

export default function WorkspaceDock({ chessyBalance, onOpenDailyModal, onOpenChessyShop }: Props) {
  const [open, setOpen] = useState<Section | null>(null);
  const [notes, setNotes] = useState("");

  // Load notes on mount
  useEffect(() => {
    try { setNotes(localStorage.getItem(NOTES_STORAGE) || ""); } catch {}
  }, []);
  // Persist notes (debounced via setTimeout-pattern would be nice; for short text, immediate is fine)
  useEffect(() => {
    try { localStorage.setItem(NOTES_STORAGE, notes); } catch {}
  }, [notes]);

  // ESC closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) { setOpen(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = useCallback((s: Section) => setOpen(o => o === s ? null : s), []);

  return (
    <>
      {/* Always-visible icon column */}
      <div style={{
        position: "fixed", top: "50%", right: 8, transform: "translateY(-50%)",
        zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 4,
        padding: 4, borderRadius: 12,
        background: "rgba(15,23,42,0.95)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(251,191,36,0.55)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(251,191,36,0.15)",
      }}>
        {SECTIONS.map(s => {
          const active = open === s.id;
          return (
            <button key={s.id} onClick={() => toggle(s.id)} title={s.label}
              style={{
                width: 38, height: 38, borderRadius: 8,
                border: "none", cursor: "pointer",
                background: active ? "#fbbf24" : "transparent",
                color: active ? "#0f172a" : "#cbd5e1",
                fontSize: 16,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s ease",
              }}>{s.icon}</button>
          );
        })}
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{
          position: "fixed", top: "50%", right: 56, transform: "translateY(-50%)",
          zIndex: 9999,
          width: 280, maxHeight: "70vh", overflowY: "auto",
          padding: 14, borderRadius: 12,
          background: "#0f172a", color: "#e2e8f0",
          border: "1px solid rgba(148,163,184,0.20)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.40)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", letterSpacing: 0.5 }}>
              {SECTIONS.find(s => s.id === open)?.icon} {SECTIONS.find(s => s.id === open)?.label}
            </span>
            <span style={{ flex: 1 }} />
            <button onClick={() => setOpen(null)}
              style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
          </div>

          {open === "chessy" && (
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24", textAlign: "center", marginBottom: 8 }}>
                💰 {chessyBalance.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 12 }}>
                Игровая валюта AEVION CyberChess
              </div>
              {onOpenChessyShop && (
                <button onClick={() => { onOpenChessyShop(); setOpen(null); }}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "none",
                    background: "#fbbf24", color: "#0f172a", fontSize: 12, fontWeight: 800, cursor: "pointer",
                  }}>Открыть магазин</button>
              )}
            </div>
          )}

          {open === "daily" && (
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.5 }}>
                Ежедневные задачи дают Chessy и поддерживают streak.
              </div>
              {onOpenDailyModal && (
                <button onClick={() => { onOpenDailyModal(); setOpen(null); }}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "none",
                    background: "#3b82f6", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer",
                  }}>Открыть Daily</button>
              )}
            </div>
          )}

          {open === "notes" && (
            <div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Быстрые заметки — сохраняются автоматически…"
                style={{
                  width: "100%", height: 200, padding: 10,
                  background: "#020617", color: "#e2e8f0",
                  border: "1px solid #1e293b", borderRadius: 8, outline: "none", resize: "vertical",
                  fontSize: 12, lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              />
              <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                Сохранено в браузере. Очистить — выдели и удали.
              </div>
            </div>
          )}

          {open === "links" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { url: "https://lichess.org", label: "♞ Lichess (бесплатные партии)" },
                { url: "https://lichess.org/tv", label: "📺 Lichess TV (live топ)" },
                { url: "https://chess.com", label: "♛ Chess.com" },
                { url: "https://www.youtube.com/@GothamChess", label: "▶ GothamChess (YT)" },
                { url: "https://www.twitch.tv/gmhikaru", label: "🎥 Hikaru (Twitch)" },
                { url: "https://chesstempo.com", label: "🧩 ChessTempo (puzzles)" },
              ].map(l => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "block", padding: "8px 10px", borderRadius: 6,
                    background: "#1e293b", color: "#e2e8f0", fontSize: 12, fontWeight: 700,
                    textDecoration: "none", transition: "background 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#334155")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#1e293b")}>
                  {l.label}
                </a>
              ))}
            </div>
          )}

          {open === "hotkeys" && (
            <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.7 }}>
              {[
                ["1..5",  "Workspace: Focus / Standard / Stream / Study / Coach"],
                ["?",     "Показать / скрыть подсказку клавиш"],
                ["S",     "Скопировать ссылку на текущую позицию (FEN)"],
                ["F",     "Перевернуть доску"],
                ["M",     "Mute / unmute звук"],
                ["N",     "Новая партия (в Play)"],
                ["R",     "Репертуар дебютов"],
                ["←  →",  "Назад / вперёд по ходам"],
                ["ESC",   "Закрыть док / модалку"],
                ["ПКМ",   "Стрелка / подсветка клетки"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, alignItems: "center", padding: "3px 0" }}>
                  <kbd style={{
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    background: "#1e293b", color: "#fbbf24",
                    padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800,
                    textAlign: "center",
                  }}>{k}</kbd>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
