"use client";

import React, { useEffect, useRef, useState } from "react";

type Opening = { eco: string; name: string; moves: string; desc?: string };

type Props = {
  open: boolean;
  opening: Opening | null;
  currentPly: number;
  isPlayerTurn: boolean;
  onDismiss: () => void;
  surface: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
};

const AUTO_DISMISS_MS = 12_000;

export default function OpeningFlashCard({
  open,
  opening,
  currentPly,
  isPlayerTurn,
  onDismiss,
  surface,
  border,
  text,
  textDim,
  accent,
}: Props) {
  const [showHint, setShowHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset hint visibility when the card opens for a new ply
  useEffect(() => {
    if (open) {
      setShowHint(false);
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !opening) return null;

  // Truncate moves string to show only the next 4 tokens (half-moves)
  const nextFourMoves = opening.moves
    .trim()
    .split(/\s+/)
    .filter((t) => !/^\d+\./.test(t)) // drop move-number tokens like "1."
    .slice(currentPly, currentPly + 4)
    .join(" ") || opening.moves.trim().split(/\s+/).slice(0, 6).join(" ");

  return (
    <>
      <style>{`
        @keyframes ofc-slideIn {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .ofc-card {
          animation: ofc-slideIn 0.28s cubic-bezier(0.34,1.26,0.64,1) both;
        }
        .ofc-btn {
          cursor: pointer;
          border: none;
          padding: 7px 14px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
          transition: opacity 0.15s, transform 0.1s;
          line-height: 1.3;
        }
        .ofc-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .ofc-btn:active { opacity: 1; transform: translateY(0); }
      `}</style>

      <div
        className="ofc-card"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 280,
          zIndex: 200,
          background: surface,
          border: `1.5px solid ${border}`,
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)",
          padding: "14px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              padding: "2px 7px",
              borderRadius: 4,
              background: accent,
              color: "#fff",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              letterSpacing: 0.8,
              flexShrink: 0,
            }}
          >
            {opening.eco}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            title={opening.desc || opening.name}
          >
            {opening.name}
          </span>
          <button
            className="ofc-btn"
            onClick={onDismiss}
            title="Закрыть"
            style={{
              background: "transparent",
              color: textDim,
              padding: "2px 6px",
              fontSize: 14,
              fontWeight: 400,
              borderRadius: 5,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Icon + body */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>📖</span>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: textDim,
              lineHeight: 1.5,
            }}
          >
            Знаешь теорию этого дебюта?
          </p>
        </div>

        {/* Hint block (revealed on demand) */}
        {showHint && (
          <div
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}40`,
              borderRadius: 7,
              padding: "8px 10px",
              fontSize: 12,
              color: text,
              lineHeight: 1.55,
            }}
          >
            <span style={{ fontWeight: 700, color: accent, marginRight: 4 }}>
              продолжение по теории:
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                letterSpacing: 0.3,
              }}
            >
              {nextFourMoves || "—"}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="ofc-btn"
            onClick={onDismiss}
            style={{
              flex: 1,
              background: `${accent}22`,
              color: accent,
              border: `1px solid ${accent}50`,
            }}
          >
            Продолжаю сам 💪
          </button>
          {!showHint && (
            <button
              className="ofc-btn"
              onClick={() => setShowHint(true)}
              style={{
                flex: 1,
                background: "rgba(120,120,140,0.14)",
                color: textDim,
                border: `1px solid ${border}`,
              }}
            >
              Покажи теорию 📚
            </button>
          )}
        </div>
      </div>
    </>
  );
}
