import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import VoteForm from "./VoteForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type Proposal = {
  id: string;
  authorUserId: string;
  title: string;
  summary: string;
  body: string;
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

type Tally = { choice: string; votes: number; weight: number };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Proposal ${id.slice(0, 8)}… · QChainGov`,
    description: "AEVION governance proposal — read, discuss, vote.",
    robots: { index: true, follow: true },
  };
}

async function loadProposal(id: string): Promise<{ proposal: Proposal; tally: Tally[]; totals: { total: number; total_weight: number } } | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/qchaingov/proposals/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    console.warn("[qchaingov/proposals/[id]] loadProposal failed", err instanceof Error ? err.message : err);
    return null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#64748b", open: "#34d399", closed: "#f59e0b", executed: "#3b82f6", rejected: "#ef4444",
};

export default async function ProposalPage({ params }: Props) {
  const { id } = await params;
  const data = await loadProposal(id);

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", padding: "48px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <Link href="/qchaingov/proposals" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← All proposals</Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 16, marginBottom: 8 }}>Proposal not found</h1>
          <p style={{ color: "#94a3b8" }}>This proposal may have been removed or the ID is wrong.</p>
        </div>
      </main>
    );
  }

  const { proposal: p, tally, totals } = data;
  const totalVotes = Number(totals?.total ?? 0);
  const totalWeight = Number(totals?.total_weight ?? 0);

  // Compute % per option
  const tallyByChoice = new Map<string, { votes: number; weight: number; pct: number }>();
  for (const t of tally) {
    const pct = totalWeight > 0 ? Math.round((Number(t.weight) / totalWeight) * 1000) / 10 : 0;
    tallyByChoice.set(t.choice, { votes: t.votes, weight: Number(t.weight), pct });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/qchaingov/proposals" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← All proposals</Link>

        <div style={{ marginTop: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-block", padding: "3px 10px", background: (STATUS_COLORS[p.status] || "#64748b") + "22", color: STATUS_COLORS[p.status] || "#94a3b8", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{p.status}</span>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "3px 0" }}>{p.category}</span>
          <span style={{ fontSize: 10, color: "#94a3b8", padding: "3px 0" }}>mode: <code style={{ color: "#e5e7eb" }}>{p.voteMode}</code></span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, marginBottom: 10, lineHeight: 1.25 }}>{p.title}</h1>
        <p style={{ fontSize: 15, color: "#cbd5e1", margin: 0, marginBottom: 18, lineHeight: 1.55 }}>{p.summary}</p>

        <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: 18, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, color: "#e5e7eb" }}>
          {p.body}
        </div>

        <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Tally · {totalVotes} vote{totalVotes === 1 ? "" : "s"}</h2>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Quorum {p.quorumPercent}% · Pass ≥ {p.passThreshold}%</div>
          </div>
          {p.options.map((opt) => {
            const t = tallyByChoice.get(opt) || { votes: 0, weight: 0, pct: 0 };
            return (
              <div key={opt} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{opt}</span>
                  <span style={{ color: "#94a3b8" }}>{t.votes} · {t.pct}%</span>
                </div>
                <div style={{ height: 6, background: "#0f172a", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${t.pct}%`, background: "#34d399" }} />
                </div>
              </div>
            );
          })}
        </div>

        <VoteForm proposalId={p.id} options={Array.isArray(p.options) ? p.options : []} voteMode={p.voteMode} status={p.status} />

        <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 24 }}>
          Proposal id: <code style={{ color: "#94a3b8" }}>{p.id}</code> · Created {new Date(p.createdAt).toLocaleString()}
        </div>
      </div>
    </main>
  );
}
