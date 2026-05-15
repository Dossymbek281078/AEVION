"use client";

import { useEffect, useRef, useState } from "react";
import { Money } from "./Money";

function useAnimatedValue(target: number, durationMs = 900): number {
  const [value, setValue] = useState<number>(target);
  const prevRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = prevRef.current;
    const to = target;
    if (from === to) return;
    if (prm) {
      setValue(to);
      prevRef.current = to;
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, durationMs]);

  return value;
}

export function AnimatedMoney({
  aec,
  decimals,
  sign,
  compact,
}: {
  aec: number;
  decimals?: number;
  sign?: boolean;
  compact?: boolean;
}) {
  const animated = useAnimatedValue(aec);
  return <Money aec={animated} decimals={decimals} sign={sign} compact={compact} />;
}

export function BalanceTrendIndicator({ balance }: { balance: number }) {
  const prevRef = useRef<number>(balance);
  const [burst, setBurst] = useState<"up" | "down" | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = prevRef.current;
    if (balance === prev) return;
    const direction: "up" | "down" = balance > prev ? "up" : "down";
    setBurst(direction);
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setBurst(null), 1600);
    prevRef.current = balance;
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    };
  }, [balance]);

  if (!burst) return null;
  const color = burst === "up" ? "#059669" : "#dc2626";
  const arrow = burst === "up" ? "▲" : "▼";
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        marginLeft: 6,
        color,
        fontSize: 12,
        fontWeight: 900,
        animation: "aevion-balance-pulse 1.4s ease-out",
      }}
    >
      {arrow}
      <style>{`
        @keyframes aevion-balance-pulse {
          0%   { transform: translateY(4px); opacity: 0; }
          30%  { transform: translateY(0);   opacity: 1; }
          100% { transform: translateY(-14px); opacity: 0; }
        }
      `}</style>
    </span>
  );
}
