"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Realtime turn clock — circular SVG progress ring + sub-second tick
 * для активного игрока + 3-цветные зоны (зелёный > yellowAt, жёлтый > redAt,
 * красный ниже).
 *
 * `getSeconds` is a stable callback reading the parent's deadline-ref clock
 * (see useTimer in page.tsx) directly — TurnClock polls it locally every
 * 100ms via its own `useState`, so the parent (a ~14k-line component) never
 * re-renders just because the clock ticked; only this small component does.
 */

type Props = {
  getSeconds: () => number; // remaining seconds, read live from the parent's clock ref
  ini: number; // initial seconds (для % progress)
  isActive: boolean; // чей сейчас ход
  brand: string;
  textMute: string;
};

const RED_AT = 10;
const YELLOW_AT = 30;
const TICK_SOUND_FROM = 5;

function fmtPrecise(s: number): string {
  if (s <= 0) return "0:00";
  // < 10s — показываем десятые: "5.3"
  if (s < 10) return s.toFixed(1).replace(/\.0$/, "");
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function colorFor(s: number, brand: string, mute: string, isActive: boolean): string {
  if (!isActive) return mute;
  if (s <= RED_AT) return "#ef4444";
  if (s <= YELLOW_AT) return "#f59e0b";
  return brand;
}

export default function TurnClock({ getSeconds, ini, isActive, brand, textMute }: Props) {
  // Local display state — polled from getSeconds(), not driven by a parent prop.
  const [secs, setSecs] = useState(getSeconds);

  useEffect(() => {
    setSecs(getSeconds());
    const id = window.setInterval(() => {
      // Functional update bails out (no re-render) when the value hasn't
      // actually changed, e.g. while the clock is paused/not our turn.
      setSecs((prev) => {
        const next = getSeconds();
        return next === prev ? prev : next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [getSeconds, ini, isActive]);

  // Tick sound в последние 5 секунд активного хода — один beep на каждую целую секунду.
  const prevTickRef = useRef<number>(-1);
  useEffect(() => {
    if (!isActive || secs <= 0 || secs > TICK_SOUND_FROM) {
      prevTickRef.current = -1;
      return;
    }
    const intSec = Math.ceil(secs);
    if (intSec !== prevTickRef.current && intSec > 0) {
      prevTickRef.current = intSec;
      // Lightweight beep via WebAudio — без зависимостей от глобального chessSounds
      // (чтобы TurnClock был standalone-переиспользуемым).
      try {
        const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = intSec <= 3 ? 880 : 660;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.07);
        setTimeout(() => ctx.close().catch(() => {}), 200);
      } catch {}
    }
  }, [secs, isActive]);

  // Circular progress: % оставшегося от ini. Если ini=0 (untimed) — пустое кольцо.
  const pct = ini > 0 ? Math.max(0, Math.min(1, secs / ini)) : 0;
  const color = colorFor(secs, brand, textMute, isActive);
  const size = 56;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const pulse = isActive && secs <= RED_AT && secs > 0;

  if (ini <= 0) {
    // Untimed mode — только цифровой clock без ring
    return (
      <div style={{
        fontSize: 20, fontWeight: 900, fontFamily: "ui-monospace,monospace",
        letterSpacing: -0.5, color: textMute,
        padding: "4px 10px", borderRadius: 6,
      }}>
        ∞
      </div>
    );
  }

  return (
    <div style={{
      position: "relative",
      width: size, height: size,
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "transform 200ms",
      transform: isActive ? "scale(1.0)" : "scale(0.92)",
      animation: pulse ? "cc-clock-pulse 1s ease-in-out infinite" : undefined,
    }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        {/* Background ring */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        {/* Progress ring */}
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: "stroke-dasharray 150ms linear, stroke 200ms" }}
        />
      </svg>
      <div style={{
        fontSize: secs < 60 ? 13 : 12,
        fontWeight: 900,
        fontFamily: "ui-monospace,monospace",
        letterSpacing: -0.4,
        color,
        transition: "color 200ms",
        userSelect: "none" as const,
      }}>
        {fmtPrecise(secs)}
      </div>
    </div>
  );
}
