"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type Currency = "USD" | "EUR" | "KZT" | "AEC";

type LocalLink = {
  id: string;
  amount: number;
  currency: Currency;
  title: string;
  status: "active" | "paid" | "expired";
  createdAt: number;
};

type ApiRefund = {
  id: string;
  link_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: "succeeded";
  created: number;
};

const LINKS_KEY = "aevion.payments.links.v1";
const KEY_STORE = "aevion.payments.api.keys.v1";

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
    const newKey = {
      id: `key_demo_${Date.now().toString(36).slice(-4)}`,
      name: "Auto-generated (Refunds page)",
      prefix: full.slice(0, 12) + "…",
      full,
      createdAt: Date.now(),
      livemode: false,
    };
    window.localStorage.setItem(KEY_STORE, JSON.stringify([newKey, ...parsed]));
    return full;
  } catch {
    return "sk_test_DEMOFALLBACK";
  }
}

export default function RefundsPage() {
  const [links, setLinks] = useState<LocalLink[]>([]);
  const [refunds, setRefunds] = useState<ApiRefund[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("requested_by_customer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const fetchRefunds = useCallback(async () => {
    if (typeof window === "undefined") return;
    const apiKey = ensureDemoApiKey();
    try {
      const r = await fetch(`${window.location.origin}/api/payments/v1/refunds`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (!r.ok) return;
      const data: { data: ApiRefund[] } = await r.json();
      setRefunds(data.data || []);
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
    void fetchRefunds();
  }, [fetchRefunds]);

  const paidLinks = useMemo(
    () => links.filter((l) => l.status === "paid"),
    [links]
  );

  const refundedByLink = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of refunds) m[r.link_id] = (m[r.link_id] ?? 0) + r.amount;
    return m;
  }, [refunds]);

  const selectedLink = paidLinks.find((l) => l.id === selectedLinkId);
  const remainingForSelected = selectedLink
    ? Math.max(0, selectedLink.amount - (refundedByLink[selectedLink.id] ?? 0))
    : 0;

  const stats = useMemo(() => {
    const today = refunds.filter(
      (r) => Date.now() - r.created < 24 * 60 * 60 * 1000
    );
    const total7d = refunds.filter(
      (r) => Date.now() - r.created < 7 * 24 * 60 * 60 * 1000
    );
    return {
      total: refunds.length,
      today: today.length,
      sumToday: today.reduce((acc, r) => acc + r.amount, 0),
      sum7d: total7d.reduce((acc, r) => acc + r.amount, 0),
    };
  }, [refunds]);

  async function handleIssueRefund(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!selectedLink) {
      setErr("Pick a paid link first.");
      return;
    }
    const num = amount.trim() ? parseFloat(amount) : remainingForSelected;
    if (!Number.isFinite(num) || num <= 0) {
      setErr("Amount must be positive.");
      return;
    }
    if (num > remainingForSelected + 1e-9) {
      setErr(
        `Amount exceeds remaining ${formatAmount(
          remainingForSelected,
          selectedLink.currency
        )}.`
      );
      return;
    }
    setBusy(true);
    try {
      const apiKey = ensureDemoApiKey();
      const r = await fetch(`${window.location.origin}/api/payments/v1/refunds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `rfd_ui_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        },
        body: JSON.stringify({
          link_id: selectedLink.id,
          amount: num,
          reason: reason.trim() || "requested_by_customer",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j?.error?.message || `HTTP ${r.status}`);
      } else {
        setOk(`Refund ${j.id} issued for ${formatAmount(j.amount, j.currency)}.`);
        setAmount("");
        await fetchRefunds();
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #fff7ed 0%, #fef3c7 30%, #fff 100%)",
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
            color: "#b45309",
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
          Refunds
        </h1>
        <p
          style={{
            fontSize: 18,
            color: "#475569",
            maxWidth: 760,
            lineHeight: 1.5,
            marginBottom: 28,
          }}
        >
          Issue partial or full refunds against paid links. Refunds fire the{" "}
          <code
            style={{
              background: "#fff7ed",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #fdba74",
            }}
          >
            payment.refunded
          </code>{" "}
          webhook with an HMAC signature to every enabled endpoint.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 32,
          }}
        >
          {[
            { label: "Total refunds", value: stats.total },
            { label: "Issued today", value: stats.today },
            { label: "Today (USD-eq)", value: `$${stats.sumToday.toFixed(2)}` },
            { label: "Last 7d (USD-eq)", value: `$${stats.sum7d.toFixed(2)}` },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#b45309",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 26,
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
            onSubmit={handleIssueRefund}
            style={{
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 16,
              padding: 22,
              alignSelf: "start",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>
              Issue a refund
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 18px" }}>
              Select a paid link from this device, optionally enter a partial
              amount and a reason.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Paid link</label>
              <select
                value={selectedLinkId}
                onChange={(e) => setSelectedLinkId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— pick paid link —</option>
                {paidLinks.map((l) => {
                  const refunded = refundedByLink[l.id] ?? 0;
                  const left = l.amount - refunded;
                  return (
                    <option key={l.id} value={l.id} disabled={left <= 0}>
                      {l.title} — {formatAmount(l.amount, l.currency)}
                      {refunded > 0
                        ? ` (refunded ${formatAmount(refunded, l.currency)})`
                        : ""}
                      {left <= 0 ? " · fully refunded" : ""}
                    </option>
                  );
                })}
              </select>
              {paidLinks.length === 0 && (
                <p style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>
                  No paid links on this device. Mark a link as paid in{" "}
                  <Link
                    href="/payments/links"
                    style={{ color: "#b45309", fontWeight: 700 }}
                  >
                    /payments/links
                  </Link>{" "}
                  first.
                </p>
              )}
            </div>

            {selectedLink && (
              <div
                style={{
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#7c2d12",
                  marginBottom: 14,
                }}
              >
                Remaining refundable:{" "}
                <strong>
                  {formatAmount(remainingForSelected, selectedLink.currency)}
                </strong>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Amount (blank = full remaining)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  selectedLink
                    ? String(remainingForSelected.toFixed(2))
                    : "0.00"
                }
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={inputStyle}
              >
                <option value="requested_by_customer">requested_by_customer</option>
                <option value="duplicate">duplicate</option>
                <option value="fraudulent">fraudulent</option>
                <option value="product_unacceptable">product_unacceptable</option>
                <option value="goodwill">goodwill</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={busy || !selectedLink || remainingForSelected <= 0}
              style={{
                width: "100%",
                padding: "13px 18px",
                borderRadius: 12,
                border: "none",
                background:
                  busy || !selectedLink || remainingForSelected <= 0
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #ea580c 0%, #b45309 100%)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor:
                  busy || !selectedLink || remainingForSelected <= 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {busy ? "Issuing…" : "Issue refund"}
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
                Recent refunds
              </h2>
              <button
                onClick={() => fetchRefunds()}
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
            {refunds.length === 0 ? (
              <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                No refunds issued yet on this rail.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {refunds.slice(0, 30).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 14,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#b45309",
                        fontFamily: "monospace",
                      }}
                    >
                      {r.id}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <strong>{formatAmount(r.amount, r.currency)}</strong> ·{" "}
                      <span style={{ color: "#64748b" }}>
                        {r.reason} · link {r.link_id} · {timeAgo(r.created)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "#dcfce7",
                        color: "#14532d",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {r.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
