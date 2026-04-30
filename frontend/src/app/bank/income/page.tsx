"use client";

// Unified chronological income feed.
//
// /bank/audit-log only shows qtrade operations (top-ups + transfers) +
// QSign signatures. The ecosystem ledgers (royalties, chess prizes,
// planet certs) live behind their own /api/* endpoints and were
// invisible from the audit page. For an investor or auditor walking the
// wallet, "where did this AEC come from?" needs ALL inflows in one
// chronological view, not three tabs.
//
// This page pulls all four feeds in parallel, normalises them into a
// single Row, and renders one filterable table. Source pills colour-
// code the origin so a regulator can spot at a glance "which line is
// from Spotify vs Lichess vs Planet".

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { listAccounts, listOperations } from "../_lib/api";
import type { Account, Operation } from "../_lib/types";

const TOKEN_KEY = "aevion_auth_token_v1";

type Source = "topup" | "transfer-in" | "transfer-out" | "royalty" | "prize" | "cert";

type Row = {
  id: string;
  ts: string;
  source: Source;
  amount: number;
  detail: string;
};

type SourceFilter = "all" | Source;

const SOURCE_META: Record<Source, { label: string; color: string; tone: string }> = {
  topup: { label: "Top-up", color: "#16a34a", tone: "rgba(22,163,74,0.10)" },
  "transfer-in": { label: "Transfer in", color: "#0d9488", tone: "rgba(13,148,136,0.10)" },
  "transfer-out": { label: "Transfer out", color: "#dc2626", tone: "rgba(220,38,38,0.10)" },
  royalty: { label: "Royalty", color: "#7c3aed", tone: "rgba(124,58,237,0.10)" },
  prize: { label: "Chess prize", color: "#0ea5e9", tone: "rgba(14,165,233,0.10)" },
  cert: { label: "Planet cert", color: "#d97706", tone: "rgba(217,119,6,0.10)" },
};

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

async function authedJson<T>(path: string): Promise<T | null> {
  const t = readToken();
  if (!t) return null;
  try {
    const r = await fetch(apiUrl(path), {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default function BankIncomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [royalties, setRoyalties] = useState<
    Array<{ id: string; productKey: string; period: string; amount: number; paidAt: string }>
  >([]);
  const [prizes, setPrizes] = useState<
    Array<{ id: string; tournamentId: string; place: number; amount: number; finalizedAt: string }>
  >([]);
  const [certs, setCerts] = useState<Array<{ id: string; artifactVersionId: string; amount: number; certifiedAt: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o, r, p, c] = await Promise.all([
          listAccounts(),
          listOperations(),
          authedJson<{ items: Array<{ id: string; productKey: string; period: string; amount: number; paidAt: string }> }>(
            "/api/qright/royalties",
          ),
          authedJson<{
            items: Array<{ id: string; tournamentId: string; place: number; amount: number; finalizedAt: string }>;
          }>("/api/cyberchess/results"),
          authedJson<{ items: Array<{ id: string; artifactVersionId: string; amount: number; certifiedAt: string }> }>(
            "/api/planet/payouts",
          ),
        ]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
        setRoyalties(r?.items ?? []);
        setPrizes(p?.items ?? []);
        setCerts(c?.items ?? []);
      } catch {
        // empty state handled below
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myAccountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    for (const op of operations) {
      if (op.kind === "topup") {
        out.push({
          id: op.id,
          ts: op.createdAt,
          source: "topup",
          amount: op.amount,
          detail: `→ ${op.to}`,
        });
      } else if (op.kind === "transfer") {
        const isOutgoing = op.from && myAccountIds.has(op.from);
        out.push({
          id: op.id,
          ts: op.createdAt,
          source: isOutgoing ? "transfer-out" : "transfer-in",
          amount: isOutgoing ? -op.amount : op.amount,
          detail: isOutgoing ? `→ ${op.to}` : `← ${op.from ?? "(unknown)"}`,
        });
      }
    }

    for (const r of royalties) {
      out.push({
        id: r.id,
        ts: r.paidAt,
        source: "royalty",
        amount: r.amount,
        detail: `${r.productKey} · ${r.period}`,
      });
    }
    for (const p of prizes) {
      out.push({
        id: p.id,
        ts: p.finalizedAt,
        source: "prize",
        amount: p.amount,
        detail: `${p.tournamentId} · place ${p.place}`,
      });
    }
    for (const c of certs) {
      out.push({
        id: c.id,
        ts: c.certifiedAt,
        source: "cert",
        amount: c.amount,
        detail: c.artifactVersionId,
      });
    }

    return out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  }, [operations, royalties, prizes, certs, myAccountIds]);

  const filtered = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.source === filter)), [rows, filter]);

  const totals = useMemo(() => {
    const bySource: Record<Source, number> = {
      topup: 0,
      "transfer-in": 0,
      "transfer-out": 0,
      royalty: 0,
      prize: 0,
      cert: 0,
    };
    for (const r of rows) bySource[r.source] += r.amount;
    const inflow = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const outflow = rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);
    return {
      bySource,
      inflow: Math.round(inflow * 100) / 100,
      outflow: Math.round(outflow * 100) / 100,
      net: Math.round((inflow + outflow) * 100) / 100,
    };
  }, [rows]);

  const SOURCES: SourceFilter[] = ["all", "topup", "transfer-in", "transfer-out", "royalty", "prize", "cert"];

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />

        <header style={{ padding: "32px 0 18px" }}>
          <Link href="/bank" style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}>
            ← Back to AEVION Bank
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: "12px 0 8px", letterSpacing: "-0.01em" }}>Income feed</h1>
          <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.55, maxWidth: 640, margin: 0 }}>
            Every AEC inflow on one timeline — top-ups, P2P transfers, QRight royalties, CyberChess
            prizes, Planet certifications. Useful for accounting and tax filings.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            margin: "8px 0 18px",
          }}
        >
          <Tile label="Net flow" value={`${totals.net >= 0 ? "+" : ""}${totals.net.toFixed(2)} AEC`} color={totals.net >= 0 ? "#16a34a" : "#dc2626"} />
          <Tile label="Inflow" value={`+${totals.inflow.toFixed(2)} AEC`} color="#16a34a" />
          <Tile label="Outflow" value={`${totals.outflow.toFixed(2)} AEC`} color="#dc2626" />
          <Tile label="Rows" value={String(rows.length)} color="#0f172a" />
        </section>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 18px" }}>
          {SOURCES.map((s) => {
            const isActive = filter === s;
            const meta = s === "all" ? null : SOURCE_META[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.10)",
                  background: isActive ? (meta?.color ?? "#0f172a") : "#fff",
                  color: isActive ? "#fff" : "#0f172a",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {s === "all" ? "All" : meta!.label}
              </button>
            );
          })}
        </div>

        <section
          style={{
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 18,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(15,23,42,0.03)" }}>
                <th style={th}>When</th>
                <th style={th}>Source</th>
                <th style={th}>Detail</th>
                <th style={{ ...th, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr>
                  <td colSpan={4} style={{ ...td, color: "#64748b", textAlign: "center" }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...td, color: "#64748b", textAlign: "center" }}>
                    No income entries match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const meta = SOURCE_META[r.source];
                  return (
                    <tr key={`${r.source}-${r.id}`} style={{ borderTop: "1px solid rgba(15,23,42,0.05)" }}>
                      <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                        {new Date(r.ts).toLocaleString()}
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            color: meta.color,
                            background: meta.tone,
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#475569" }}>
                        {r.detail}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          color: r.amount >= 0 ? "#16a34a" : "#dc2626",
                          fontWeight: 800,
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {r.amount >= 0 ? "+" : ""}
                        {r.amount.toFixed(2)} AEC
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        <footer style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 4px" }}>
            <strong>Per-source CSV exports:</strong>{" "}
            <Link href="/api-backend/api/qtrade/operations.csv" style={ftLink}>
              operations
            </Link>{" "}
            ·{" "}
            <Link href="/api-backend/api/qright/royalties.csv" style={ftLink}>
              royalties
            </Link>{" "}
            ·{" "}
            <Link href="/api-backend/api/cyberchess/results.csv" style={ftLink}>
              prizes
            </Link>{" "}
            ·{" "}
            <Link href="/api-backend/api/planet/payouts.csv" style={ftLink}>
              certs
            </Link>{" "}
            ·{" "}
            <Link href="/api-backend/api/ecosystem/earnings.csv" style={ftLink}>
              ecosystem totals
            </Link>
          </p>
          <p style={{ margin: 0 }}>
            <strong>Hidden from search:</strong> robots noindex,nofollow.
          </p>
        </footer>
      </ProductPageShell>
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#475569",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
};

const ftLink: React.CSSProperties = {
  color: "#7c3aed",
  textDecoration: "none",
  fontWeight: 700,
};

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(15,23,42,0.03)",
        border: "1px solid rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "ui-monospace, monospace" }}>{value}</div>
    </div>
  );
}
