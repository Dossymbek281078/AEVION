import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QChainGov Proposals · AEVION",
  description: "Open proposals for AEVION ecosystem governance — vote your stake.",
  alternates: { canonical: "https://aevion.app/qchaingov/proposals" },
  robots: { index: true, follow: true },
};

type Proposal = {
  id: string;
  authorUserId: string;
  title: string;
  summary: string;
  category: string;
  voteMode: string;
  options: string[];
  quorumPercent: number;
  passThreshold: number;
  status: string;
  votesOpenAt: string | null;
  votesCloseAt: string | null;
  createdAt: string;
};

type Stats = {
  total_proposals: number;
  open_proposals: number;
  closed_proposals: number;
  total_votes: number;
  unique_voters: number;
};

async function loadProposals(): Promise<Proposal[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/qchaingov/proposals?limit=50`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.proposals) ? data.proposals : [];
  } catch (err) {
    console.warn("[qchaingov/proposals] loadProposals failed", err instanceof Error ? err.message : err);
    return [];
  }
}

async function loadStats(): Promise<Stats | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/qchaingov/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    console.warn("[qchaingov/proposals] loadStats failed", err instanceof Error ? err.message : err);
    return null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#64748b",
  open: "#34d399",
  closed: "#f59e0b",
  executed: "#3b82f6",
  rejected: "#ef4444",
};

export default async function QChainGovProposalsPage() {
  const [proposals, stats] = await Promise.all([loadProposals(), loadStats()]);

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "48px 24px 16px", textAlign: "center" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <Link href="/qchaingov" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← QChainGov</Link>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: "12px 0 8px", lineHeight: 1.1 }}>Active proposals</h1>
          <p style={{ fontSize: 14, color: "#94a3b8", maxWidth: 580, margin: "0 auto 16px" }}>
            Голосуй по предложениям, влияющим на казну, протокол и направления AEVION-экосистемы.
          </p>
        </div>
      </section>

      {stats && (
        <section style={{ padding: "0 24px 24px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Stat label="Open" value={String(stats.open_proposals)} />
            <Stat label="Total proposals" value={String(stats.total_proposals)} />
            <Stat label="Total votes" value={String(stats.total_votes)} />
            <Stat label="Unique voters" value={String(stats.unique_voters)} />
          </div>
        </section>
      )}

      <section style={{ padding: "16px 24px 64px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          {proposals.length === 0 ? (
            <div style={{ padding: 28, background: "#1e293b", border: "1px dashed #334155", borderRadius: 12, color: "#94a3b8", textAlign: "center" }}>
              No proposals yet. Create one via <code style={{ color: "#a78bfa" }}>POST /api/qchaingov/proposals</code>.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {proposals.map((p) => (
                <Link key={p.id} href={`/qchaingov/proposals/${p.id}`} style={{ display: "block", padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, textDecoration: "none", color: "#f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", background: (STATUS_COLORS[p.status] || "#64748b") + "22", color: STATUS_COLORS[p.status] || "#94a3b8", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{p.status}</span>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{p.category}</span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 4 }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>{p.summary}</p>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                    Mode: <code style={{ color: "#e5e7eb" }}>{p.voteMode}</code> · Quorum {p.quorumPercent}% · Pass ≥ {p.passThreshold}%
                  </div>
                </Link>
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
