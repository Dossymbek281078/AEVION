/* AEVION CyberChess — First-Visit Onboarding Overlay.

   A 3-step guided modal shown the first time a visitor lands on /cyberchess:
     Step 1 — pick a colour (White / Black / Random)
     Step 2 — pick AI difficulty (5 ELO bands, 800..2400)
     Step 3 — pick time control (Bullet / Blitz / Rapid / Unlimited)

   After all three choices are made the overlay calls onComplete with the
   merged result. A "Skip" button calls onSkip if provided, otherwise
   completes with sensible defaults (random / 1200 / 10+0).

   Inline-styled to match the rest of the cyberchess surface (no Tailwind).
*/

"use client";
import { useState } from "react";

export type OnboardingChoice = {
  color: "w" | "b" | "random";
  aiLevel: 800 | 1200 | 1600 | 2000 | 2400;
  timeControl: "1+0" | "3+0" | "10+0" | "unlimited";
};

type Props = {
  onComplete: (choice: OnboardingChoice) => void;
  onSkip?: () => void;
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

const PALETTE = {
  backdrop: "rgba(2, 6, 23, 0.85)",
  modalBg: "#0f172a",
  border: "#334155",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  accent: "#a78bfa",
  selected: "#34d399",
  tileBg: "#1e293b",
  tileHover: "#283449",
};

const FONT = "system-ui, sans-serif";

const AI_LEVELS: Array<{
  level: 800 | 1200 | 1600 | 2000 | 2400;
  title: string;
  hint: string;
}> = [
  { level: 800, title: "Новичок", hint: "800 ELO — учится правилам" },
  { level: 1200, title: "Любитель", hint: "1200 ELO — играет аккуратно" },
  { level: 1600, title: "Уверенный", hint: "1600 ELO — видит тактику" },
  { level: 2000, title: "Сильный", hint: "2000 ELO — почти эксперт" },
  { level: 2400, title: "Мастер", hint: "2400 ELO — мастерский класс" },
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

export default function OnboardingOverlay({ onComplete, onSkip }: Props) {
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
        background: PALETTE.backdrop,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: FONT,
        color: PALETTE.text,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: 520,
          width: "100%",
          background: PALETTE.modalBg,
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          opacity: fading ? 0 : 1,
          transition: "opacity 180ms ease",
        }}
      >
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
            color: PALETTE.textMuted,
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            padding: 6,
            borderRadius: 6,
          }}
        >
          ×
        </button>

        <ProgressDots step={step} />

        {step === 1 && (
          <ColorStep selected={color} onPick={pickColor} />
        )}
        {step === 2 && (
          <AiStep selected={aiLevel} onPick={pickAi} />
        )}
        {step === 3 && (
          <TimeStep selected={timeControl} onPick={pickTime} />
        )}

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
              style={ghostBtnStyle()}
            >
              ← Назад
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleSkip}
            style={{
              ...ghostBtnStyle(),
              color: PALETTE.textMuted,
            }}
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- step components ---------------- */

function ProgressDots({ step }: { step: 1 | 2 | 3 }) {
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
            background: n <= step ? PALETTE.accent : PALETTE.border,
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
}: {
  selected: "w" | "b" | "random" | null;
  onPick: (c: "w" | "b" | "random") => void;
}) {
  return (
    <div>
      <h2 style={headingStyle()}>Выбери цвет</h2>
      <p style={subStyle()}>Каким цветом хочешь сыграть первую партию?</p>
      <div style={gridStyle()}>
        <Tile
          icon="♔"
          title="Белые"
          hint="Ходишь первым"
          active={selected === "w"}
          onClick={() => onPick("w")}
        />
        <Tile
          icon="♚"
          title="Чёрные"
          hint="Отвечаешь на 1-й ход"
          active={selected === "b"}
          onClick={() => onPick("b")}
        />
        <Tile
          icon="🎲"
          title="Случайный"
          hint="Пусть решит судьба"
          active={selected === "random"}
          onClick={() => onPick("random")}
        />
      </div>
    </div>
  );
}

function AiStep({
  selected,
  onPick,
}: {
  selected: 800 | 1200 | 1600 | 2000 | 2400 | null;
  onPick: (lvl: 800 | 1200 | 1600 | 2000 | 2400) => void;
}) {
  return (
    <div>
      <h2 style={headingStyle()}>Выбери AI-соперника</h2>
      <p style={subStyle()}>Сила движка под твой уровень.</p>
      <div style={gridStyle()}>
        {AI_LEVELS.map((opt) => (
          <Tile
            key={opt.level}
            icon={iconForLevel(opt.level)}
            title={opt.title}
            hint={opt.hint}
            active={selected === opt.level}
            onClick={() => onPick(opt.level)}
          />
        ))}
      </div>
    </div>
  );
}

function TimeStep({
  selected,
  onPick,
}: {
  selected: "1+0" | "3+0" | "10+0" | "unlimited" | null;
  onPick: (tc: "1+0" | "3+0" | "10+0" | "unlimited") => void;
}) {
  return (
    <div>
      <h2 style={headingStyle()}>Контроль времени</h2>
      <p style={subStyle()}>Сколько минут на партию?</p>
      <div style={gridStyle()}>
        {TIME_OPTIONS.map((opt) => (
          <Tile
            key={opt.value}
            icon={iconForTime(opt.value)}
            title={opt.title}
            hint={opt.hint}
            active={selected === opt.value}
            onClick={() => onPick(opt.value)}
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
}: {
  icon: string;
  title: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: 96,
        padding: "14px 12px",
        background: PALETTE.tileBg,
        border: `2px solid ${active ? PALETTE.selected : PALETTE.border}`,
        borderRadius: 12,
        color: PALETTE.text,
        cursor: "pointer",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        transition: "border-color 160ms ease, transform 160ms ease",
        fontFamily: FONT,
        transform: active ? "scale(1.02)" : "scale(1)",
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12, color: PALETTE.textMuted }}>{hint}</span>
    </button>
  );
}

function headingStyle(): React.CSSProperties {
  return {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: PALETTE.text,
    textAlign: "center",
  };
}

function subStyle(): React.CSSProperties {
  return {
    margin: "6px 0 18px 0",
    fontSize: 14,
    color: PALETTE.textMuted,
    textAlign: "center",
  };
}

function gridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
  };
}

function ghostBtnStyle(): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${PALETTE.border}`,
    color: PALETTE.text,
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
