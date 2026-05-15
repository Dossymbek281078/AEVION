"use client";

import { useEffect } from "react";
import Countdown from "./Countdown";
import type { CapsulePreview } from "./CapsuleCard";

const palette = {
  gold:     "#d4af37",
  goldSoft: "#f5d27a",
  navy:     "#0b1736",
  navy2:    "#131f3d",
  ink:      "#e7ecf8",
  inkDim:   "#9aa3c0",
};

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  knowledge:    { label: "Знания",        emoji: "📚" },
  values:       { label: "Ценности",      emoji: "🧭" },
  instructions: { label: "Инструкции",    emoji: "📜" },
  future_self:  { label: "Будущему себе", emoji: "💌" },
  advice:       { label: "Совет",          emoji: "🗝" },
};

interface CapsuleReaderProps {
  capsule: CapsulePreview;
  /** Full content fetched via /unlock — null while locked. */
  fullContent: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CapsuleReader({
  capsule,
  fullContent,
  loading,
  error,
  onClose,
}: CapsuleReaderProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = CATEGORY_META[capsule.category] ?? {
    label: capsule.category,
    emoji: "✦",
  };
  const locked = capsule.locked && !fullContent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 10, 26, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: `linear-gradient(180deg, ${palette.navy2}, ${palette.navy})`,
          border: `1.5px solid ${palette.gold}`,
          borderRadius: 18,
          padding: 28,
          boxShadow: `0 0 60px -10px ${palette.gold}aa`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 999,
                background: `${palette.gold}15`,
                border: `1px solid ${palette.gold}40`,
                color: palette.goldSoft,
                letterSpacing: "0.05em",
              }}
            >
              {meta.emoji} {meta.label}
            </span>
            <h2
              style={{
                margin: "12px 0 0",
                color: palette.goldSoft,
                fontSize: 26,
                fontWeight: 300,
                letterSpacing: "0.02em",
                lineHeight: 1.25,
              }}
            >
              {capsule.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              background: "transparent",
              border: `1px solid ${palette.inkDim}50`,
              color: palette.inkDim,
              fontSize: 18,
              padding: "4px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ color: palette.inkDim, padding: "30px 0", textAlign: "center" }}>
            Открываю капсулу…
          </div>
        ) : error ? (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: `1px solid ${palette.gold}40`,
              background: `${palette.gold}10`,
              color: palette.goldSoft,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : locked ? (
          <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🔒</div>
            <div
              style={{
                color: palette.inkDim,
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Откроется через
            </div>
            <Countdown target={capsule.unlock_at} size="lg" />
            <div style={{ color: palette.inkDim, fontSize: 13, marginTop: 18 }}>
              Дата открытия: {formatDate(capsule.unlock_at)}
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: palette.ink,
                fontSize: 16,
                lineHeight: 1.7,
                padding: "8px 0 18px",
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            >
              {fullContent ?? capsule.content ?? ""}
            </div>
            <div
              style={{
                borderTop: `1px solid ${palette.gold}30`,
                paddingTop: 12,
                color: palette.inkDim,
                fontSize: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <span>📅 Создано: {formatDate(capsule.created_at)}</span>
              <span>🔓 Открыто с: {formatDate(capsule.unlock_at)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
