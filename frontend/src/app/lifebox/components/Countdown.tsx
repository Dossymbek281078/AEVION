"use client";

import { useEffect, useState } from "react";

const palette = {
  gold:     "#d4af37",
  goldSoft: "#f5d27a",
  navy:     "#0b1736",
  ink:      "#e7ecf8",
  inkDim:   "#9aa3c0",
};

type Size = "sm" | "md" | "lg";

interface CountdownProps {
  /** ISO timestamp of unlock. */
  target: string;
  size?: Size;
  /** Show a compact one-line summary instead of unit boxes. */
  compact?: boolean;
}

function diffParts(targetMs: number, nowMs: number) {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { totalMs, days, hours, minutes, seconds };
}

export default function Countdown({ target, size = "md", compact = false }: CountdownProps) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { totalMs, days, hours, minutes, seconds } = diffParts(targetMs, now);

  if (totalMs <= 0) {
    return (
      <span
        style={{
          color: palette.gold,
          fontFamily: "monospace",
          fontSize: size === "lg" ? "1.4rem" : size === "md" ? "1rem" : "0.85rem",
          letterSpacing: "0.1em",
        }}
      >
        UNLOCKED
      </span>
    );
  }

  if (compact) {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}д`);
    if (hours > 0 || days > 0) parts.push(`${hours}ч`);
    parts.push(`${minutes}м`);
    if (days === 0) parts.push(`${seconds}с`);
    return (
      <span
        style={{
          color: palette.goldSoft,
          fontFamily: "monospace",
          fontSize: size === "lg" ? "1.4rem" : size === "md" ? "1rem" : "0.85rem",
          letterSpacing: "0.05em",
        }}
      >
        {parts.join(" · ")}
      </span>
    );
  }

  const fontSize =
    size === "lg" ? "2.6rem" : size === "md" ? "1.4rem" : "1rem";
  const labelSize =
    size === "lg" ? "0.7rem" : size === "md" ? "0.6rem" : "0.55rem";

  const Unit = ({ value, label }: { value: number; label: string }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: size === "lg" ? "72px" : size === "md" ? "52px" : "38px",
        padding: size === "lg" ? "12px 8px" : "8px 6px",
        borderRadius: "10px",
        border: `1px solid ${palette.gold}33`,
        background: `linear-gradient(180deg, ${palette.navy}cc, ${palette.navy}99)`,
        boxShadow: `0 0 18px -10px ${palette.gold}aa`,
      }}
    >
      <span
        style={{
          color: palette.goldSoft,
          fontFamily: "monospace",
          fontSize,
          fontWeight: 300,
          lineHeight: 1.05,
        }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span
        style={{
          color: palette.inkDim,
          fontSize: labelSize,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginTop: 4,
        }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Unit value={days} label="дней" />
      <Unit value={hours} label="часов" />
      <Unit value={minutes} label="минут" />
      <Unit value={seconds} label="секунд" />
    </div>
  );
}
