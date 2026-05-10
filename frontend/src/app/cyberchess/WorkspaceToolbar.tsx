"use client";
/**
 * WorkspaceToolbar — 5-icon strip for switching workspace presets.
 * Compact, sits in the top header. Tooltip shows hotkey.
 */

import React from "react";
import { WORKSPACE_META, type WorkspacePreset } from "./useWorkspace";

const ALL: WorkspacePreset[] = ["focus", "standard", "stream", "study", "coach"];

type Props = {
  preset: WorkspacePreset;
  onChange: (p: WorkspacePreset) => void;
};

export default function WorkspaceToolbar({ preset, onChange }: Props) {
  return (
    <div
      title="Раскладка экрана: Focus / Standard / Stream / Study / Coach. Переключение клавишами 1..5"
      style={{
        display: "inline-flex", alignItems: "center", gap: 0,
        padding: 3, borderRadius: 9,
        background: "#f1f5f9", border: "1px solid #cbd5e1",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
      }}>
      <span style={{
        fontSize: 9, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase",
        color: "#64748b", padding: "0 8px 0 6px", whiteSpace: "nowrap",
      }}>Layout</span>
      {ALL.map(p => {
        const m = WORKSPACE_META[p];
        const active = p === preset;
        return (
          <button key={p} onClick={() => onChange(p)}
            title={`${m.name} · ${m.hint} · клавиша ${m.key}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: active ? "4px 10px" : "4px 8px",
              border: "none",
              borderRadius: 6,
              background: active ? "#fff" : "transparent",
              color: active ? "#0f172a" : "#64748b",
              fontSize: 12, fontWeight: 800,
              cursor: "pointer",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
              transition: "background 0.12s ease, color 0.12s ease",
            }}>
            <span style={{ fontSize: 13 }}>{m.icon}</span>
            <span>{m.name}</span>
            <span style={{
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 9, fontWeight: 800,
              padding: "0 4px", marginLeft: 2,
              borderRadius: 3,
              background: active ? "#0f172a" : "rgba(15,23,42,0.08)",
              color: active ? "#fbbf24" : "#94a3b8",
            }}>{m.key}</span>
          </button>
        );
      })}
    </div>
  );
}
