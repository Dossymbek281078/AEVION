"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

const RANK_COLORS: Record<string, string> = {
  seedling: "#84cc16",
  current: "#10b981",
  wave: "#06b6d4",
  stream: "#3b82f6",
  tide: "#8b5cf6",
  river: "#ec4899",
  ocean: "#f59e0b",
};

const RANK_EMOJI: Record<string, string> = {
  seedling: "🌱",
  current: "💧",
  wave: "🌊",
  stream: "🏞️",
  tide: "🌀",
  river: "🏛",
  ocean: "🌌",
};

const FALLBACK_COLOR = "#64748b";

type ZTideMe = {
  score: number;
  rank: { id: string; label: string };
} | null;

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const v = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${v}`;
}

export default function ZTideRankPill(): React.ReactElement | null {
  const [data, setData] = useState<ZTideMe>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" ? window.localStorage.getItem("aevion_token") : null;
    if (!token) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/ztide/me`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        const json = (await res.json()) as {
          score: number;
          rank: { id: string; label: string };
        };
        if (!cancelled) {
          setData({ score: json.score, rank: { id: json.rank.id, label: json.rank.label } });
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !data) return null;

  const color = RANK_COLORS[data.rank.id] ?? FALLBACK_COLOR;
  const emoji = RANK_EMOJI[data.rank.id] ?? "•";
  const scoreText = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(data.score);

  return (
    <Link
      href="/z-tide/me"
      aria-label={`Z-Tide rank ${data.rank.label}, score ${scoreText}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        background: hexWithAlpha(color, 0.15),
        border: `1px solid ${hexWithAlpha(color, 0.35)}`,
        color: "inherit",
        textDecoration: "none",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        maxWidth: 180,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
        {emoji}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{cap(data.rank.label)}</span>
      <span style={{ opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>{scoreText}</span>
    </Link>
  );
}
