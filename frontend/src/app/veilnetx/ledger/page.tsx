import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VeilNetX Ledger Explorer · AEVION",
  description: "Tamper-evident settlement chain — recent entries + chain head + integrity verification.",
  alternates: { canonical: "https://aevion.app/veilnetx/ledger" },
  robots: { index: true, follow: true },
};

type Entry = {
  id: string;
  sequenceNumber: number;
  module: string;
  kind: string;
  blindedFrom: string;
  blindedTo: string;
  amountCents: string | number;
  currency: string;
  prevHash: string;
  entryHash: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

type Head = { head: string; length: number; tipAt?: string };

type Stats = {
  total: number;
  perModule: Array<{ module: string; entries: number; volume_cents: string | number }>;
};

async function loadHead(): Promise<Head | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/veilnetx-ledger/chain/head`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function loadEntries(): Promise<Entry[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/veilnetx-ledger/entries?limit=50`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch { return []; }
}

async function loadStats(): Promise<Stats | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/veilnetx-ledger/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function fmt(cents: string | number): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(n / 100));
}

function short(hash: string, n = 10): string {
  if (!hash) return "—";
  if (hash.length <= n + 2) return hash;
  return hash.slice(0, n) + "…";
}

const MODULE_COLORS: Record<string, string> = {
  qpaynet: "#06b6d4", qgood: "#10b981", qmaskcard: "#a78bfa", bureau: "#f59e0b",
  qbuild: "#3b82f6", qsign: "#ec4899", qright: "#84cc16", aev: "#fbbf24",
  qcontract: "#14b8a6", qtrade: "#f97316", external: "#64748b",
};

export default async function VeilNetXLedgerPage() {
  const [head, entries, stats] = await Promise.all([loadHead(), loadEntries(), loadStats()]);

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      <section style={{ padding: "48px 24px 16px", textAlign: "center" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Link href="/veilnetx" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← VeilNetX</Link>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: "12px 0 8px", lineHeight: 1.1 }}>Ledger Explorer</h1>
          <p style={{ fontSize: 14, color: "#94a3b8", maxWidth: 620, margin: "0 auto 16px" }}>
            Tamper-evident settlement chain. Каждая запись хэшем сцеплена с предыдущей. Participants blinded HMAC-SHA-256.
          </p>
        </div>
      </section>

      {head && (
        <section style={{ padding: "0 24px 24px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <Stat label="Chain length" value={String(head.length)} />
            <Stat label="Head hash" value={short(head.head)} mono />
            <Stat label="Total entries" value={String(stats?.total ?? 0)} />
            {head.tipAt && <Stat label="Last entry" value={new Date(head.tipAt).toLocaleString()} />}
          </div>
        </section>
      )}

      {stats?.perModule && stats.perModule.length > 0 && (
        <section style={{ padding: "0 24px 24px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 10 }}>Per-module activity</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stats.perModule.map((m) => (
                <div key={m.module} style={{ padding: "6px 12px", background: (MODULE_COLORS[m.module] || "#64748b") + "22", border: `1px solid ${(MODULE_COLORS[m.module] || "#64748b")}55`, borderRadius: 8, fontSize: 11 }}>
                  <span style={{ color: MODULE_COLORS[m.module] || "#94a3b8", fontWeight: 800 }}>{m.module}</span>
                  <span style={{ color: "#94a3b8", marginLeft: 6 }}>{m.entries} entries · ${fmt(m.volume_cents)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ padding: "16px 24px 64px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Recent entries</h2>
          {entries.length === 0 ? (
            <div style={{ padding: 28, background: "#1e293b", border: "1px dashed #334155", borderRadius: 12, color: "#94a3b8", textAlign: "center" }}>
              Chain is empty. First entries seed via <code style={{ color: "#a78bfa" }}>POST /api/veilnetx-ledger/entries</code>.
            </div>
          ) : (
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "hidden", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "60px 90px 100px 1fr 100px 130px", padding: "8px 14px", background: "#0f172a", borderBottom: "1px solid #334155", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" as const, fontSize: 10 }}>
                <div>seq</div><div>module</div><div>kind</div><div>hash</div><div>amount</div><div>at</div>
              </div>
              {entries.map((e) => (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: "60px 90px 100px 1fr 100px 130px", gap: 8, padding: "8px 14px", borderBottom: "1px solid #334155", alignItems: "center" }}>
                  <div style={{ color: "#94a3b8" }}>{e.sequenceNumber}</div>
                  <div><span style={{ color: MODULE_COLORS[e.module] || "#94a3b8" }}>{e.module}</span></div>
                  <div style={{ color: "#e5e7eb" }}>{e.kind}</div>
                  <div style={{ color: "#a78bfa" }} title={e.entryHash}>{short(e.entryHash, 16)}</div>
                  <div style={{ color: "#34d399" }}>${fmt(e.amountCents)}</div>
                  <div style={{ color: "#64748b" }}>{new Date(e.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 12, textAlign: "center" }}>
            Verify full chain integrity: <code style={{ color: "#a78bfa" }}>GET /api/veilnetx-ledger/chain/verify</code>
          </p>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#a78bfa", fontFamily: mono ? "ui-monospace, Menlo, monospace" : undefined }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" as const, marginTop: 4 }}>{label}</div>
    </div>
  );
}
