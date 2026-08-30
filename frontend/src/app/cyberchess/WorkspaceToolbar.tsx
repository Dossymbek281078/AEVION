"use client";
/**
 * WorkspaceToolbar — compact single-button dropdown for layout presets.
 * Replaces the wide 5-tab strip that consumed ~350px in the header.
 */

import React, { useState } from "react";
import { WORKSPACE_META, type WorkspacePreset } from "./useWorkspace";

// "stream" намеренно исключён из layout-меню — вход в медиа-панель теперь
// единый, через StreamMenu (📺 Стрим) в хедере. См. StreamMenu.tsx.
const ALL: WorkspacePreset[] = ["focus", "standard", "study", "coach"];

const PRESET_DESC: Record<WorkspacePreset, string> = {
  focus:    "Только доска — никакого шума",
  standard: "Доска + информационная панель справа",
  stream:   "Доска + медиа-панель (YouTube/Twitch)",
  study:    "Анализ + AI-коуч рядом",
  coach:    "Доска + AI-коуч справа",
};

type Props = {
  preset: WorkspacePreset;
  onChange: (p: WorkspacePreset) => void;
};

export default function WorkspaceToolbar({ preset, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const m = WORKSPACE_META[preset];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Сменить раскладку (Ctrl+1–5)"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 8,
          border: "1px solid #cbd5e1", background: open ? "#e2e8f0" : "#f1f5f9",
          fontSize: 12, fontWeight: 800, cursor: "pointer", color: "#334155",
          whiteSpace: "nowrap", transition: "background 0.1s",
        }}>
        <span style={{ fontSize: 14 }}>{m.icon}</span>
        <span>{m.name}</span>
        <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: 1 }}>▾</span>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300,
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
            padding: 5, minWidth: 220,
            display: "flex", flexDirection: "column", gap: 1,
          }}>
            <div style={{ padding: "4px 8px 6px", fontSize: 9.5, fontWeight: 900,
              letterSpacing: 1, textTransform: "uppercase", color: "#94a3b8" }}>
              Layout
            </div>
            {ALL.map(p => {
              const meta = WORKSPACE_META[p];
              const active = p === preset;
              return (
                <button key={p} onClick={() => { onChange(p); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 7, border: "none",
                    background: active ? "#f1f5f9" : "transparent",
                    cursor: "pointer", textAlign: "left", width: "100%",
                    transition: "background 0.08s",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <span style={{ fontSize: 16, width: 26, textAlign: "center", flexShrink: 0 }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? "#0f172a" : "#374151" }}>{meta.name}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, lineHeight: 1.2 }}>{PRESET_DESC[p]}</div>
                  </div>
                  <kbd style={{
                    flexShrink: 0, fontSize: 9, fontWeight: 900, padding: "2px 5px",
                    background: active ? "#e2e8f0" : "#f8fafc", border: "1px solid #e2e8f0",
                    borderRadius: 3, color: "#64748b", fontFamily: "ui-monospace,monospace",
                  }}>{meta.key}</kbd>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
