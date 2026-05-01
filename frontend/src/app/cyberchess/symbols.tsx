"use client";
import * as React from "react";

/* ══════════════════════════════════════════════════════════════════════
   AEVION CyberChess — Identity Symbol System

   Каждый раздел / тип контента имеет свой знак:
   • уникальный SVG-глиф (НЕ emoji — узнаваемый и резкий)
   • основной цвет
   • градиент-фон для плашки
   • короткий label

   Используем их как «жетоны» — на табах, картах, знаках в menu.
   Цель: одного взгляда хватает чтобы понять «это про игру / про
   тренировку / про разбор / про турнир».
   ══════════════════════════════════════════════════════════════════════ */

export type SymbolId =
  | "play"
  | "puzzle"
  | "coach"
  | "analysis"
  | "masters"
  | "variants"
  | "training"
  | "tournament"
  | "tools"
  | "knowledge"
  | "endgame";

export type SymbolToken = {
  id: SymbolId;
  label: string;
  short: string;          // 2-3 буквы для tag-pill
  color: string;          // primary
  bg: string;             // soft background
  gradient: string;       // CSS linear-gradient string
  ring: string;           // glow/ring color rgba
  hint: string;           // 1-line описание
  icon: (props: { size?: number; color?: string }) => React.ReactElement;
};

const Glyph: Record<SymbolId, (s: number, c: string) => React.ReactElement> = {
  /* ▶ play — острый треугольник */
  play: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 5.5v13L19 12 7 5.5z" fill={c} />
    </svg>
  ),
  /* ◆ puzzle — ромб с прорезью */
  puzzle: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l9 9-9 9-9-9 9-9z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 8.5v7M8.5 12h7" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  /* ★ coach — звезда-академия */
  coach: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l2.6 5.4 5.9.85-4.3 4.2 1 5.85L12 16.6l-5.2 2.7 1-5.85L3.5 9.25l5.9-.85L12 3z" fill={c} />
    </svg>
  ),
  /* ⚡ analysis — молния */
  analysis: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13.5 2.5l-8 11h6l-2 8 8.5-11.5h-6.5l2-7.5z" fill={c} />
    </svg>
  ),
  /* ♛ masters — корона */
  masters: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 9l3 9h12l3-9-4.5 3.5L12 5l-4.5 7.5L3 9z" fill={c} />
      <rect x="5.5" y="18.5" width="13" height="2" rx="0.6" fill={c} />
    </svg>
  ),
  /* 🎲 variants — куб с гранями */
  variants: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" stroke={c} strokeWidth="1.4" strokeLinejoin="round" opacity="0.85" />
    </svg>
  ),
  /* 🎯 training — мишень */
  training: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.7" />
      <circle cx="12" cy="12" r="5.5" stroke={c} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill={c} />
    </svg>
  ),
  /* 🏆 tournament — кубок */
  tournament: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 4h10v4a5 5 0 01-10 0V4zM3 6h4v2a4 4 0 004 4h2a4 4 0 004-4V6h4v3a5 5 0 01-5 5h-1l1 4H8l1-4H8a5 5 0 01-5-5V6z" fill={c} />
      <rect x="9" y="18" width="6" height="2.5" rx="0.5" fill={c} />
    </svg>
  ),
  /* ⚙ tools — шестерня */
  tools: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" stroke={c} strokeWidth="1.6" />
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M18.5 5.5l-2 2M7.5 16.5l-2 2M18.5 18.5l-2-2M7.5 7.5l-2-2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  /* 📚 knowledge — раскрытая книга */
  knowledge: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 5.5C5.5 4 9 4 12 5.5 15 4 18.5 4 21 5.5v13C18.5 17 15 17 12 18.5 9 17 5.5 17 3 18.5v-13z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 5.5v13" stroke={c} strokeWidth="1.4" />
    </svg>
  ),
  /* 🏰 endgame — ладья-башня */
  endgame: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 4h2v3h3V4h4v3h3V4h2v5l-2 2v6l2 2v2H5v-2l2-2v-6L5 9V4z" fill={c} />
    </svg>
  ),
};

const make = (
  id: SymbolId,
  label: string,
  short: string,
  color: string,
  bgRgba: string,
  gradFrom: string,
  gradTo: string,
  ringRgba: string,
  hint: string
): SymbolToken => ({
  id, label, short, color,
  bg: bgRgba,
  gradient: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
  ring: ringRgba,
  hint,
  icon: ({ size = 16, color: cc }) => Glyph[id](size, cc || color),
});

/* ─── Каталог ─── */
export const SYM: Record<SymbolId, SymbolToken> = {
  play:        make("play",        "Игра",          "PLY", "#059669", "rgba(5,150,105,0.10)",   "#10b981", "#059669", "rgba(5,150,105,0.32)",  "Сыграть партию против AI или с другом"),
  puzzle:      make("puzzle",      "Задачи",        "PZL", "#2563eb", "rgba(37,99,235,0.10)",   "#3b82f6", "#1d4ed8", "rgba(37,99,235,0.32)",  "Тактические задачи с растущей сложностью"),
  coach:       make("coach",       "Тренер",        "CCH", "#7c3aed", "rgba(124,58,237,0.10)",  "#a78bfa", "#7c3aed", "rgba(124,58,237,0.32)", "AI-тренер, разбор партии, база знаний"),
  analysis:    make("analysis",    "Анализ",        "ANL", "#ea580c", "rgba(234,88,12,0.10)",   "#fb923c", "#ea580c", "rgba(234,88,12,0.32)",  "Stockfish, MultiPV, игра «угадай ход»"),
  masters:     make("masters",     "Мастера",       "MST", "#854d0e", "rgba(133,77,14,0.10)",   "#facc15", "#854d0e", "rgba(133,77,14,0.32)",  "Партии чемпионов мира — изучай или угадывай"),
  variants:    make("variants",    "Варианты",      "VAR", "#dc2626", "rgba(220,38,38,0.10)",   "#f87171", "#b91c1c", "rgba(220,38,38,0.32)",  "Fischer 960, KotH, Atomic, Diceblade и ещё 8"),
  training:    make("training",    "Тренажёр",      "TRN", "#0d9488", "rgba(13,148,136,0.10)",  "#2dd4bf", "#0d9488", "rgba(13,148,136,0.32)", "Координаты, личность, Game DNA"),
  tournament:  make("tournament",  "Турниры",       "TRN", "#d97706", "rgba(217,119,6,0.10)",   "#fbbf24", "#d97706", "rgba(217,119,6,0.32)",  "Свисс, Round-Robin, Knockout локально"),
  tools:       make("tools",       "Инструменты",   "TLS", "#475569", "rgba(71,85,105,0.10)",   "#94a3b8", "#475569", "rgba(71,85,105,0.32)",  "Insights, Editor, Settings"),
  knowledge:   make("knowledge",   "База знаний",   "KNW", "#0369a1", "rgba(3,105,161,0.10)",   "#38bdf8", "#0369a1", "rgba(3,105,161,0.32)",  "Тактика, эндшпиль, дебюты, стратегия"),
  endgame:     make("endgame",     "Эндшпиль",      "EG",  "#65a30d", "rgba(101,163,13,0.10)",  "#84cc16", "#65a30d", "rgba(101,163,13,0.32)", "Тренажёр базовых эндшпильных техник"),
};

/* ═══════════════════════════════════════════════════════════════════════
   Компоненты для повторного использования
   ═══════════════════════════════════════════════════════════════════════ */

/* Маленькая «таблетка» — иконка + label, для списков карточек */
export function SymBadge({
  sym, size = "md", showLabel = true, onClick, title,
}: {
  sym: SymbolId | SymbolToken;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const t = typeof sym === "string" ? SYM[sym] : sym;
  const dims = {
    sm: { iconBox: 22, icon: 14, padX: 8, padY: 3, fontSize: 11, gap: 5, labelSize: 10 },
    md: { iconBox: 28, icon: 16, padX: 10, padY: 4, fontSize: 12, gap: 6, labelSize: 11 },
    lg: { iconBox: 34, icon: 19, padX: 12, padY: 5, fontSize: 13, gap: 7, labelSize: 12 },
  }[size];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { onClick, type: "button" as const } : {})}
      title={title || t.hint}
      style={{
        display: "inline-flex", alignItems: "center", gap: dims.gap,
        padding: `${dims.padY}px ${dims.padX}px ${dims.padY}px ${dims.padY + 2}px`,
        background: t.bg,
        border: `1px solid ${t.color}33`,
        borderRadius: 999,
        cursor: onClick ? "pointer" : "default",
        ...(onClick && { font: "inherit" }),
      }}>
      <span style={{
        width: dims.iconBox, height: dims.iconBox,
        background: t.gradient, borderRadius: "50%",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 2px 6px ${t.ring}`, color: "#fff",
      }}>
        <t.icon size={dims.icon} color="#fff" />
      </span>
      {showLabel && (
        <span style={{ fontSize: dims.labelSize, fontWeight: 800, color: t.color, letterSpacing: 0.2 }}>
          {t.label}
        </span>
      )}
    </Tag>
  );
}

/* Большой «жетон»-плашка — заголовок текущего раздела */
export function SymCrest({ sym, subtitle }: { sym: SymbolId | SymbolToken; subtitle?: string }) {
  const t = typeof sym === "string" ? SYM[sym] : sym;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "5px 14px 5px 5px",
      background: t.bg,
      border: `1px solid ${t.color}33`,
      borderRadius: 999,
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: "50%",
        background: t.gradient,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 14px ${t.ring}`, color: "#fff",
      }}>
        <t.icon size={20} color="#fff" />
      </span>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: t.color, letterSpacing: 0.2 }}>
          {t.label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, fontWeight: 700, color: "#5b6474", letterSpacing: 0.3 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

/* Pill-tab элемент — для главной навигации */
export function SymTab({
  sym, active, onClick, count,
}: {
  sym: SymbolId | SymbolToken;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  const t = typeof sym === "string" ? SYM[sym] : sym;
  return (
    <button
      onClick={onClick}
      title={t.hint}
      style={{
        position: "relative",
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 16px 8px 8px",
        background: active ? t.gradient : "transparent",
        border: active ? "none" : `1px solid #e4e7ee`,
        color: active ? "#fff" : "#0f172a",
        borderRadius: 999,
        fontWeight: active ? 900 : 700, fontSize: 13,
        cursor: "pointer",
        boxShadow: active ? `0 6px 18px ${t.ring}` : "none",
        transition: "background 200ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms cubic-bezier(0.4,0,0.2,1), transform 120ms cubic-bezier(0.4,0,0.2,1)",
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: "50%",
        background: active ? "rgba(255,255,255,0.22)" : t.bg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <t.icon size={15} color={active ? "#fff" : t.color} />
      </span>
      <span style={{ letterSpacing: 0.2 }}>{t.label}</span>
      {typeof count === "number" && count > 0 && (
        <span style={{
          minWidth: 20, height: 18, padding: "0 6px",
          borderRadius: 999, background: active ? "rgba(255,255,255,0.22)" : t.bg,
          color: active ? "#fff" : t.color,
          fontSize: 10, fontWeight: 900,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}>{count}</span>
      )}
    </button>
  );
}
