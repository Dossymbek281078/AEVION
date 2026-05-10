"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type DisputeStatus =
  | "warning_needs_response"
  | "under_review"
  | "won"
  | "lost"
  | "charge_refunded";

type ApiDispute = {
  id: string;
  link_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: DisputeStatus;
  evidence_url: string | null;
  evidence_text: string | null;
  due_by: number;
  created: number;
  updated: number;
};

type LocalLink = {
  id: string;
  amount: number;
  currency: string;
  title: string;
  status: "active" | "paid" | "expired";
};

const LINKS_KEY = "aevion.payments.links.v1";
const KEY_STORE = "aevion.payments.api.keys.v1";

const STATUS_META: Record<DisputeStatus, { label: string; color: string; bg: string }> = {
  warning_needs_response: { label: "needs response", color: "#7c2d12", bg: "#fed7aa" },
  under_review: { label: "under review", color: "#1e3a8a", bg: "#bfdbfe" },
  won: { label: "won", color: "#14532d", bg: "#bbf7d0" },
  lost: { label: "lost", color: "#7f1d1d", bg: "#fecaca" },
  charge_refunded: { label: "refunded", color: "#3b0764", bg: "#e9d5ff" },
};

const REASONS = [
  "fraudulent",
  "product_not_received",
  "product_unacceptable",
  "duplicate",
  "credit_not_processed",
  "customer_signature_missing",
  "general",
];

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  fontSize: 14,
  color: "#0f172a",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function formatAmount(amount: number, currency: string) {
  if (currency === "AEC") return `${amount.toLocaleString()} AEC`;
  if (currency === "KZT") return `${amount.toLocaleString("ru-RU")} ₸`;
  if (currency === "EUR")
    return `€${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function dueIn(ms: number) {
  const s = Math.floor((ms - Date.now()) / 1000);
  if (s < 0) return `overdue ${Math.floor(-s / 86400)}d`;
  if (s < 3600) return `due in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `due in ${Math.floor(s / 3600)}h`;
  return `due in ${Math.floor(s / 86400)}d`;
}

function ensureDemoApiKey(): string {
  if (typeof window === "undefined") return "sk_test_DEMOFALLBACK";
  try {
    const raw = window.localStorage.getItem(KEY_STORE);
    const parsed: { full?: string }[] = raw ? JSON.parse(raw) : [];
    if (parsed.length > 0 && parsed[0].full) return parsed[0].full;
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const tail = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const full = "sk_test_" + tail;
    window.localStorage.setItem(
      KEY_STORE,
      JSON.stringify([
        {
          id: `key_demo_${Date.now().toString(36).slice(-4)}`,
          name: "Auto-generated (Disputes page)",
          prefix: full.slice(0, 12) + "…",
          full,
          createdAt: Date.now(),
          livemode: false,
        },
        ...parsed,
      ])
    );
    return full;
  } catch {
    return "sk_test_DEMOFALLBACK";
  }
}

export default function DisputesPage() {
  const [links, setLinks] = useState<LocalLink[]>([]);
  const [disputes, setDisputes] = useState<ApiDispute[]>([]);
  const [linkId, setLinkId] = useState("");
  const [reason, setReason] = useState("fraudulent");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    if (typeof window === "undefined") return;
    const apiKey = ensureDemoApiKey();
    try {
      const r = await fetch(`${window.location.origin}/api/payments/v1/disputes`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (!r.ok) return;
      const data: { data: ApiDispute[] } = await r.json();
      setDisputes(data.data || []);
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LINKS_KEY);
      if (raw) setLinks(JSON.parse(raw));
    } catch {
      // ignore
    }
    void fetchDisputes();
  }, [fetchDisputes]);

  const paidLinks = useMemo(() => links.filter((l) => l.status === "paid"), [links]);

  const stats = useMemo(() => {
    return {
      total: disputes.length,
      pending: disputes.filter((d) => d.status === "warning_needs_response").length,
      review: disputes.filter((d) => d.status === "under_review").length,
      won: disputes.filter((d) => d.status === "won").length,
      lost: disputes.filter((d) => d.status === "lost").length,
    };
  }, [disputes]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!linkId) {
      setErr("Pick a paid link first.");
      return;
    }
    setBusy(true);
    try {
      const apiKey = ensureDemoApiKey();
      const r = await fetch(`${window.location.origin}/api/payments/v1/disputes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `dp_ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          link_id: linkId,
          reason,
          evidence_text: evidence.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j?.error?.message || `HTTP ${r.status}`);
      } else {
        setOk(`Dispute ${j.id} opened.`);
        setLinkId("");
        setEvidence("");
        await fetchDisputes();
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function transition(d: ApiDispute, action: "respond" | "resolve_won" | "resolve_lost") {
    const apiKey = ensureDemoApiKey();
    try {
      const r = await fetch(`${window.location.origin}/api/payments/v1/disputes/${d.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      if (r.ok) await fetchDisputes();
    } catch {
      // offline
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #fef2f2 0%, #fee2e2 28%, #fff 100%)",
        padding: "44px 20px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Link
          href="/payments"
          style={{
            color: "#b91c1c",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          ← Back to Payments
        </Link>

        <h1
          style={{
            fontSize: "clamp(34px, 5vw, 52px)",
            fontWeight: 900,
            margin: "16px 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          Disputes
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "#475569",
            maxWidth: 760,
            lineHeight: 1.5,
            marginBottom: 28,
          }}
        >
          Open chargebacks against any paid link. Disputes fan out{" "}
          <code
            style={{
              background: "#fff",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid rgba(15,23,42,0.1)",
            }}
          >
            dispute.created / .under_review / .won / .lost
          </code>{" "}
          webhooks via the retry queue. Default response window: 7 days.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Total", value: stats.total, color: "#0f172a" },
            { label: "Needs response", value: stats.pending, color: "#b45309" },
            { label: "Under review", value: stats.review, color: "#2563eb" },
            { label: "Won", value: stats.won, color: "#15803d" },
            { label: "Lost", value: stats.lost, color: "#b91c1c" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: s.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  marginTop: 6,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 380px) minmax(0, 1fr)",
            gap: 24,
          }}
        >
          <form
            onSubmit={submit}
            style={{
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 16,
              padding: 22,
              alignSelf: "start",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>
              Open a dispute
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>
              Pick a paid link and the cardholder reason. The merchant has 7
              days to respond before the dispute auto-escalates.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Paid link</label>
              <select
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— pick paid link —</option>
                {paidLinks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} — {formatAmount(l.amount, l.currency)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={inputStyle}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Cardholder evidence (optional)</label>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={4}
                placeholder="Customer statement, transaction context…"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={busy || !linkId}
              style={{
                width: "100%",
                padding: "13px 18px",
                borderRadius: 12,
                border: "none",
                background:
                  busy || !linkId
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: busy || !linkId ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Opening…" : "Open dispute"}
            </button>

            {err && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  borderRadius: 10,
                  color: "#991b1b",
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            )}
            {ok && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: 10,
                  color: "#14532d",
                  fontSize: 13,
                }}
              >
                {ok}
              </div>
            )}
          </form>

          <section
            style={{
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Recent disputes
              </h2>
              <button
                onClick={() => fetchDisputes()}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.15)",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: "#0f172a",
                }}
              >
                ↻ refresh
              </button>
            </div>
            {disputes.length === 0 ? (
              <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                No disputes yet. Once you open one it appears here.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {disputes.map((d) => {
                  const meta = STATUS_META[d.status];
                  const canRespond = d.status === "warning_needs_response";
                  const canResolve =
                    d.status === "warning_needs_response" ||
                    d.status === "under_review";
                  return (
                    <div
                      key={d.id}
                      style={{
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        borderRadius: 12,
                        padding: "12px 14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontFamily: "monospace",
                            color: "#475569",
                          }}
                        >
                          {d.id}
                        </div>
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            color: meta.color,
                            background: meta.bg,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 14 }}>
                        <strong>{formatAmount(d.amount, d.currency)}</strong> ·{" "}
                        <span style={{ color: "#64748b" }}>
                          {d.reason} · link {d.link_id} · {timeAgo(d.created)} ·{" "}
                          <span
                            style={{
                              color:
                                d.due_by < Date.now() ? "#b91c1c" : "#64748b",
                            }}
                          >
                            {dueIn(d.due_by)}
                          </span>
                        </span>
                      </div>
                      {(canRespond || canResolve) && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          {canRespond && (
                            <button
                              onClick={() => transition(d, "respond")}
                              style={btnSm("#2563eb")}
                            >
                              ↗ respond (under review)
                            </button>
                          )}
                          {canResolve && (
                            <>
                              <button
                                onClick={() => transition(d, "resolve_won")}
                                style={btnSm("#15803d")}
                              >
                                ✓ mark won
                              </button>
                              <button
                                onClick={() => transition(d, "resolve_lost")}
                                style={btnSm("#b91c1c")}
                              >
                                ✕ mark lost
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function btnSm(color: string): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${color}`,
    background: `${color}11`,
    color,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
}
