import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type TransparencyView = {
  generatedAt: string;
  totals: {
    registered: number;
    active: number;
    revoked: number;
    firstRegisteredAt: string | null;
    lastRegisteredAt: string | null;
  };
  revokesByReasonCode: { code: string; count: number }[];
  registrationsByKind: { kind: string; count: number }[];
};

const REVOKE_REASON_LABELS: Record<string, string> = {
  "license-conflict": "License conflict",
  withdrawn: "Withdrawn by author",
  dispute: "Disputed authorship",
  mistake: "Registered by mistake",
  superseded: "Superseded by new version",
  other: "Other",
  "admin-takedown": "Admin takedown",
  unspecified: "Reason unspecified",
};

async function loadTransparency(): Promise<TransparencyView | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/qright/transparency`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as TransparencyView;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "QRight transparency — AEVION",
  description:
    "Public aggregate stats for the AEVION QRight registry: total registrations, active vs revoked, breakdown by revocation reason and content type.",
  openGraph: {
    type: "article",
    title: "QRight transparency — AEVION",
    description: "Public aggregate stats for the AEVION QRight registry.",
  },
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 22,
  background: "#fff",
};
const stat: CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.02em",
  margin: 0,
};
const statLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginTop: 4,
};

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function Bar({
  label,
  count,
  total,
  accent,
}: {
  label: string;
  count: number;
  total: number;
  accent: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: "#0f172a", fontWeight: 700 }}>{label}</span>
        <span style={{ color: "#64748b" }}>
          {fmt(count)}
          <span style={{ marginLeft: 6, color: "#94a3b8" }}>{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(2, pct)}%`, background: accent, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export default async function QRightTransparencyPage() {
  const data = await loadTransparency();

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Failed to load</div>
            <div style={{ fontSize: 13 }}>The aggregate is temporarily unreachable. Try again later.</div>
          </div>
        </div>
      </main>
    );
  }

  const totalRevokes = data.revokesByReasonCode.reduce((s, r) => s + r.count, 0);
  const totalKinds = data.registrationsByKind.reduce((s, r) => s + r.count, 0);

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/qright" style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>
            ← AEVION QRight
          </Link>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0f172a", margin: 0 }}>
          QRight transparency
        </h1>
        <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24, lineHeight: 1.6 }}>
          Public aggregate counts. Updates every ~5 min. No personally identifying data is exposed
          here — see{" "}
          <Link href="/privacy" style={{ color: "#0d9488", fontWeight: 700 }}>
            privacy
          </Link>{" "}
          for the full data policy.
        </p>

        {/* ── Headline stats ── */}
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 20 }}>
          <div style={card}>
            <p style={stat}>{fmt(data.totals.registered)}</p>
            <div style={statLabel}>Registered total</div>
          </div>
          <div style={{ ...card, borderColor: "rgba(13,148,136,0.25)" }}>
            <p style={{ ...stat, color: "#0d9488" }}>{fmt(data.totals.active)}</p>
            <div style={statLabel}>Currently active</div>
          </div>
          <div style={{ ...card, borderColor: "rgba(220,38,38,0.25)" }}>
            <p style={{ ...stat, color: "#dc2626" }}>{fmt(data.totals.revoked)}</p>
            <div style={statLabel}>Revoked</div>
          </div>
          <div style={card}>
            <p style={{ ...stat, fontSize: 18, fontWeight: 800 }}>
              {data.totals.firstRegisteredAt
                ? new Date(data.totals.firstRegisteredAt).toISOString().slice(0, 10)
                : "—"}
            </p>
            <div style={statLabel}>First registration</div>
          </div>
        </div>

        {/* ── By reason code ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 14 }}>
            Revocations by reason
          </h2>
          {data.revokesByReasonCode.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No revocations on record.</p>
          ) : (
            <>
              {data.revokesByReasonCode.map((r) => (
                <Bar
                  key={r.code}
                  label={REVOKE_REASON_LABELS[r.code] || r.code}
                  count={r.count}
                  total={totalRevokes}
                  accent="#dc2626"
                />
              ))}
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Total revocations: {fmt(totalRevokes)} of {fmt(data.totals.registered)} ({totalRevokes > 0 ? ((totalRevokes / data.totals.registered) * 100).toFixed(2) : "0.00"}%).
              </div>
            </>
          )}
        </div>

        {/* ── By kind ── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 14 }}>
            Registrations by content type
          </h2>
          {data.registrationsByKind.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No registrations yet.</p>
          ) : (
            data.registrationsByKind.map((r) => (
              <Bar key={r.kind} label={r.kind} count={r.count} total={totalKinds} accent="#0d9488" />
            ))
          )}
        </div>

        <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 24 }}>
          Generated {new Date(data.generatedAt).toUTCString()}
        </div>
      </div>
    </main>
  );
}
