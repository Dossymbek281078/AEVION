import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Z-Tide Leaderboard · AEVION",
  description: "Top contributors across the AEVION ecosystem by Z-Tide tide score.",
  alternates: { canonical: "https://aevion.app/z-tide/leaderboard" },
  robots: { index: true, follow: true },
};

type Row = {
  position: number;
  userId: string;
  score: number;
  eventCount: number;
  rank: string;
  lastEventAt: string | null;
};

type Rank = { id: string; label: string; min: number };
type Stats = {
  active_users: number;
  total_events: number;
  total_weight: string | number;
  top_score: string | number | null;
  ranks: Rank[];
};

async function loadLeaderboard(): Promise<Row[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/ztide/leaderboard?limit=50`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.leaderboard) ? data.leaderboard : [];
  } catch { return []; }
}

async function loadStats(): Promise<Stats | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/ztide/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const RANK_COLORS: Record<string, string> = {
  seedling: "#84cc16",
  current: "#10b981",
  wave: "#06b6d4",
  stream: "#3b82f6",
  tide: "#8b5cf6",
  river: "#ec4899",
  ocean: "#f59e0b",
};

function shortId(s: string): string {
  if (!s) return "—";
  if (s.length <= 14) return s;
  return s.slice(0, 6) + "…" + s.slice(-6);
}

export default async function ZTideLeaderboardPage() {
  const [rows, stats] = await Promise.all([loadLeaderboard(), loadStats()]);

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "48px 24px 16px", textAlign: "center" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <Link href="/z-tide" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← Z-Tide</Link>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: "12px 0 8px", lineHeight: 1.1 }}>Tide Leaderboard</h1>
          <p style={{ fontSize: 14, color: "#94a3b8", maxWidth: 580, margin: "0 auto 16px" }}>
            Лидеры экосистемы по совокупному вкладу. Score нарастает за реальные действия — Bureau certs, Build hires, donations, referrals.
          </p>
        </div>
      </section>

      {stats && (
        <section style={{ padding: "0 24px 24px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 10 }}>
            <Stat label="Active users" value={String(stats.active_users)} />
            <Stat label="Total events" value={String(stats.total_events)} />
            <Stat label="Total weight" value={String(stats.total_weight)} />
            <Stat label="Top score" value={String(stats.top_score ?? "0")} />
          </div>
        </section>
      )}

      {stats?.ranks && (
        <section style={{ padding: "0 24px 24px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 10 }}>Rank ladder</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {stats.ranks.map((r) => (
                <div key={r.id} style={{ padding: "4px 10px", background: (RANK_COLORS[r.id] || "#64748b") + "22", border: `1px solid ${(RANK_COLORS[r.id] || "#64748b")}55`, color: RANK_COLORS[r.id] || "#94a3b8", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  {r.label} · ≥ {r.min}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ padding: "16px 24px 64px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 28, background: "#1e293b", border: "1px dashed #334155", borderRadius: 12, color: "#94a3b8", textAlign: "center" }}>
              No tide events yet. Score events stream in from <code style={{ color: "#a78bfa" }}>POST /api/ztide/events</code>.
            </div>
          ) : (
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
              {rows.map((r) => (
                <div key={r.userId} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto auto", gap: 12, padding: "12px 16px", borderBottom: "1px solid #334155", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: r.position <= 3 ? "#fbbf24" : "#94a3b8" }}>#{r.position}</div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "#e5e7eb" }}>{shortId(r.userId)}</div>
                  <div style={{ padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const, background: (RANK_COLORS[r.rank] || "#64748b") + "22", color: RANK_COLORS[r.rank] || "#94a3b8" }}>{r.rank}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#34d399" }}>{r.score}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#34d399" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" as const, marginTop: 4 }}>{label}</div>
    </div>
  );
}
