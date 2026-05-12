"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

const RANKS: Array<{ id: string; label: string; min: number }> = [
  { id: "seedling", label: "Seedling", min: 0 },
  { id: "current", label: "Current", min: 50 },
  { id: "wave", label: "Wave", min: 200 },
  { id: "stream", label: "Stream", min: 750 },
  { id: "tide", label: "Tide", min: 2500 },
  { id: "river", label: "River", min: 8000 },
  { id: "ocean", label: "Ocean", min: 25000 },
];

const MODULE_COLORS: Record<string, string> = {
  auth: "#06b6d4",
  build: "#3b82f6",
  bureau: "#f59e0b",
  qgood: "#10b981",
  qcontract: "#14b8a6",
  qsign: "#ec4899",
  qright: "#84cc16",
  qpaynet: "#06b6d4",
  qmaskcard: "#8b5cf6",
  cyberchess: "#fbbf24",
  qcore: "#a78bfa",
  external: "#64748b",
};

type RecentEvent = {
  id: string;
  kind: string;
  sourceModule: string;
  weight: number;
  meta?: Record<string, unknown> | null;
  createdAt: string;
};

type MeResponse = {
  userId: string;
  score: number;
  eventCount: number;
  lastEventAt: string | null;
  rank: { id: string; label: string; min: number; next: number | null };
  recentEvents: RecentEvent[];
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

function pctToNext(score: number, current: number, next: number | null): number {
  if (next === null) return 100;
  if (next <= current) return 100;
  return Math.min(100, Math.max(0, Math.round(((score - current) / (next - current)) * 100)));
}

function shortId(s: string): string {
  if (!s) return "—";
  if (s.length <= 14) return s;
  return s.slice(0, 6) + "…" + s.slice(-6);
}

export default function ZTideMePage() {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MeResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setHydrated(true);
    try {
      const t = typeof window !== "undefined" ? window.localStorage.getItem("aevion_token") : null;
      setToken(t);
    } catch {
      setToken(null);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await fetch(`${getApiBase()}/api/ztide/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        if (cancelled) return;
        if (r.status === 401) {
          setError("auth");
          setData(null);
          return;
        }
        if (!r.ok) {
          setError(`HTTP ${r.status}`);
          setData(null);
          return;
        }
        const json = (await r.json()) as MeResponse;
        if (cancelled) return;
        setData(json);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "network error";
        setError(msg);
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "32px 20px 12px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link href="/z-tide/leaderboard" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← Z-Tide leaderboard</Link>
          <Link href="/z-tide" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← Z-Tide</Link>
        </div>
      </section>

      <section style={{ padding: "8px 20px 64px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {!hydrated || loading ? (
            <LoadingCard />
          ) : !token ? (
            <SignInCard />
          ) : error === "auth" ? (
            <SignInCard reason="Сессия истекла или токен невалиден." />
          ) : error ? (
            <ErrorCard message={error} onRetry={retry} />
          ) : data ? (
            <SuccessView data={data} />
          ) : (
            <ErrorCard message="No data" onRetry={retry} />
          )}
        </div>
      </section>
    </main>
  );
}

function LoadingCard() {
  return (
    <div style={{ padding: 32, background: "#1e293b", border: "1px solid #334155", borderRadius: 14, textAlign: "center", color: "#94a3b8" }}>
      <div style={{ width: 140, height: 18, background: "#334155", borderRadius: 6, margin: "0 auto 14px" }} />
      <div style={{ width: 220, height: 36, background: "#334155", borderRadius: 8, margin: "0 auto 16px" }} />
      <div style={{ width: "100%", height: 8, background: "#334155", borderRadius: 999, margin: "0 auto 12px" }} />
      <div style={{ fontSize: 12 }}>Loading your tide…</div>
    </div>
  );
}

function SignInCard({ reason }: { reason?: string }) {
  return (
    <div style={{ padding: 32, background: "#1e293b", border: "1px solid #334155", borderRadius: 14, textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Z-Tide · Personal</div>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: "8px 0 12px" }}>Sign in to see your tide</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", maxWidth: 460, margin: "0 auto 18px" }}>
        {reason || "Личный рейтинг и история событий доступны только авторизованным."}
      </p>
      <Link
        href="/auth?next=/z-tide/me"
        style={{
          display: "inline-block",
          padding: "10px 18px",
          background: "#34d399",
          color: "#0f172a",
          fontWeight: 800,
          fontSize: 14,
          borderRadius: 999,
          textDecoration: "none",
        }}
      >
        Sign in →
      </Link>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: 28, background: "#1e293b", border: "1px solid #ef444466", borderRadius: 14, textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "#fca5a5", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Error</div>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 16px", wordBreak: "break-word" }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: "8px 18px",
          background: "transparent",
          color: "#34d399",
          border: "1px solid #34d39966",
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}

function SuccessView({ data }: { data: MeResponse }) {
  const currentRank = RANKS.find((r) => r.id === data.rank.id) || RANKS[0];
  const nextRank = RANKS.find((r) => r.min === data.rank.next) || null;
  const currentMin = currentRank.min;
  const nextMin = data.rank.next;
  const pct = pctToNext(data.score, currentMin, nextMin);
  const rankColor = RANK_COLORS[data.rank.id] || "#64748b";

  return (
    <>
      <div
        style={{
          maxWidth: 400,
          margin: "0 auto 18px",
          padding: "28px 24px",
          background: "#1e293b",
          border: `1px solid ${rankColor}55`,
          borderRadius: 16,
          textAlign: "center",
          boxShadow: `0 0 0 1px ${rankColor}22 inset`,
        }}
      >
        <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10 }}>
          Your rank
        </div>
        <div
          style={{
            display: "inline-block",
            padding: "8px 22px",
            background: rankColor + "22",
            border: `1px solid ${rankColor}88`,
            color: rankColor,
            borderRadius: 999,
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: "0.02em",
            marginBottom: 14,
          }}
        >
          {data.rank.label}
        </div>
        <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 4 }}>
          score{" "}
          <span style={{ color: "#34d399", fontWeight: 900, fontSize: 22 }}>{data.score}</span>
          {nextMin !== null && (
            <span style={{ color: "#64748b" }}>
              {" "}
              / {nextMin}
            </span>
          )}
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "#334155",
            borderRadius: 999,
            overflow: "hidden",
            margin: "14px 0 10px",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: rankColor,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#94a3b8" }}>
          <span>{data.eventCount} events</span>
          <span>Last event {timeAgo(data.lastEventAt)}</span>
        </div>
        {nextMin === null ? (
          <div style={{ marginTop: 14, fontSize: 12, color: rankColor, fontWeight: 700 }}>
            Max rank — you’re at the top of the tide
          </div>
        ) : (
          <div style={{ marginTop: 14, fontSize: 11, color: "#64748b" }}>
            {Math.max(0, nextMin - data.score)} more to{" "}
            <span style={{ color: nextRank ? RANK_COLORS[nextRank.id] : "#94a3b8", fontWeight: 700 }}>
              {nextRank?.label || "next"}
            </span>
          </div>
        )}
        <div style={{ marginTop: 14, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: "#475569" }}>
          {shortId(data.userId)}
        </div>
      </div>

      <div
        style={{
          padding: 20,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 14,
          marginBottom: 18,
        }}
      >
        <h2 style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 14px" }}>
          Tide ranks
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RANKS.map((r) => {
            const isCurrent = r.id === data.rank.id;
            const c = RANK_COLORS[r.id] || "#64748b";
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: isCurrent ? c + "12" : "transparent",
                  border: isCurrent ? `1px solid ${c}88` : "1px solid transparent",
                }}
              >
                <div
                  style={{
                    padding: "4px 12px",
                    background: c + "22",
                    border: `1px solid ${c}55`,
                    color: c,
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    minWidth: 96,
                    textAlign: "center",
                  }}
                >
                  {r.label}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>≥ {r.min}</div>
                {isCurrent && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: c, letterSpacing: "0.04em" }}>← you</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          padding: 20,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 14,
          marginBottom: 18,
        }}
      >
        <h2 style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 14px" }}>
          Last 20 contributions
        </h2>
        {data.recentEvents.length === 0 ? (
          <div style={{ padding: 18, background: "#0f172a", border: "1px dashed #334155", borderRadius: 10, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
            No contributions yet. Earn tide by registering a Bureau cert, completing a Build hire, or donating via QGood.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.recentEvents.map((ev) => {
              const mc = MODULE_COLORS[ev.sourceModule] || "#64748b";
              return (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                >
                  <div style={{ flex: 1, color: "#e5e7eb", fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.kind}
                  </div>
                  <div
                    style={{
                      padding: "2px 8px",
                      background: mc + "22",
                      border: `1px solid ${mc}55`,
                      color: mc,
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase" as const,
                    }}
                  >
                    {ev.sourceModule}
                  </div>
                  <div
                    style={{
                      padding: "2px 8px",
                      background: "#10b98122",
                      border: "1px solid #10b98155",
                      color: "#34d399",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      minWidth: 38,
                      textAlign: "center",
                    }}
                  >
                    +{ev.weight}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", minWidth: 56, textAlign: "right" }}>{timeAgo(ev.createdAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 18px", background: "transparent", border: "1px dashed #334155", borderRadius: 12 }}>
        <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
          Tide is soft reputation — non-transferable, decays. Events fire from real ecosystem actions: Bureau cert (+10), Build hire (+15),
          referral success (+20), etc. Top contributors appear on the{" "}
          <Link href="/z-tide/leaderboard" style={{ color: "#34d399", textDecoration: "none" }}>
            global leaderboard
          </Link>
          .
        </p>
      </div>
    </>
  );
}
