"use client";

import React from "react";
import type { PlayerProfile } from "./mirrorMode";

type Props = {
  profile: PlayerProfile | null;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  surface: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
};

export default function MirrorModePanel({
  profile,
  active,
  onActivate,
  onDeactivate,
  surface,
  border,
  text,
  textDim,
  accent,
}: Props) {
  const hasEnough = profile !== null && (profile.estimatedElo > 800 || profile.favoriteOpenings.length > 0);
  const gamesNote = profile ? `AI изучил твои последние партии` : "Нет данных об играх";
  const firstOpening = profile?.favoriteOpenings?.[0] ?? null;

  return (
    <div
      style={{
        width: 300,
        background: surface,
        border: `1px solid ${active ? accent : border}`,
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: active ? `0 0 8px ${accent}44` : "0 2px 8px rgba(0,0,0,0.35)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: text }}>🪞 Mirror Mode</span>
          {active && (
            <div style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 1 }}>
              играет как ты
            </div>
          )}
        </div>
        <button
          onClick={hasEnough ? (active ? onDeactivate : onActivate) : undefined}
          disabled={!hasEnough}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: `1px solid ${hasEnough ? accent : border}`,
            background: active ? accent : "transparent",
            color: active ? "#fff" : hasEnough ? accent : textDim,
            fontSize: 12,
            fontWeight: 700,
            cursor: hasEnough ? "pointer" : "not-allowed",
            transition: "all 0.15s",
            opacity: hasEnough ? 1 : 0.55,
          }}
        >
          {active ? "🪞 Mirror ON" : "🪞 Mirror OFF"}
        </button>
      </div>

      {/* Stats or warning */}
      {!hasEnough ? (
        <div style={{ fontSize: 12, color: textDim, padding: "4px 0" }}>
          Нужно 5+ партий для анализа
        </div>
      ) : (
        <div style={{ fontSize: 12, color: textDim, lineHeight: 1.5 }}>
          ELO ~{profile!.estimatedElo} · Глубина {profile!.stockfishDepth} · Любимый дебют:{" "}
          {firstOpening ? (
            <span style={{ color: text, fontWeight: 600 }}>{firstOpening}</span>
          ) : (
            <span style={{ color: textDim }}>нет данных</span>
          )}
        </div>
      )}

      {/* Footer note */}
      <div style={{ fontSize: 10, color: textDim, fontStyle: "italic", marginTop: 6 }}>
        {gamesNote}
      </div>
    </div>
  );
}
