"use client";

import Countdown from "./Countdown";

const palette = {
  gold:     "#d4af37",
  goldSoft: "#f5d27a",
  navy:     "#0b1736",
  navy2:    "#131f3d",
  ink:      "#e7ecf8",
  inkDim:   "#9aa3c0",
  danger:   "#ff7a7a",
};

export interface CapsulePreview {
  id: number;
  title: string;
  category: string;
  unlock_at: string;
  created_at: string;
  unlocked_at: string | null;
  locked: boolean;
  daysUntilUnlock: number;
  content: string | null;
}

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  knowledge:    { label: "Знания",        emoji: "📚" },
  values:       { label: "Ценности",      emoji: "🧭" },
  instructions: { label: "Инструкции",    emoji: "📜" },
  future_self:  { label: "Будущему себе", emoji: "💌" },
  advice:       { label: "Совет",          emoji: "🗝" },
};

interface CapsuleCardProps {
  capsule: CapsulePreview;
  onOpen: (capsule: CapsulePreview) => void;
  onDelete: (capsule: CapsulePreview) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function CapsuleCard({ capsule, onOpen, onDelete }: CapsuleCardProps) {
  const meta = CATEGORY_META[capsule.category] ?? {
    label: capsule.category,
    emoji: "✦",
  };
  const locked = capsule.locked;

  return (
    <div
      style={{
        position: "relative",
        background: locked
          ? `linear-gradient(165deg, ${palette.navy}ee, ${palette.navy2}ee)`
          : `linear-gradient(165deg, ${palette.navy2}dd, ${palette.navy}cc)`,
        border: locked
          ? `1px solid ${palette.gold}30`
          : `1.5px solid ${palette.gold}`,
        borderRadius: 16,
        padding: 18,
        boxShadow: locked
          ? `0 0 24px -16px ${palette.gold}88`
          : `0 0 36px -10px ${palette.gold}cc`,
        transition: "all 0.3s ease",
      }}
    >
      {/* category tag + lock icon row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 12,
        }}
      >
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
        <span
          aria-label={locked ? "Locked" : "Unlocked"}
          style={{
            fontSize: 20,
            color: locked ? palette.inkDim : palette.gold,
            textShadow: locked ? "none" : `0 0 16px ${palette.gold}`,
          }}
          title={locked ? "Запечатано" : "Открыто"}
        >
          {locked ? "🔒" : "🔓"}
        </span>
      </div>

      <h3
        style={{
          margin: 0,
          color: palette.ink,
          fontSize: 16,
          fontWeight: 400,
          letterSpacing: "0.02em",
          lineHeight: 1.3,
        }}
      >
        {capsule.title}
      </h3>

      <div style={{ marginTop: 14 }}>
        {locked ? (
          <>
            <div
              style={{
                color: palette.inkDim,
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Откроется через
            </div>
            <Countdown target={capsule.unlock_at} size="sm" compact />
            <div style={{ color: palette.inkDim, fontSize: 11, marginTop: 8 }}>
              Дата: {formatDate(capsule.unlock_at)}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                color: palette.gold,
                fontSize: 12,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontFamily: "monospace",
                marginBottom: 6,
              }}
            >
              ✦ Открыто
            </div>
            <div style={{ color: palette.inkDim, fontSize: 12 }}>
              Создано: {formatDate(capsule.created_at)}
            </div>
            <div style={{ color: palette.inkDim, fontSize: 12 }}>
              Открыто с: {formatDate(capsule.unlock_at)}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => onOpen(capsule)}
          style={{
            flex: "1 1 auto",
            background: locked ? "transparent" : `linear-gradient(90deg, ${palette.gold}, ${palette.goldSoft})`,
            border: locked
              ? `1px solid ${palette.gold}50`
              : "none",
            color: locked ? palette.goldSoft : palette.navy,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: locked ? 400 : 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {locked ? "Посмотреть" : "✦ Прочитать"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(capsule)}
          aria-label="Удалить капсулу"
          style={{
            background: "transparent",
            border: `1px solid ${palette.danger}40`,
            color: palette.danger,
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          title="Удалить капсулу"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
