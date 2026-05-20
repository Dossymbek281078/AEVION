"use client";

import { useMemo, useState } from "react";
import {
  ACHIEVEMENTS,
  CATEGORIES,
  Achievement,
  AchievementCategory,
  AchievementContext,
  progressOf,
} from "./chessyAchievements";
import { useCcI18n } from "./i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  achState: Record<string, number>; // id → timestamp unlocked
  context: AchievementContext;
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  textMute: string;
  brand: string;
};

export default function AchievementPanel({
  open, onClose,
  achState, context,
  surface1, surface2, border, text, textDim, textMute, brand,
}: Props) {
  const { t } = useCcI18n();
  const [filter, setFilter] = useState<AchievementCategory | "all">("all");
  const [showLocked, setShowLocked] = useState(true);

  const list = useMemo(() => {
    return ACHIEVEMENTS.filter(a => {
      if (filter !== "all" && a.category !== filter) return false;
      const unlocked = !!achState[a.id];
      if (!showLocked && !unlocked) return false;
      return true;
    });
  }, [filter, showLocked, achState]);

  const unlockedCount = Object.keys(achState).length;
  const totalCount = ACHIEVEMENTS.length;
  const completion = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const totalEarned = ACHIEVEMENTS.filter(a => achState[a.id]).reduce((s, a) => s + a.reward, 0);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 280,
        background: "rgba(15,23,42,0.62)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 720, maxHeight: "92vh",
          background: surface1, color: text,
          borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.36)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: text }}>
              {t("ach.title")}
            </h2>
            <div style={{ fontSize: 12, color: textDim, marginTop: 4 }}>
              {unlockedCount} / {totalCount} ({completion}%) · {t("ach.earned")} {totalEarned}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{
              width: 32, height: 32, border: `1px solid ${border}`,
              borderRadius: 8, background: surface2, color: text,
              cursor: "pointer", fontSize: 16,
            }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{
          padding: "8px 20px 12px", borderBottom: `1px solid ${border}`,
        }}>
          <div style={{
            height: 6, background: surface2, borderRadius: 3, overflow: "hidden",
          }}>
            <div style={{
              width: `${completion}%`, height: "100%",
              background: `linear-gradient(90deg, ${brand}, #a78bfa)`,
              transition: "width 400ms ease",
            }} />
          </div>
        </div>

        {/* Filter chips + locked toggle */}
        <div style={{
          padding: "10px 20px", borderBottom: `1px solid ${border}`,
          display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
        }}>
          {CATEGORIES.map(c => {
            const active = filter === c.id;
            return (
              <button key={c.id} onClick={() => setFilter(c.id)}
                style={{
                  padding: "4px 10px", border: `1px solid ${active ? brand : border}`,
                  borderRadius: 999, background: active ? `${brand}15` : surface2,
                  color: active ? brand : textDim,
                  fontSize: 11, fontWeight: 800, cursor: "pointer",
                  transition: "all 150ms",
                }}>{t(`ach.category.${c.id}`)}</button>
            );
          })}
          <div style={{ flex: 1 }} />
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, color: textMute, cursor: "pointer", userSelect: "none",
          }}>
            <input type="checkbox" checked={showLocked}
              onChange={e => setShowLocked(e.target.checked)} />
            {t("ach.show_locked")}
          </label>
        </div>

        {/* List */}
        <div style={{
          flex: 1, overflowY: "auto", padding: 12,
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 8,
        }}>
          {list.map(a => {
            const unlocked = !!achState[a.id];
            const prog = progressOf(a, context);
            const pct = a.target ? Math.min(100, (prog / a.target) * 100) : (unlocked ? 100 : 0);
            return (
              <div key={a.id} style={{
                padding: "10px 12px", borderRadius: 10,
                background: unlocked ? `${brand}10` : surface2,
                border: `1px solid ${unlocked ? brand : border}`,
                opacity: unlocked ? 1 : 0.86,
                position: "relative",
                transition: "background 200ms, border-color 200ms",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: unlocked ? brand : "rgba(255,255,255,0.05)",
                    color: unlocked ? "#fff" : textMute,
                    fontSize: 19, flexShrink: 0,
                    filter: unlocked ? "none" : "grayscale(1)",
                  }}>
                    {unlocked ? a.icon : "🔒"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: text, lineHeight: 1.25 }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: textDim, lineHeight: 1.35, marginTop: 2 }}>
                      {a.desc}
                    </div>
                    {a.target && !unlocked && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{
                          height: 3, background: "rgba(255,255,255,0.06)",
                          borderRadius: 2, overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${pct}%`, height: "100%", background: brand,
                            transition: "width 300ms",
                          }} />
                        </div>
                        <div style={{
                          fontSize: 9, color: textMute, marginTop: 2,
                          fontFamily: "ui-monospace, monospace", fontWeight: 700,
                        }}>
                          {Math.min(prog, a.target)} / {a.target}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 900,
                    color: unlocked ? brand : textMute,
                    background: unlocked ? "rgba(255,255,255,0.08)" : "transparent",
                    padding: unlocked ? "2px 6px" : 0, borderRadius: 4,
                    whiteSpace: "nowrap" as const,
                  }}>
                    +{a.reward}
                  </div>
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <div style={{
              gridColumn: "1 / -1", padding: 24, textAlign: "center" as const,
              color: textMute, fontSize: 12,
            }}>
              {t("ach.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
