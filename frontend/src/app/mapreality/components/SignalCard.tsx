"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

export type Signal = {
  id: number;
  title: string;
  description: string;
  category: "need" | "event" | "request";
  country: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  author_alias: string;
  support_count: number;
  status: "active" | "resolved" | "flagged";
  created_at: string;
};

const CATEGORY_STYLE: Record<Signal["category"], { bg: string; text: string; label: string }> = {
  need: { bg: "#bae6fd", text: "#075985", label: "Need" },
  event: { bg: "#fef08a", text: "#854d0e", label: "Event" },
  request: { bg: "#bbf7d0", text: "#166534", label: "Request" },
};

function flagFor(country: string): string {
  const c = country.trim().toLowerCase();
  if (c === "kz" || c === "kazakhstan") return "🇰🇿";
  if (c === "ru" || c === "russia") return "🇷🇺";
  if (c === "us" || c === "usa" || c === "united states") return "🇺🇸";
  if (c === "ua" || c === "ukraine") return "🇺🇦";
  if (c === "by" || c === "belarus") return "🇧🇾";
  if (c === "uz" || c === "uzbekistan") return "🇺🇿";
  if (c === "kg" || c === "kyrgyzstan") return "🇰🇬";
  if (c === "tj" || c === "tajikistan") return "🇹🇯";
  if (c === "de" || c === "germany") return "🇩🇪";
  if (c === "fr" || c === "france") return "🇫🇷";
  if (c === "gb" || c === "uk" || c === "united kingdom") return "🇬🇧";
  return "🌍";
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs)) return "";
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function SignalCard({
  signal,
  onSupported,
  supporterAlias,
}: {
  signal: Signal;
  onSupported: (updated: Signal) => void;
  supporterAlias: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const style = CATEGORY_STYLE[signal.category];

  async function support() {
    if (busy) return;
    const alias = supporterAlias.trim();
    if (!alias) {
      setMsg("Set your alias above first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/mapreality/signals/${signal.id}/support`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ supporterAlias: alias }),
      });
      const data = (await r.json()) as { supportCount?: number; error?: string };
      if (r.ok && typeof data.supportCount === "number") {
        onSupported({ ...signal, support_count: data.supportCount });
        setMsg("Supported");
      } else if (r.status === 409 && typeof data.supportCount === "number") {
        onSupported({ ...signal, support_count: data.supportCount });
        setMsg("Already supported");
      } else {
        setMsg(data.error ?? `error ${r.status}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2400);
    }
  }

  return (
    <article
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: `1px solid rgba(148, 163, 184, 0.2)`,
        borderLeft: `4px solid ${style.bg}`,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", margin: 0, lineHeight: 1.3 }}>{signal.title}</h3>
        <span
          style={{
            background: style.bg,
            color: style.text,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          {style.label}
        </span>
      </div>

      <p style={{ fontSize: 13, color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
        {signal.description.length > 200 ? `${signal.description.slice(0, 200)}…` : signal.description}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#94a3b8", flexWrap: "wrap" }}>
        <span>{flagFor(signal.country)} {signal.city ? `${signal.city}, ` : ""}{signal.country}</span>
        <span>by {signal.author_alias}</span>
        <span>{timeAgo(signal.created_at)}</span>
        {signal.status !== "active" && (
          <span style={{ color: signal.status === "resolved" ? "#86efac" : "#fca5a5" }}>{signal.status}</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
        <button
          type="button"
          onClick={support}
          disabled={busy || signal.status !== "active"}
          style={{
            background: signal.status === "active" ? style.bg : "rgba(148,163,184,0.15)",
            color: signal.status === "active" ? style.text : "#94a3b8",
            border: "none",
            borderRadius: 999,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: busy || signal.status !== "active" ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          +1 Support · {signal.support_count}
        </button>
        {msg && <span style={{ fontSize: 11, color: "#94a3b8" }}>{msg}</span>}
      </div>
    </article>
  );
}
