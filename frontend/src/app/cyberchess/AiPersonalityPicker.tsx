"use client";

import { useEffect, useState } from "react";
import {
  AI_PERSONALITIES,
  AiPersonality,
  DEFAULT_PERSONALITY_ID,
  loadStoredPersonalityId,
  saveStoredPersonalityId,
} from "./aiPersonalities";

/**
 * AI Personality Picker — модалка с гридом 10 cards, каждая описывает
 * стиль игры одного «гросса». Выбор сохраняется в localStorage
 * (`cc_ai_personality_v1`), parent wire'ит его в существующий
 * ghost/rival AI selection.
 *
 * Style-агностичен — берёт цвета из props (как остальные модалки
 * в cyberchess: AvatarPicker, CoachLessonsModal etc).
 */

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect?: (personality: AiPersonality) => void;

  /** Тематические цвета. Если не переданы — используются дефолты. */
  surface1?: string;
  surface2?: string;
  border?: string;
  text?: string;
  textDim?: string;
  brand?: string;
  brandSoft?: string;
  accent?: string;
};

const DEFAULTS = {
  surface1: "#0F172A",
  surface2: "#1E293B",
  border: "#334155",
  text: "#F1F5F9",
  textDim: "#94A3B8",
  brand: "#38BDF8",
  brandSoft: "rgba(56,189,248,0.16)",
  accent: "#FB7185",
};

export default function AiPersonalityPicker(props: Props) {
  const {
    open,
    onClose,
    onSelect,
    surface1 = DEFAULTS.surface1,
    surface2 = DEFAULTS.surface2,
    border = DEFAULTS.border,
    text = DEFAULTS.text,
    textDim = DEFAULTS.textDim,
    brand = DEFAULTS.brand,
    brandSoft = DEFAULTS.brandSoft,
    accent = DEFAULTS.accent,
  } = props;

  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PERSONALITY_ID);

  // Hydrate from localStorage when модалка открывается.
  useEffect(() => {
    if (!open) return;
    setSelectedId(loadStoredPersonalityId());
  }, [open]);

  if (!open) return null;

  function commit(p: AiPersonality) {
    saveStoredPersonalityId(p.id);
    setSelectedId(p.id);
    onSelect?.(p);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Выбор стиля AI"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 320,
        background: "rgba(2,6,23,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 1100, maxHeight: "90vh",
          background: surface1, color: text,
          borderRadius: 16, boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column",
          border: `1px solid ${border}`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 22px",
          borderBottom: `1px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: text }}>
              🎭 Стиль AI-соперника
            </h2>
            <div style={{ fontSize: 12, color: textDim, marginTop: 4 }}>
              Выбери манеру игры — каждый «гросс» играет по-своему. Сохраняется локально.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent", color: textDim,
              border: `1px solid ${border}`, borderRadius: 8,
              padding: "6px 12px", cursor: "pointer", fontSize: 13,
            }}
          >
            Закрыть
          </button>
        </div>

        {/* Grid */}
        <div style={{
          overflow: "auto",
          padding: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {AI_PERSONALITIES.map(p => (
            <PersonalityCard
              key={p.id}
              personality={p}
              selected={p.id === selectedId}
              onPick={() => commit(p)}
              surface2={surface2}
              border={border}
              text={text}
              textDim={textDim}
              brand={brand}
              brandSoft={brandSoft}
              accent={accent}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 22px",
          borderTop: `1px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12, color: textDim,
        }}>
          <span>
            Текущий: <strong style={{ color: text }}>
              {AI_PERSONALITIES.find(p => p.id === selectedId)?.name ?? "Стандартный"}
            </strong>
          </span>
          <span style={{ opacity: 0.7 }}>
            Полосы стиля — приблизительная подсказка, а не точные веса
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

type CardProps = {
  personality: AiPersonality;
  selected: boolean;
  onPick: () => void;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  brand: string;
  brandSoft: string;
  accent: string;
};

function PersonalityCard({
  personality, selected, onPick,
  surface2, border, text, textDim, brand, brandSoft, accent,
}: CardProps) {
  const { name, realName, emoji, description, eloRange, style, quirks } = personality;

  // 4 ключевых метрики для баров — остальные style-параметры показываем текстом.
  const bars: { label: string; value: number; color: string }[] = [
    { label: "Атака",       value: style.aggressiveness, color: accent },
    { label: "Тактика",     value: style.tacticalBias,    color: "#FACC15" },
    { label: "Позиция",     value: style.positionalBias,  color: brand   },
    { label: "Эндшпиль",    value: style.endgameStrength, color: "#34D399" },
  ];

  return (
    <div
      style={{
        background: selected ? brandSoft : surface2,
        border: `1px solid ${selected ? brand : border}`,
        borderRadius: 12,
        padding: 14,
        display: "flex", flexDirection: "column", gap: 10,
        transition: "border-color 120ms ease, background 120ms ease",
        position: "relative",
      }}
    >
      {selected ? (
        <div style={{
          position: "absolute", top: 8, right: 10,
          fontSize: 10, fontWeight: 800, color: brand,
          letterSpacing: 0.5, textTransform: "uppercase",
        }}>
          выбрано
        </div>
      ) : null}

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: surface2, border: `1px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, flexShrink: 0,
        }}>
          {emoji}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: text, lineHeight: 1.2 }}>
            {name}
          </div>
          {realName ? (
            <div style={{ fontSize: 11, color: textDim, marginTop: 2 }}>
              {realName} · {eloRange[0]}–{eloRange[1]} ELO
            </div>
          ) : (
            <div style={{ fontSize: 11, color: textDim, marginTop: 2 }}>
              {eloRange[0]}–{eloRange[1]} ELO
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: textDim, lineHeight: 1.45 }}>
        {description}
      </div>

      {/* Style bars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {bars.map(b => (
          <StyleBar
            key={b.label}
            label={b.label}
            value={b.value}
            color={b.color}
            border={border}
            text={text}
            textDim={textDim}
          />
        ))}
      </div>

      {/* Quirks */}
      {quirks.length ? (
        <ul style={{
          margin: 0, padding: 0, listStyle: "none",
          display: "flex", flexDirection: "column", gap: 3,
          fontSize: 11, color: textDim,
        }}>
          {quirks.slice(0, 3).map((q, i) => (
            <li key={i} style={{ display: "flex", gap: 6 }}>
              <span style={{ color: brand, flexShrink: 0 }}>·</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Action */}
      <button
        type="button"
        onClick={onPick}
        disabled={selected}
        style={{
          marginTop: "auto",
          background: selected ? "transparent" : brand,
          color: selected ? brand : "#0B1220",
          border: `1px solid ${brand}`,
          borderRadius: 8,
          padding: "8px 12px",
          fontWeight: 800, fontSize: 13,
          cursor: selected ? "default" : "pointer",
          opacity: selected ? 0.7 : 1,
        }}
      >
        {selected ? "Уже выбран" : `Играть с ${name.replace("-style", "")}`}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StyleBar                                                            */
/* ------------------------------------------------------------------ */

function StyleBar({
  label, value, color, border, text, textDim,
}: {
  label: string;
  value: number;
  color: string;
  border: string;
  text: string;
  textDim: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 10, color: textDim,
      }}>
        <span>{label}</span>
        <span style={{ color: text, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{
        height: 6, borderRadius: 3,
        background: border, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${pct}%`, background: color, borderRadius: 3,
          transition: "width 200ms ease",
        }} />
      </div>
    </div>
  );
}
