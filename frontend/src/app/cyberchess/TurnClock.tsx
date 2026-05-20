"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Realtime turn clock — circular SVG progress ring + sub-second tick
 * для активного игрока + 3-цветные зоны (зелёный > yellowAt, жёлтый > redAt,
 * красный ниже).
 *
 * `time` приходит сверху из useTimer (тик раз в секунду). Sub-second precision
 * добавляется локально: при `isActive` ставим setInterval каждые 100ms который
 * интерполирует time вниз. Это даёт визуальное ощущение realtime (без
 * перерасчёта реального state — он остаётся в parent).
 */

type Props = {
  time: number; // оставшиеся секунды (parent useTimer state)
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

export default function TurnClock({ time, ini, isActive, brand, textMute }: Props) {
  // Sub-second tick state — локально интерполирует time между real-state updates.
  // Сбрасывается каждый раз когда parent `time` меняется (т.е. на каждый секундный тик).
  const [subTime, setSubTime] = useState(time);
  const baseTimeRef = useRef(time);
  const baseAtRef = useRef(Date.now());

  useEffect(() => {
    baseTimeRef.current = time;
    baseAtRef.current = Date.now();
    setSubTime(time);
  }, [time]);

  useEffect(() => {
    if (!isActive || time <= 0) return;
    const id = window.setInterval(() => {
      const elapsedMs = Date.now() - baseAtRef.current;
      const next = Math.max(0, baseTimeRef.current - elapsedMs / 1000);
      setSubTime(next);
    }, 100);
    return () => window.clearInterval(id);
  }, [isActive, time]);

  // Tick sound в последние 5 секунд активного хода — один beep на каждую целую секунду.
  const prevTickRef = useRef<number>(-1);
  useEffect(() => {
    if (!isActive || subTime <= 0 || subTime > TICK_SOUND_FROM) {
      prevTickRef.current = -1;
      return;
    }
    const intSec = Math.ceil(subTime);
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
  }, [subTime, isActive]);

  // Circular progress: % оставшегося от ini. Если ini=0 (untimed) — пустое кольцо.
  const pct = ini > 0 ? Math.max(0, Math.min(1, subTime / ini)) : 0;
  const color = colorFor(subTime, brand, textMute, isActive);
  const size = 56;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const pulse = isActive && subTime <= RED_AT && subTime > 0;

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
        fontSize: subTime < 60 ? 13 : 12,
        fontWeight: 900,
        fontFamily: "ui-monospace,monospace",
        letterSpacing: -0.4,
        color,
        transition: "color 200ms",
        userSelect: "none" as const,
      }}>
        {fmtPrecise(subTime)}
      </div>
    </div>
  );
}
