"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

type KycTier = "tier_0" | "tier_1" | "tier_2" | "tier_3";
type Region = "EU" | "US" | "UK" | "KZ" | "AE" | "SG";

const KYC_TIERS: {
  id: KycTier;
  label: string;
  limit: string;
  reqs: string[];
  color: string;
}[] = [
  {
    id: "tier_0",
    label: "Tier 0 · Browse",
    limit: "$100 / month",
    reqs: ["Email verification only"],
    color: "#64748b",
  },
  {
    id: "tier_1",
    label: "Tier 1 · Light",
    limit: "$2 500 / month",
    reqs: ["Government ID scan", "Selfie liveness check"],
    color: "#0d9488",
  },
  {
    id: "tier_2",
    label: "Tier 2 · Standard",
    limit: "$25 000 / month",
    reqs: ["Tier 1 + proof of address", "Sanctions screening (OFAC/EU/UN)"],
    color: "#2563eb",
  },
  {
    id: "tier_3",
    label: "Tier 3 · Enhanced",
    limit: "Unlimited",
    reqs: [
      "Tier 2 + source of funds",
      "Beneficial owner declaration",
      "Annual re-screen",
    ],
    color: "#7c3aed",
  },
];

const SANCTIONS_LISTS = [
  { id: "ofac", label: "OFAC SDN", country: "US", lastSync: "2026-04-28 06:00" },
  { id: "eu", label: "EU consolidated list", country: "EU", lastSync: "2026-04-28 06:05" },
  { id: "un", label: "UN Security Council", country: "UN", lastSync: "2026-04-28 06:10" },
  { id: "uk", label: "UK HMT", country: "UK", lastSync: "2026-04-28 06:12" },
  { id: "kz", label: "KZ AFM", country: "KZ", lastSync: "2026-04-28 06:18" },
];

type VatRow = {
  region: Region;
  country: string;
  rate: string;
  thisMonthVolume: number;
  vatDue: number;
  status: "filed" | "pending" | "due";
};

const VAT: VatRow[] = [
  { region: "EU", country: "Germany", rate: "19% MOSS", thisMonthVolume: 84200, vatDue: 13443, status: "pending" },
  { region: "EU", country: "France", rate: "20% MOSS", thisMonthVolume: 62100, vatDue: 12420, status: "pending" },
  { region: "UK", country: "United Kingdom", rate: "20% VAT", thisMonthVolume: 41800, vatDue: 8360, status: "filed" },
  { region: "US", country: "United States", rate: "Sales tax (44 states)", thisMonthVolume: 218400, vatDue: 12300, status: "filed" },
  { region: "KZ", country: "Kazakhstan", rate: "12% NDS", thisMonthVolume: 1820000, vatDue: 218400, status: "due" },
  { region: "AE", country: "UAE", rate: "5% VAT", thisMonthVolume: 36500, vatDue: 1825, status: "filed" },
  { region: "SG", country: "Singapore", rate: "9% GST", thisMonthVolume: 22900, vatDue: 2061, status: "pending" },
];

type MonthlyReport = {
  id: string;
  month: string;
  region: Region | "Global";
  type: "AML/KYC" | "VAT/GST" | "Sanctions" | "Chargebacks" | "Royalty";
  size: string;
  generated: string;
};

const REPORTS: MonthlyReport[] = [
  {
    id: "rep_2026_03_aml",
    month: "March 2026",
    region: "Global",
    type: "AML/KYC",
    size: "1.2 MB",
    generated: "2026-04-01",
  },
  {
    id: "rep_2026_03_vat_eu",
    month: "March 2026",
    region: "EU",
    type: "VAT/GST",
    size: "412 KB",
    generated: "2026-04-15",
  },
  {
    id: "rep_2026_03_sanc",
    month: "March 2026",
    region: "Global",
    type: "Sanctions",
    size: "89 KB",
    generated: "2026-04-01",
  },
  {
    id: "rep_2026_03_cb",
    month: "March 2026",
    region: "Global",
    type: "Chargebacks",
    size: "224 KB",
    generated: "2026-04-05",
  },
  {
    id: "rep_2026_03_roy",
    month: "March 2026",
    region: "Global",
    type: "Royalty",
    size: "1.8 MB",
    generated: "2026-04-02",
  },
  {
    id: "rep_2026_02_aml",
    month: "February 2026",
    region: "Global",
    type: "AML/KYC",
    size: "1.1 MB",
    generated: "2026-03-01",
  },
  {
    id: "rep_2026_02_vat_kz",
    month: "February 2026",
    region: "KZ",
    type: "VAT/GST",
    size: "186 KB",
    generated: "2026-03-15",
  },
];

function statusMeta(s: VatRow["status"]) {
  if (s === "filed") return { bg: "rgba(5,150,105,0.12)", fg: "#047857", label: "Filed" };
  if (s === "pending") return { bg: "rgba(245,158,11,0.12)", fg: "#b45309", label: "Pending" };
  return { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", label: "Due now" };
}

export default function CompliancePage() {
  const [selectedTier, setSelectedTier] = useState<KycTier>("tier_2");
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const totals = useMemo(() => {
    const totalVat = VAT.reduce((acc, v) => acc + v.vatDue, 0);
    const due = VAT.filter((v) => v.status === "due").length;
    const filed = VAT.filter((v) => v.status === "filed").length;
    return { totalVat, due, filed };
  }, []);

  function downloadReport(r: MonthlyReport) {
    const content = [
      `AEVION Payments Rail — Compliance Report`,
      `Month: ${r.month}`,
      `Region: ${r.region}`,
      `Type: ${r.type}`,
      `Generated: ${r.generated}`,
      ``,
      `--- Summary ---`,
      `This is a demo report stub.`,
      `In production this would contain detailed transaction-level audit data,`,
      `signed with a QSign attestation for regulator submission.`,
      ``,
      `Report ID: ${r.id}`,
      `Hash: sha256-${r.id.split("_").join("")}-stub-only`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded((prev) => new Set(prev).add(r.id));
  }

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #4338ca 48%, #6366f1 100%)",
          color: "#fff",
          padding: "32px 24px 38px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/payments"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.75)",
              textDecoration: "none",
            }}
          >
            ← Payments Rail
          </Link>
          <h1
            style={{
              fontSize: "clamp(22px, 3.6vw, 34px)",
              fontWeight: 800,
              margin: "10px 0 8px",
              letterSpacing: "-0.03em",
            }}
          >
            Compliance for payment flows
          </h1>
          <p
            style={{
              fontSize: "clamp(13px, 1.8vw, 16px)",
              opacity: 0.92,
              maxWidth: 720,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            KYC tier ladder, sanctions screening across 5 lists, multi-jurisdiction
            VAT/GST tracker, and Planet-anchored downloadable reports for
            regulator submission.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginTop: 22,
            }}
          >
            <Stat
              label="VAT due (USD)"
              value={`$${(totals.totalVat / 470).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`}
              accent="#fcd34d"
            />
            <Stat label="Filed" value={totals.filed.toString()} accent="#86efac" />
            <Stat label="Due / pending" value={(VAT.length - totals.filed).toString()} accent="#fda4af" />
            <Stat label="Sanctions lists" value={SANCTIONS_LISTS.length.toString()} accent="#a5b4fc" />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24, display: "grid", gap: 28 }}>
        <section>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#4338ca",
              marginBottom: 8,
            }}
          >
            KYC tier ladder
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 14px",
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            4 tiers · gated by transaction limit
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {KYC_TIERS.map((t) => {
              const active = selectedTier === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTier(t.id)}
                  style={{
                    textAlign: "left",
                    padding: 18,
                    borderRadius: 14,
                    border: active
                      ? `2px solid ${t.color}`
                      : "1px solid rgba(15,23,42,0.1)",
                    background: active ? t.color + "0d" : "#fff",
                    boxShadow: active
                      ? `0 4px 14px ${t.color}33`
                      : "0 2px 10px rgba(15,23,42,0.04)",
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: t.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t.label.split(" · ")[0]}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>
                    {t.label.split(" · ")[1]}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: t.color }}>
                    {t.limit}
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: "0 0 0 18px",
                      fontSize: 12,
                      color: "#475569",
                      lineHeight: 1.6,
                    }}
                  >
                    {t.reqs.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#4338ca",
              marginBottom: 8,
            }}
          >
            Sanctions screening
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 14px",
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            5 lists synced daily
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {SANCTIONS_LISTS.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "#fff",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>
                    {s.label}
                  </div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 5,
                      background: "rgba(5,150,105,0.12)",
                      color: "#047857",
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Synced
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  Jurisdiction: {s.country}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Last sync: {s.lastSync}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#4338ca",
              marginBottom: 8,
            }}
          >
            VAT / GST · this month
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 14px",
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            7 jurisdictions tracked
          </h2>
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#fff",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1.4fr 1fr 1fr",
                padding: "12px 16px",
                background: "rgba(15,23,42,0.04)",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#475569",
              }}
            >
              <div>Country</div>
              <div>Rate</div>
              <div>Volume (local)</div>
              <div>Tax due</div>
              <div>Status</div>
            </div>
            {VAT.map((v) => {
              const meta = statusMeta(v.status);
              return (
                <div
                  key={v.country}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr 1.4fr 1fr 1fr",
                    padding: "12px 16px",
                    borderTop: "1px solid rgba(15,23,42,0.06)",
                    fontSize: 13,
                    color: "#0f172a",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    <span style={{ marginRight: 6, fontSize: 11, color: "#64748b" }}>
                      {v.region}
                    </span>
                    {v.country}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{v.rate}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>
                    {v.thisMonthVolume.toLocaleString("en-US")}
                  </div>
                  <div style={{ fontWeight: 800 }}>
                    {v.vatDue.toLocaleString("en-US")}
                  </div>
                  <div>
                    <span
                      style={{
                        padding: "3px 9px",
                        borderRadius: 6,
                        background: meta.bg,
                        color: meta.fg,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#4338ca",
              marginBottom: 8,
            }}
          >
            Reports
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            Monthly downloadable reports
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#64748b",
              marginTop: 0,
              marginBottom: 16,
              lineHeight: 1.55,
            }}
          >
            Every report is QSign-signed and Planet-anchored — regulators can
            verify authenticity without contacting AEVION.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {REPORTS.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "#fff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>
                    {r.month} · {r.type}
                    <span style={{ marginLeft: 8, color: "#64748b", fontWeight: 700, fontSize: 12 }}>
                      {r.region}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Generated {r.generated} · {r.size} · QSign attestation included
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadReport(r)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: downloaded.has(r.id) ? "#059669" : "#4338ca",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {downloaded.has(r.id) ? "Downloaded ✓" : "Download .txt"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}

const _TIER_LABEL: Record<KycTier, string> = {
  tier_0: "Browse",
  tier_1: "Light",
  tier_2: "Standard",
  tier_3: "Enhanced",
};
void _TIER_LABEL;
