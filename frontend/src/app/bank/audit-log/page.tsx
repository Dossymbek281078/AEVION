"use client";

/**
 * /bank/audit-log — compliance-grade unified ledger view.
 *
 * Combines two streams that already exist in the bank UI but are scattered
 * across separate sections of /bank:
 *
 *   - operations from /api/qtrade/operations  (server-side ledger)
 *   - signatures from localStorage             (QSign audit log)
 *
 * Each row of the timeline pairs an operation with its matching signature
 * (when one exists), giving an auditor a single screen they can hand to a
 * regulator or partner. Filter bar narrows by date range and kind. Export
 * dumps the filtered slice to JSON or CSV. The whole page is print-friendly.
 *
 * The route is noindex'd at the layout level — this is the user's own ledger,
 * not public content. Auth-gated via useAuthMe + useBank: anonymous users get
 * a sign-in CTA instead of the timeline.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { useAuthMe } from "../_hooks/useAuthMe";
import { useBank } from "../_hooks/useBank";
import { loadSignatures, SIGNATURE_EVENT, type SignedOperation } from "../_lib/signatures";
import type { Operation } from "../_lib/types";

type Kind = "all" | "topup" | "transfer";

type Row = {
  id: string;
  ts: string;
  kind: "topup" | "transfer";
  direction: "in" | "out" | "topup";
  amount: number;
  counterparty: string | null;
  signature: SignedOperation | null;
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatTs(s: string): string {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadBlob(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function AuditLogPage() {
  const { token, me, checked } = useAuthMe();
  const { account, operations, loading } = useBank(me, () => void 0);
  const [signatures, setSignatures] = useState<SignedOperation[]>([]);
  const [kind, setKind] = useState<Kind>("all");
  const [from, setFrom] = useState<string>(todayPlus(-30));
  const [to, setTo] = useState<string>(todayPlus(0));
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    setSignatures(loadSignatures());
    const sync = () => setSignatures(loadSignatures());
    if (typeof window !== "undefined") {
      window.addEventListener("storage", sync);
      window.addEventListener(SIGNATURE_EVENT, sync as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", sync);
        window.removeEventListener(SIGNATURE_EVENT, sync as EventListener);
      }
    };
  }, []);

  const rows: Row[] = useMemo(() => {
    if (!account) return [];
    const sigById = new Map(signatures.map((s) => [s.id, s]));
    return (operations as Operation[])
      .map((op): Row => {
        const direction: Row["direction"] =
          op.kind === "topup" ? "topup" : op.from === account.id ? "out" : "in";
        const counterparty =
          op.kind === "topup"
            ? null
            : op.from === account.id
            ? op.to
            : op.from;
        return {
          id: op.id,
          ts: op.createdAt || "",
          kind: op.kind,
          direction,
          amount: Number(op.amount) || 0,
          counterparty,
          signature: sigById.get(op.id) ?? null,
        };
      })
      .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  }, [operations, signatures, account]);

  const filtered: Row[] = useMemo(() => {
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : 0;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : Number.MAX_SAFE_INTEGER;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      const t = r.ts ? new Date(r.ts).getTime() : 0;
      if (t && (t < fromTs || t > toTs)) return false;
      if (q) {
        const hay = `${r.id} ${r.counterparty ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, kind, from, to, search]);

  const summary = useMemo(() => {
    const sumIn = filtered
      .filter((r) => r.direction === "in" || r.direction === "topup")
      .reduce((acc, r) => acc + r.amount, 0);
    const sumOut = filtered
      .filter((r) => r.direction === "out")
      .reduce((acc, r) => acc + r.amount, 0);
    const signed = filtered.filter((r) => r.signature).length;
    return {
      count: filtered.length,
      sumIn: Math.round(sumIn * 100) / 100,
      sumOut: Math.round(sumOut * 100) / 100,
      net: Math.round((sumIn - sumOut) * 100) / 100,
      signed,
    };
  }, [filtered]);

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: account ? { id: account.id, owner: account.owner } : null,
      filters: { kind, from, to, search },
      summary,
      rows: filtered,
    };
    downloadBlob(
      `aevion-bank-audit-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
      JSON.stringify(payload, null, 2),
    );
  };

  const exportCsv = () => {
    const header = [
      "id",
      "timestamp",
      "kind",
      "direction",
      "amount",
      "counterparty",
      "signature_algo",
      "signature_signed_at",
      "signature_verified",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          csvEscape(r.id),
          csvEscape(r.ts),
          csvEscape(r.kind),
          csvEscape(r.direction),
          csvEscape(String(r.amount)),
          csvEscape(r.counterparty ?? ""),
          csvEscape(r.signature?.algo ?? ""),
          csvEscape(r.signature?.signedAt ?? ""),
          csvEscape(r.signature?.verified ?? ""),
        ].join(","),
      );
    }
    downloadBlob(
      `aevion-bank-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
      lines.join("\n"),
    );
  };

  const printPage = () => {
    if (typeof window !== "undefined") window.print();
  };

  if (!checked) {
    return (
      <main>
        <ProductPageShell maxWidth={1100}>
          <Wave1Nav />
          <p style={{ color: "#64748b", padding: 40 }}>Loading session…</p>
        </ProductPageShell>
      </main>
    );
  }

  if (!token) {
    return (
      <main>
        <ProductPageShell maxWidth={1100}>
          <Wave1Nav />
          <header style={{ marginTop: 12, marginBottom: 16 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Audit log</h1>
            <p style={{ color: "#475569", marginTop: 6, lineHeight: 1.55 }}>
              Compliance-grade view of every Bank operation paired with its QSign signature. Sign in to load your ledger.
            </p>
          </header>
          <Link
            href="/auth"
            style={{
              display: "inline-block",
              padding: "12px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#0d9488,#0ea5e9)",
              color: "#fff",
              fontWeight: 800,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Sign in →
          </Link>
        </ProductPageShell>
      </main>
    );
  }

  return (
    <main>
      <ProductPageShell maxWidth={1100}>
        <Wave1Nav />

        <header style={{ marginTop: 14, marginBottom: 18 }}>
          <Link
            href="/bank"
            style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}
          >
            ← Back to Bank
          </Link>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: "8px 0 6px", letterSpacing: "-0.02em" }}>
            Audit log
          </h1>
          <p style={{ color: "#475569", margin: 0, lineHeight: 1.55, fontSize: 14 }}>
            Unified ledger: every operation paired with its QSign signature (when present). Filter by
            kind and date range, export the slice as CSV/JSON, or print for a paper trail. Source of
            truth: <code style={{ background: "rgba(15,23,42,0.05)", padding: "1px 6px", borderRadius: 4 }}>/api/qtrade/operations</code> +
            local <code style={{ background: "rgba(15,23,42,0.05)", padding: "1px 6px", borderRadius: 4 }}>aevion_bank_signatures_v1</code>.
          </p>
        </header>

        <section
          style={{
            border: "1px solid rgba(15,23,42,0.10)",
            borderRadius: 14,
            padding: "12px 14px",
            background: "rgba(241,245,249,0.55)",
            marginBottom: 14,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
          aria-label="Filters"
        >
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
            Kind
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              style={{ display: "block", marginTop: 4, width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(15,23,42,0.18)" }}
            >
              <option value="all">All</option>
              <option value="topup">Top-up</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ display: "block", marginTop: 4, width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(15,23,42,0.18)" }}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ display: "block", marginTop: 4, width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(15,23,42,0.18)" }}
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
            Search id / counterparty
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="acc_… or op_…"
              style={{ display: "block", marginTop: 4, width: "100%", padding: 8, borderRadius: 8, border: "1px solid rgba(15,23,42,0.18)" }}
            />
          </label>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
          aria-label="Summary"
        >
          {[
            { label: "Operations", value: summary.count, color: "#0f172a" },
            { label: "Inflow", value: `${summary.sumIn} AEC`, color: "#059669" },
            { label: "Outflow", value: `${summary.sumOut} AEC`, color: "#b91c1c" },
            { label: "Net", value: `${summary.net} AEC`, color: summary.net >= 0 ? "#059669" : "#b91c1c" },
            { label: "Signed", value: `${summary.signed}/${summary.count}`, color: "#7c3aed" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.10)",
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
                {s.label}
              </div>
              <div style={{ marginTop: 4, fontWeight: 900, fontSize: 18, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </section>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={exportCsv}
            disabled={summary.count === 0}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.18)",
              background: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: summary.count === 0 ? "default" : "pointer",
              opacity: summary.count === 0 ? 0.5 : 1,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            ↓ CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={summary.count === 0}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.18)",
              background: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: summary.count === 0 ? "default" : "pointer",
              opacity: summary.count === 0 ? 0.5 : 1,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            ↓ JSON
          </button>
          <button
            type="button"
            onClick={printPage}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.18)",
              background: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            ⎙ Print
          </button>
        </div>

        <section
          style={{
            border: "1px solid rgba(15,23,42,0.10)",
            borderRadius: 14,
            background: "#fff",
            overflow: "hidden",
          }}
          aria-label="Ledger timeline"
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
              No operations in the selected slice.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#475569", background: "rgba(241,245,249,0.7)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <th style={{ padding: "10px 12px" }}>When</th>
                  <th style={{ padding: "10px 12px" }}>Kind</th>
                  <th style={{ padding: "10px 12px" }}>Direction</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Amount</th>
                  <th style={{ padding: "10px 12px" }}>Counterparty</th>
                  <th style={{ padding: "10px 12px" }}>Signature</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid rgba(15,23,42,0.08)" }}>
                    <td style={{ padding: "10px 12px", color: "#475569", whiteSpace: "nowrap" }}>{formatTs(r.ts)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.kind}</td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 700,
                        color: r.direction === "out" ? "#b91c1c" : "#059669",
                      }}
                    >
                      {r.direction === "out" ? "↑ out" : r.direction === "in" ? "↓ in" : "+ topup"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontWeight: 800,
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        color: r.direction === "out" ? "#b91c1c" : "#059669",
                      }}
                    >
                      {r.direction === "out" ? "−" : "+"}
                      {r.amount.toFixed(2)} AEC
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        color: "#475569",
                        wordBreak: "break-all",
                        maxWidth: 240,
                      }}
                    >
                      {r.counterparty ? (
                        <Link
                          href={`/bank/receipt/${encodeURIComponent(r.id)}`}
                          style={{ color: "#0f172a", textDecoration: "none", fontWeight: 600 }}
                        >
                          {r.counterparty}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {r.signature ? (
                        <Link
                          href={`/bank/receipt/${encodeURIComponent(r.id)}`}
                          title={`${r.signature.algo} · ${r.signature.signedAt}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "rgba(124,58,237,0.10)",
                            color: "#4c1d95",
                            border: "1px solid rgba(124,58,237,0.30)",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            textDecoration: "none",
                          }}
                        >
                          ✓ {r.signature.algo}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>unsigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p style={{ marginTop: 14, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          Operations are fetched live from the backend; signatures live in
          <code style={{ background: "rgba(15,23,42,0.05)", padding: "1px 6px", borderRadius: 4, margin: "0 4px" }}>aevion_bank_signatures_v1</code>
          on this device. Click a counterparty / signature row to open the printable receipt for that operation.
        </p>

        <style>{`
          @media print {
            nav, header a, .demo-aurora { display: none !important; }
            body { background: #fff !important; }
          }
        `}</style>
      </ProductPageShell>
    </main>
  );
}
