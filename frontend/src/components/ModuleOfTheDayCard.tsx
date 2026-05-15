"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

/**
 * Shape returned by `GET /api/aevion/module-of-the-day`.
 * Kept narrow (only the fields this widget renders) to stay decoupled
 * from the SDK type — the endpoint owns the contract.
 */
type ModuleOfTheDayResponse = {
  date: string;
  dayOfYear: number;
  registrySize: number;
  module: {
    id: string;
    code?: string;
    name: string;
    description?: string;
    kind?: string;
    status?: string;
    priority?: number;
    tags?: string[];
    frontend?: string;
    ogImage?: string;
    health?: string | null;
    openapi?: string | null;
    relatedModules?: { id: string; name: string; overlap: number }[];
  };
  tomorrow: { id: string; code?: string; name: string };
  generatedAt: string;
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  mvp: { bg: "rgba(16,185,129,0.14)", fg: "#059669" },
  working: { bg: "rgba(16,185,129,0.14)", fg: "#059669" },
  in_progress: { bg: "rgba(14,165,233,0.14)", fg: "#0284c7" },
  planning: { bg: "rgba(168,85,247,0.14)", fg: "#9333ea" },
  idea: { bg: "rgba(100,116,139,0.14)", fg: "#475569" },
};

function pickEmoji(kind?: string, tags?: string[]): string {
  const t = new Set((tags ?? []).map((s) => s.toLowerCase()));
  if (t.has("ai") || t.has("llm")) return "🧠";
  if (t.has("privacy") || t.has("security") || t.has("crypto")) return "🛡️";
  if (t.has("music")) return "🎵";
  if (t.has("film") || t.has("video")) return "🎬";
  if (t.has("game") || t.has("chess")) return "🎮";
  if (t.has("health") || t.has("medical")) return "🩺";
  if (t.has("payment") || t.has("wallet") || t.has("bank")) return "💳";
  if (t.has("kids")) return "🧸";
  if (kind === "product") return "📦";
  if (kind === "service") return "🛠️";
  if (kind === "layer") return "🧬";
  return "✨";
}

/**
 * "Featured today" card. Deterministic daily pick from the AEVION registry —
 * everyone hitting the endpoint on the same UTC day sees the same module.
 *
 * Renders compact, self-contained card with:
 *  - emoji + name + status pill
 *  - kind/code chip
 *  - 1-2 line description
 *  - "Open module →" link
 *  - "Tomorrow: <name>" teaser
 *
 * Defaults to the developer-portal light theme; pass `theme="dark"` for
 * dark-themed surfaces (landing hero, dashboards).
 */
export function ModuleOfTheDayCard({
  theme = "light",
  refreshHourly = false,
}: {
  theme?: "light" | "dark";
  refreshHourly?: boolean;
} = {}) {
  const [data, setData] = useState<ModuleOfTheDayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const r = await fetch(apiUrl("/api/aevion/module-of-the-day"), {
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as ModuleOfTheDayResponse;
        if (alive) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "load-failed");
        }
      }
    };

    load();

    let timer: ReturnType<typeof setInterval> | null = null;
    if (refreshHourly) {
      timer = setInterval(load, 60 * 60 * 1000);
    }

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [refreshHourly]);

  const dark = theme === "dark";

  const surface = dark ? "#0f172a" : "#fff";
  const surfaceMuted = dark ? "rgba(255,255,255,0.04)" : "#f8fafc";
  const border = dark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)";
  const heading = dark ? "#e2e8f0" : "#0f172a";
  const body = dark ? "#cbd5e1" : "#475569";
  const muted = dark ? "#64748b" : "#64748b";
  const accent = "#0d9488";

  if (error) {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          background: surface,
          border: `1px solid ${border}`,
          color: body,
          fontSize: 13,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: accent, textTransform: "uppercase", marginBottom: 6 }}>
          Module of the day
        </div>
        Не удалось загрузить (<code style={{ fontFamily: "ui-monospace, monospace" }}>{error}</code>). Попробуйте обновить страницу.
      </div>
    );
  }

  if (!data) {
    // Skeleton
    return (
      <div
        style={{
          padding: 22,
          borderRadius: 16,
          background: surface,
          border: `1px solid ${border}`,
        }}
        aria-busy="true"
        aria-label="Loading module of the day"
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: accent, textTransform: "uppercase", marginBottom: 12 }}>
          Module of the day
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: surfaceMuted }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 16, width: "55%", borderRadius: 6, background: surfaceMuted, marginBottom: 8 }} />
            <div style={{ height: 12, width: "85%", borderRadius: 6, background: surfaceMuted }} />
          </div>
        </div>
      </div>
    );
  }

  const m = data.module;
  const emoji = pickEmoji(m.kind, m.tags);
  const statusKey = String(m.status ?? "").toLowerCase();
  const statusColor = STATUS_COLOR[statusKey] ?? STATUS_COLOR.idea!;

  const href = `/${m.id}`;

  return (
    <div
      style={{
        padding: 22,
        borderRadius: 16,
        background: surface,
        border: `1px solid ${border}`,
        boxShadow: dark ? "none" : "0 1px 2px rgba(15,23,42,0.04)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top label + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: accent,
            textTransform: "uppercase",
          }}
        >
          Module of the day
        </div>
        <div
          style={{
            fontSize: 11,
            color: muted,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
          title={`Day ${data.dayOfYear} of the year · ${data.registrySize} candidates`}
        >
          {data.date} · day {data.dayOfYear}
        </div>
      </div>

      {/* Main row */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: surfaceMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            flexShrink: 0,
            border: `1px solid ${border}`,
          }}
          aria-hidden="true"
        >
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: heading, lineHeight: 1.2 }}>
              {m.name}
            </div>
            {m.status ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: statusColor.bg,
                  color: statusColor.fg,
                }}
              >
                {statusKey.replace(/_/g, " ")}
              </span>
            ) : null}
            {m.kind ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
                  color: dark ? "#94a3b8" : "#475569",
                }}
              >
                {m.kind}
              </span>
            ) : null}
            {m.code ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: muted,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {m.code}
              </span>
            ) : null}
          </div>
          {m.description ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 13.5,
                color: body,
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {m.description}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              href={href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                background: accent,
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Open module →
            </Link>
            {m.openapi ? (
              <a
                href={m.openapi}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(13,148,136,0.08)",
                  color: accent,
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: "none",
                  border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(13,148,136,0.2)"}`,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                OpenAPI ↗
              </a>
            ) : null}
            {m.health ? (
              <a
                href={m.health}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)",
                  color: dark ? "#cbd5e1" : "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: "none",
                  border: `1px solid ${border}`,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                /health ↗
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tomorrow teaser */}
      {data.tomorrow ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: `1px dashed ${border}`,
            fontSize: 12,
            color: muted,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>
            Завтра:{" "}
            <Link
              href={`/${data.tomorrow.id}`}
              style={{ color: dark ? "#cbd5e1" : "#475569", fontWeight: 700, textDecoration: "underline dotted" }}
            >
              {data.tomorrow.name}
            </Link>
            {data.tomorrow.code ? (
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", marginLeft: 6 }}>
                ({data.tomorrow.code})
              </span>
            ) : null}
          </span>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
            {data.registrySize} модулей в реестре
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default ModuleOfTheDayCard;
