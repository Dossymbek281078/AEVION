/* AEVION CyberChess — First-Visit Onboarding Overlay.

   A 3-step guided modal shown the first time a visitor lands on /cyberchess:
     Step 1 — pick a colour (White / Black / Random)
     Step 2 — pick AI difficulty (5 ELO bands, 800..2400)
     Step 3 — pick time control (Bullet / Blitz / Rapid / Unlimited)

   After all three choices are made the overlay calls onComplete with the
   merged result. A "Skip" button calls onSkip if provided, otherwise
   completes with sensible defaults (random / 1200 / 10+0).

   THEME-AWARE: the palette is derived from the app's colour theme (light|dark)
   passed via `mode`, and uses the brand green→emerald accent (matching the rest
   of CyberChess and the demo style) rather than an off-brand violet. The whole
   palette is threaded through `p` so it stays consistent under React concurrent
   rendering (no module-level mutation during render).

   Inline-styled to match the rest of the cyberchess surface (no Tailwind).
*/

"use client";
import { useState } from "react";

export type OnboardingChoice = {
  color: "w" | "b" | "random";
  aiLevel: 800 | 1200 | 1600 | 2000 | 2400;
  timeControl: "1+0" | "3+0" | "10+0" | "unlimited";
};

type Palette = {
  backdrop: string;
  modalBg: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accent2: string;
  accentGrad: string;
  selected: string;
  selectedSoft: string;
  tileBg: string;
};

type Props = {
  onComplete: (choice: OnboardingChoice) => void;
  onSkip?: () => void;
  /** App colour theme — the overlay adapts so the very first screen a visitor
      sees is consistent with the app behind it. Defaults to dark. */
  mode?: "light" | "dark";
};

export const ONBOARDING_KEY = "aevion_cyberchess_onboarding_done_v1";

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

/* Brand accent is the CyberChess green→emerald; violet is a secondary touch,
   mirroring the demo. Both palettes keep contrast legible on their ground. */
function makePalette(mode: "light" | "dark"): Palette {
  const accent = "#059669"; // brand green
  const accent2 = "#7c3aed"; // secondary violet
  const accentGrad = "linear-gradient(135deg, #059669, #10b981 55%, #7c3aed 140%)";
  if (mode === "light") {
    return {
      backdrop: "rgba(15, 23, 42, 0.42)",
      modalBg: "#ffffff",
      border: "#e2e8f0",
      text: "#0f172a",
      textMuted: "#64748b",
      accent,
      accent2,
      accentGrad,
      selected: accent,
      selectedSoft: "rgba(5,150,105,0.10)",
      tileBg: "#f8fafc",
    };
  }
  return {
    backdrop: "rgba(2, 6, 23, 0.82)",
    modalBg: "#1b1d27",
    border: "#2d3140",
    text: "#f1f5f9",
    textMuted: "#9aa0b4",
    accent: "#34d399",
    accent2: "#a78bfa",
    accentGrad: "linear-gradient(135deg, #059669, #34d399 55%, #a78bfa 140%)",
    selected: "#34d399",
    selectedSoft: "rgba(52,211,153,0.12)",
    tileBg: "#232633",
  };
}

const FONT = "system-ui, sans-serif";

const AI_LEVELS: Array<{
  level: 800 | 1200 | 1600 | 2000 | 2400;
  title: string;
  hint: string;
}> = [
  { level: 800, title: "Новичок", hint: "800 — зевает фигуры, для самых первых партий" },
  { level: 1200, title: "Любитель", hint: "1200 — знает основы, ошибается в тактике" },
  { level: 1600, title: "Уверенный", hint: "1600 — уверенная тактика, нужен план" },
  { level: 2000, title: "Сильный", hint: "2000 — наказывает ошибки, почти эксперт" },
  { level: 2400, title: "Мастер", hint: "2400 — почти без слабых ходов" },
];

const TIME_OPTIONS: Array<{
  value: "1+0" | "3+0" | "10+0" | "unlimited";
  title: string;
  hint: string;
}> = [
  { value: "1+0", title: "1+0 Bullet", hint: "1 минута на партию" },
  { value: "3+0", title: "3+0 Blitz", hint: "3 минуты на партию" },
  { value: "10+0", title: "10+0 Rapid", hint: "10 минут на партию" },
  { value: "unlimited", title: "Без часов", hint: "Думайте сколько надо" },
];

export default function OnboardingOverlay({ onComplete, onSkip, mode = "dark" }: Props) {
  const p = makePalette(mode);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [color, setColor] = useState<"w" | "b" | "random" | null>(null);
  const [aiLevel, setAiLevel] = useState<
    800 | 1200 | 1600 | 2000 | 2400 | null
  >(null);
  const [timeControl, setTimeControl] = useState<
    "1+0" | "3+0" | "10+0" | "unlimited" | null
  >(null);
  const [fading, setFading] = useState(false);

  function advanceTo(next: 1 | 2 | 3) {
    setFading(true);
    window.setTimeout(() => {
      setStep(next);
      setFading(false);
    }, 180);
  }

  function pickColor(c: "w" | "b" | "random") {
    setColor(c);
    window.setTimeout(() => advanceTo(2), 500);
  }

  function pickAi(lvl: 800 | 1200 | 1600 | 2000 | 2400) {
    setAiLevel(lvl);
    window.setTimeout(() => advanceTo(3), 500);
  }

  function pickTime(tc: "1+0" | "3+0" | "10+0" | "unlimited") {
    setTimeControl(tc);
    window.setTimeout(() => {
      finish(color ?? "random", aiLevel ?? 1200, tc);
    }, 500);
  }

  function finish(
    c: "w" | "b" | "random",
    lvl: 800 | 1200 | 1600 | 2000 | 2400,
    tc: "1+0" | "3+0" | "10+0" | "unlimited",
  ) {
    markOnboardingDone();
    onComplete({ color: c, aiLevel: lvl, timeControl: tc });
  }

  function handleSkip() {
    markOnboardingDone();
    if (onSkip) {
      onSkip();
    } else {
      onComplete({ color: "random", aiLevel: 1200, timeControl: "10+0" });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Первоначальная настройка CyberChess"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: p.backdrop,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: FONT,
        color: p.text,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: 520,
          width: "100%",
          background: p.modalBg,
          border: `1px solid ${p.border}`,
          borderRadius: 16,
          padding: 32,
          boxShadow:
            mode === "light"
              ? "0 24px 60px -18px rgba(15,23,42,0.35)"
              : "0 20px 60px rgba(0,0,0,0.55)",
          opacity: fading ? 0 : 1,
          transition: "opacity 180ms ease",
        }}
      >
        {/* Brand accent hairline at the top edge — ties the first screen to the
            green→violet demo palette. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 24,
            right: 24,
            height: 3,
            borderRadius: 999,
            background: p.accentGrad,
          }}
        />
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Пропустить онбординг"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            color: p.textMuted,
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            padding: 6,
            borderRadius: 6,
          }}
        >
          ×
        </button>

        <ProgressDots step={step} p={p} />

        {step === 1 && <ColorStep selected={color} onPick={pickColor} p={p} />}
        {step === 2 && <AiStep selected={aiLevel} onPick={pickAi} p={p} />}
        {step === 3 && <TimeStep selected={timeControl} onPick={pickTime} p={p} />}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 24,
            gap: 12,
          }}
        >
          {step > 1 ? (
            <button
              type="button"
              onClick={() => advanceTo((step - 1) as 1 | 2 | 3)}
              style={ghostBtnStyle(p)}
            >
              ← Назад
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleSkip}
            style={{ ...ghostBtnStyle(p), color: p.textMuted }}
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- step components ---------------- */

function ProgressDots({ step, p }: { step: 1 | 2 | 3; p: Palette }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        marginBottom: 24,
      }}
      aria-hidden="true"
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{
            width: n === step ? 24 : 10,
            height: 10,
            borderRadius: 999,
            background: n <= step ? p.accent : p.border,
            transition: "all 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

function ColorStep({
  selected,
  onPick,
  p,
}: {
  selected: "w" | "b" | "random" | null;
  onPick: (c: "w" | "b" | "random") => void;
  p: Palette;
}) {
  return (
    <div>
      <h2 style={headingStyle(p)}>Выбери цвет</h2>
      <p style={subStyle(p)}>Каким цветом хочешь сыграть первую партию?</p>
      <div style={gridStyle()}>
        <Tile icon="♔" title="Белые" hint="Ходишь первым" active={selected === "w"} onClick={() => onPick("w")} p={p} />
        <Tile icon="♚" title="Чёрные" hint="Отвечаешь на 1-й ход" active={selected === "b"} onClick={() => onPick("b")} p={p} />
        <Tile icon="🎲" title="Случайный" hint="Пусть решит судьба" active={selected === "random"} onClick={() => onPick("random")} p={p} />
      </div>
    </div>
  );
}

function AiStep({
  selected,
  onPick,
  p,
}: {
  selected: 800 | 1200 | 1600 | 2000 | 2400 | null;
  onPick: (lvl: 800 | 1200 | 1600 | 2000 | 2400) => void;
  p: Palette;
}) {
  return (
    <div>
      <h2 style={headingStyle(p)}>Выбери AI-соперника</h2>
      <p style={subStyle(p)}>Сила движка под твой уровень.</p>
      <div style={gridStyle()}>
        {AI_LEVELS.map((opt) => (
          <Tile
            key={opt.level}
            icon={iconForLevel(opt.level)}
            title={opt.title}
            hint={opt.hint}
            active={selected === opt.level}
            onClick={() => onPick(opt.level)}
            p={p}
          />
        ))}
      </div>
    </div>
  );
}

function TimeStep({
  selected,
  onPick,
  p,
}: {
  selected: "1+0" | "3+0" | "10+0" | "unlimited" | null;
  onPick: (tc: "1+0" | "3+0" | "10+0" | "unlimited") => void;
  p: Palette;
}) {
  return (
    <div>
      <h2 style={headingStyle(p)}>Контроль времени</h2>
      <p style={subStyle(p)}>Сколько минут на партию?</p>
      <div style={gridStyle()}>
        {TIME_OPTIONS.map((opt) => (
          <Tile
            key={opt.value}
            icon={iconForTime(opt.value)}
            title={opt.title}
            hint={opt.hint}
            active={selected === opt.value}
            onClick={() => onPick(opt.value)}
            p={p}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function Tile({
  icon,
  title,
  hint,
  active,
  onClick,
  p,
}: {
  icon: string;
  title: string;
  hint: string;
  active: boolean;
  onClick: () => void;
  p: Palette;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: 96,
        padding: "14px 12px",
        background: active ? p.selectedSoft : p.tileBg,
        border: `2px solid ${active ? p.selected : p.border}`,
        borderRadius: 12,
        color: p.text,
        cursor: "pointer",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        transition: "border-color 160ms ease, transform 160ms ease, background 160ms ease",
        fontFamily: FONT,
        transform: active ? "scale(1.02)" : "scale(1)",
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12, color: p.textMuted }}>{hint}</span>
    </button>
  );
}

function headingStyle(p: Palette): React.CSSProperties {
  return { margin: 0, fontSize: 22, fontWeight: 700, color: p.text, textAlign: "center" };
}

function subStyle(p: Palette): React.CSSProperties {
  return { margin: "6px 0 18px 0", fontSize: 14, color: p.textMuted, textAlign: "center" };
}

function gridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
  };
}

function ghostBtnStyle(p: Palette): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${p.border}`,
    color: p.text,
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: FONT,
  };
}

function iconForLevel(lvl: number): string {
  if (lvl <= 800) return "🐣";
  if (lvl <= 1200) return "♟";
  if (lvl <= 1600) return "♞";
  if (lvl <= 2000) return "♜";
  return "♛";
}

function iconForTime(v: string): string {
  if (v === "1+0") return "⚡";
  if (v === "3+0") return "🔥";
  if (v === "10+0") return "⏱";
  return "♾";
}
