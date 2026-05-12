import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QMaskCard Dashboard · AEVION",
  description: "Виртуальные платёжные карты — общая статистика и активность.",
  robots: { index: false, follow: false },
};

type Stats = {
  active_masks: number;
  total_masks: number;
  authorized_charges: number;
  declined_charges: number;
  volume_cents: string | number;
};

async function loadStats(): Promise<Stats | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/qmaskcard/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function fmtMoney(cents: string | number, currency = "USD"): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n / 100);
}

export default async function QMaskCardDashboardPage() {
  const stats = await loadStats();
  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Link href="/qmaskcard" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>← QMaskCard</Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 4px" }}>Dashboard</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
          Aggregate stats across all virtual masks. Personal mask list available via <code style={{ color: "#a78bfa" }}>GET /api/qmaskcard/masks</code> with your Bearer token.
        </p>

        {stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 10, marginBottom: 24 }}>
            <Stat label="Active masks" value={String(stats.active_masks)} />
            <Stat label="Total issued" value={String(stats.total_masks)} />
            <Stat label="Authorized charges" value={String(stats.authorized_charges)} />
            <Stat label="Declined" value={String(stats.declined_charges)} />
            <Stat label="Volume" value={fmtMoney(stats.volume_cents)} />
          </div>
        ) : (
          <div style={{ padding: 28, background: "#1e293b", border: "1px dashed #334155", borderRadius: 12, color: "#94a3b8", textAlign: "center" }}>
            Stats temporarily unavailable.
          </div>
        )}

        <div style={{ marginTop: 24, padding: 18, background: "#1e293b", border: "1px solid #334155", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, marginBottom: 10 }}>API surface</h2>
          <ApiRow method="POST" path="/api/qmaskcard/masks" body="{ label, kind, currency, spendLimitCents, ttlHours }" />
          <ApiRow method="GET" path="/api/qmaskcard/masks" body="(Bearer) → list your active masks" />
          <ApiRow method="POST" path="/api/qmaskcard/masks/:id/revoke" body="(Bearer) → revoke" />
          <ApiRow method="POST" path="/api/qmaskcard/charges" body="{ maskId, amountCents, merchantName, geoCountry, ... }" />
          <ApiRow method="GET" path="/api/qmaskcard/charges?maskId=" body="(Bearer) → charge history" />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#a78bfa" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" as const, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ApiRow({ method, path, body }: { method: string; path: string; body: string }) {
  const color = method === "GET" ? "#34d399" : method === "POST" ? "#a78bfa" : "#f59e0b";
  return (
    <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, padding: "8px 0", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ color, fontWeight: 800, minWidth: 40 }}>{method}</span>
      <span style={{ color: "#e5e7eb" }}>{path}</span>
      <span style={{ color: "#94a3b8", fontSize: 11 }}>{body}</span>
    </div>
  );
}
