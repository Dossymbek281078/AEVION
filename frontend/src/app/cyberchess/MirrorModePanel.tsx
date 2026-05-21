"use client";

import React from "react";
import type { PlayerProfile } from "./mirrorMode";
import { useCcI18n } from "./i18n";

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
  const { t } = useCcI18n();
  const hasEnough = profile !== null && (profile.estimatedElo > 800 || profile.favoriteOpenings.length > 0);
  const gamesNote = profile ? t("mirror.studied") : t("mirror.no_data");
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
              {t("mirror.plays_like_you")}
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
          {t("mirror.need_games")}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: textDim, lineHeight: 1.5 }}>
          ELO ~{profile!.estimatedElo} · {t("mirror.depth")} {profile!.stockfishDepth} · {t("mirror.fav_opening")}{" "}
          {firstOpening ? (
            <span style={{ color: text, fontWeight: 600 }}>{firstOpening}</span>
          ) : (
            <span style={{ color: textDim }}>{t("mirror.unknown")}</span>
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
