/* AEVION CyberChess — First-Visit Onboarding Overlay.

   ONE screen shown the first time a visitor lands on /cyberchess: pick an
   intent — Играть / Учиться / Пазлы — and land straight in that mode.

   Previously this was a 3-step color/AI/time wizard whose result was written
   to localStorage but never read, and it was followed by TWO more modals
   (welcome-reward + a 4-slide tour) — three stacked overlays a newcomer had to
   dismiss before doing anything. Now it's a single choice that routes directly;
   the +50 welcome is a toast and the tour is opt-in (help menu / command palette).

   THEME-AWARE: palette derives from the app's colour theme (light|dark) via
   `mode`, using the brand green→emerald accent. Inline-styled to match the rest
   of the cyberchess surface (no Tailwind).
*/

"use client";

// Число уроков — из данных. Вписанное рядом с источником оно устаревает
// молча: 28.08.2026 то же «14» стояло в трёх местах сразу.
import { LESSONS } from "./coachLessons";

export type OnboardingChoice = {
  intent: "play" | "learn" | "puzzles";
};

type Palette = {
  backdrop: string;
  modalBg: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentGrad: string;
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

function makePalette(mode: "light" | "dark"): Palette {
  const accentGrad = "linear-gradient(135deg, #059669, #10b981 55%, #7c3aed 140%)";
  if (mode === "light") {
    return {
      backdrop: "rgba(15, 23, 42, 0.42)",
      modalBg: "#ffffff",
      border: "#e2e8f0",
      text: "#0f172a",
      textMuted: "#64748b",
      accent: "#059669",
      accentGrad,
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
    accentGrad: "linear-gradient(135deg, #059669, #34d399 55%, #a78bfa 140%)",
    selectedSoft: "rgba(52,211,153,0.12)",
    tileBg: "#232633",
  };
}

const FONT = "system-ui, sans-serif";

const INTENTS: Array<{
  intent: "play" | "learn" | "puzzles";
  icon: string;
  title: string;
  hint: string;
}> = [
  { intent: "play", icon: "♟", title: "Играть", hint: "Партия против AI 800–2400 — 5 секунд до старта" },
  { intent: "learn", icon: "🎓", title: "Учиться", hint: `Курс из ${LESSONS.length} уроков и живой ИИ-тренер` },
  { intent: "puzzles", icon: "⚡", title: "Задачи", hint: "Тысячи задач под твой уровень" },
];

export default function OnboardingOverlay({ onComplete, onSkip, mode = "dark" }: Props) {
  const p = makePalette(mode);

  function pick(intent: "play" | "learn" | "puzzles") {
    markOnboardingDone();
    onComplete({ intent });
  }

  function handleSkip() {
    markOnboardingDone();
    if (onSkip) onSkip();
    else onComplete({ intent: "play" });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="С чего начать в CyberChess"
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
          maxWidth: 540,
          width: "100%",
          background: p.modalBg,
          border: `1px solid ${p.border}`,
          borderRadius: 16,
          padding: 32,
          boxShadow:
            mode === "light"
              ? "0 24px 60px -18px rgba(15,23,42,0.35)"
              : "0 20px 60px rgba(0,0,0,0.55)",
        }}
      >
        {/* Brand accent hairline at the top edge. */}
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
          aria-label="Пропустить"
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

        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, textAlign: "center", color: p.text }}>
          Добро пожаловать в CyberChess
        </h2>
        <p style={{ margin: "8px 0 22px", fontSize: 14, color: p.textMuted, textAlign: "center", lineHeight: 1.5 }}>
          С чего начнём? Выбор можно сменить в любой момент — вкладки сверху.
          <br />
          <span style={{ color: p.accent, fontWeight: 700 }}>+50 Chessy</span> уже на счёте.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {INTENTS.map((opt) => (
            <button
              key={opt.intent}
              type="button"
              onClick={() => pick(opt.intent)}
              style={{
                minHeight: 128,
                padding: "18px 14px",
                background: p.tileBg,
                border: `2px solid ${p.border}`,
                borderRadius: 14,
                color: p.text,
                cursor: "pointer",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "border-color 160ms ease, transform 160ms ease, background 160ms ease",
                fontFamily: FONT,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = p.accent;
                e.currentTarget.style.background = p.selectedSoft;
                e.currentTarget.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = p.border;
                e.currentTarget.style.background = p.tileBg;
                e.currentTarget.style.transform = "none";
              }}
            >
              <span style={{ fontSize: 36, lineHeight: 1 }}>{opt.icon}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{opt.title}</span>
              <span style={{ fontSize: 12, color: p.textMuted, lineHeight: 1.35 }}>{opt.hint}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: "transparent",
              border: `1px solid ${p.border}`,
              color: p.textMuted,
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Просто осмотрюсь
          </button>
        </div>
      </div>
    </div>
  );
}
