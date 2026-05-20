"use client";

import { useState } from "react";

/**
 * Avatar emoji picker — modal со списком popular emoji для замены
 * стандартной 👤 иконки игрока. Активируется когда у юзера owned
 * `avatar_emoji` (shop v2 item).
 *
 * Выбор сохраняется в localStorage key `cc_avatar_emoji_v1` (string).
 * Page.tsx читает это значение и рендерит в PRow вместо "👤".
 */

const EMOJI_CATEGORIES: { label: string; emoji: string[] }[] = [
  { label: "Люди", emoji: ["👤","🧑","👨","👩","🧒","👴","👵","🤴","👸","🧙","🧚","🦸","🦹","🥷","🧛"] },
  { label: "Лица", emoji: ["😀","😎","🤩","🥳","🤓","😈","🤖","👻","💀","👽","👹","👺","🤠","🧐","🤖"] },
  { label: "Шахматы", emoji: ["♟","♙","♗","♘","♖","♕","♔","♚","♛","♜","♝","♞","♟"] },
  { label: "Знаки", emoji: ["⭐","🌟","✨","💫","⚡","🔥","💎","🏆","👑","🎯","🎲","🎮","🎨","🎵"] },
  { label: "Животные", emoji: ["🦁","🐺","🦅","🦉","🐉","🦄","🐲","🐱","🦊","🐯","🐼","🐧","🦋","🐝"] },
  { label: "Природа", emoji: ["🌙","☀","🌎","🌍","🌌","🌊","🌋","⛰","🌲","🌸","🌹","🍀","🍃","🌿"] },
];

type Props = {
  open: boolean;
  onClose: () => void;
  current: string;
  onSelect: (emoji: string) => void;
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  brand: string;
};

export default function AvatarPicker({
  open, onClose, current, onSelect,
  surface1, surface2, border, text, textDim, brand,
}: Props) {
  const [category, setCategory] = useState(0);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 290,
        background: "rgba(15,23,42,0.62)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: surface1, color: text,
          borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.36)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "14px 18px", borderBottom: `1px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: text }}>
              🎭 Аватар
            </h2>
            <div style={{ fontSize: 11, color: textDim, marginTop: 2 }}>
              Выбери emoji вместо стандартной иконки
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: surface2, border: `1px solid ${border}`,
              fontSize: 20,
            }}>{current}</div>
            <button onClick={onClose} aria-label="Close"
              style={{
                width: 32, height: 32, border: `1px solid ${border}`,
                borderRadius: 8, background: surface2, color: text,
                cursor: "pointer", fontSize: 16,
              }}>✕</button>
          </div>
        </div>

        {/* Categories */}
        <div style={{
          padding: "8px 12px", borderBottom: `1px solid ${border}`,
          display: "flex", flexWrap: "wrap", gap: 4,
        }}>
          {EMOJI_CATEGORIES.map((c, i) => {
            const active = category === i;
            return (
              <button key={c.label} onClick={() => setCategory(i)}
                style={{
                  padding: "4px 10px", border: `1px solid ${active ? brand : border}`,
                  borderRadius: 999, background: active ? `${brand}15` : surface2,
                  color: active ? brand : textDim,
                  fontSize: 11, fontWeight: 800, cursor: "pointer",
                }}>{c.label}</button>
            );
          })}
        </div>

        {/* Grid */}
        <div style={{
          padding: 12,
          display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6,
        }}>
          {EMOJI_CATEGORIES[category].emoji.map(e => {
            const selected = e === current;
            return (
              <button key={e} onClick={() => { onSelect(e); onClose(); }}
                title={e}
                style={{
                  aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid ${selected ? brand : "transparent"}`,
                  background: selected ? `${brand}15` : surface2,
                  borderRadius: 8, cursor: "pointer", fontSize: 22,
                  transition: "all 120ms",
                }}>{e}</button>
            );
          })}
        </div>

        <div style={{
          padding: "8px 14px", borderTop: `1px solid ${border}`,
          fontSize: 10, color: textDim, textAlign: "center" as const,
        }}>
          Выбор сохранится автоматически и применится в часах + истории партий
        </div>
      </div>
    </div>
  );
}
