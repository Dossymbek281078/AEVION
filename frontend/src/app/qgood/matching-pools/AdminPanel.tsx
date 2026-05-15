"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import type { MatchingPool } from "./page";

type Currency = "USD" | "EUR" | "KZT";

type FormState = {
  label: string;
  totalDollars: string;
  currency: Currency;
  matchRatio: string;
  maxMatchDollars: string;
};

const INITIAL_FORM: FormState = {
  label: "",
  totalDollars: "",
  currency: "USD",
  matchRatio: "1.0",
  maxMatchDollars: "100",
};

function toNum(v: string | number | undefined | null): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(cents: string | number, currency = "USD"): string {
  const n = toNum(cents);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n / 100);
  } catch {
    return `$${Math.round(n / 100).toLocaleString("en-US")}`;
  }
}

export default function AdminPanel({ pools }: { pools: MatchingPool[] }) {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<MatchingPool | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    try {
      const t = typeof window !== "undefined" ? localStorage.getItem("aevion_token") : null;
      setToken(t);
    } catch {
      setToken(null);
    }
  }, []);

  if (!hydrated) {
    return (
      <div
        style={{
          padding: 20,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          color: "#94a3b8",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        Loading admin controls…
      </div>
    );
  }

  if (!token) {
    return (
      <div
        style={{
          padding: 24,
          background: "#1e293b",
          border: "1px dashed #334155",
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, marginBottom: 8, color: "#f1f5f9" }}>
          Admin actions
        </h2>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, marginBottom: 14, lineHeight: 1.5 }}>
          Creating and managing matching pools requires QGood admin access. Sign in to continue.
        </p>
        <Link
          href="/auth?next=/qgood/matching-pools"
          style={{
            display: "inline-block",
            padding: "9px 18px",
            background: "#10b981",
            color: "#062e22",
            fontWeight: 800,
            fontSize: 13,
            borderRadius: 10,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    const label = form.label.trim();
    if (label.length < 3 || label.length > 120) {
      setError("Label must be between 3 and 120 characters.");
      return;
    }
    const totalDollars = parseFloat(form.totalDollars);
    if (!Number.isFinite(totalDollars) || totalDollars < 1 || totalDollars > 10_000_000) {
      setError("Total must be between $1 and $10,000,000.");
      return;
    }
    const matchRatio = parseFloat(form.matchRatio);
    if (!Number.isFinite(matchRatio) || matchRatio < 0.1 || matchRatio > 2) {
      setError("Match ratio must be between 0.1 and 2.");
      return;
    }
    const maxMatchDollars = parseFloat(form.maxMatchDollars);
    if (!Number.isFinite(maxMatchDollars) || maxMatchDollars < 0 || maxMatchDollars > 1_000_000) {
      setError("Max match per donation must be between $0 and $1,000,000.");
      return;
    }

    const body = {
      label,
      totalCents: Math.round(totalDollars * 100),
      currency: form.currency,
      matchRatio,
      maxMatchPerDonationCents: Math.round(maxMatchDollars * 100),
    };

    setSubmitting(true);
    try {
      const r = await fetch(`${getApiBase()}/api/qgood/matching-pools`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 403) {
        setError("Admin access required — only addresses in QGOOD_ADMIN_EMAILS can create pools.");
        return;
      }
      if (r.status === 400) {
        setError(typeof data?.error === "string" ? data.error : "Invalid request.");
        return;
      }
      if (!r.ok) {
        setError(`Request failed (HTTP ${r.status}).`);
        return;
      }
      setCreated(data as MatchingPool);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function flipPool(id: string, action: "pause" | "resume") {
    setBusyId(id);
    setToast(null);
    try {
      const r = await fetch(`${getApiBase()}/api/qgood/matching-pools/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 403) {
        setToast("Admin access required.");
        return;
      }
      if (r.status === 400) {
        setToast(typeof data?.error === "string" ? data.error : "Cannot resume an exhausted pool.");
        return;
      }
      if (!r.ok) {
        setToast(`Request failed (HTTP ${r.status}).`);
        return;
      }
      const newStatus = data?.pool?.status || (action === "pause" ? "paused" : "active");
      setToast(`Pool flipped → ${newStatus}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#f1f5f9" }}>Admin · Create a matching pool</h2>

      <form
        onSubmit={onSubmit}
        style={{
          padding: 20,
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Field label="Label" hint="Public name, 3–120 chars">
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="e.g. Spring 2026 Education Match"
            minLength={3}
            maxLength={120}
            required
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", minWidth: 200 }}>
            <Field label="Total (in dollars)" hint="$1 – $10,000,000">
              <input
                type="number"
                value={form.totalDollars}
                onChange={(e) => setForm({ ...form, totalDollars: e.target.value })}
                placeholder="10000"
                min={1}
                max={10_000_000}
                step="1"
                required
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ flex: "0 0 140px", minWidth: 140 }}>
            <Field label="Currency" hint="ISO code">
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
                style={inputStyle}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="KZT">KZT</option>
              </select>
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", minWidth: 200 }}>
            <Field label="Match ratio" hint="1.0 = match 100% of each donation">
              <input
                type="number"
                value={form.matchRatio}
                onChange={(e) => setForm({ ...form, matchRatio: e.target.value })}
                min={0.1}
                max={2}
                step={0.1}
                required
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ flex: "1 1 200px", minWidth: 200 }}>
            <Field label="Max match per donation ($)" hint="Cap per single donation">
              <input
                type="number"
                value={form.maxMatchDollars}
                onChange={(e) => setForm({ ...form, maxMatchDollars: e.target.value })}
                min={0}
                max={1_000_000}
                step="1"
                required
                style={inputStyle}
              />
            </Field>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 8,
              color: "#fca5a5",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {created && (
          <div
            style={{
              padding: 12,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 8,
              color: "#6ee7b7",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Pool created successfully · id <code style={{ color: "#f1f5f9" }}>{created.id}</code>.{" "}
            <Link href="/qgood/matching-pools" style={{ color: "#34d399", fontWeight: 700 }}>
              Reload the page
            </Link>{" "}
            to see it in the list.
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "10px 20px",
              background: submitting ? "#475569" : "#10b981",
              color: submitting ? "#cbd5e1" : "#062e22",
              fontWeight: 800,
              fontSize: 13,
              borderRadius: 10,
              border: "none",
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Creating…" : "Create pool"}
          </button>
        </div>
      </form>

      <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, marginTop: 6, color: "#f1f5f9" }}>
        Admin · Pause / Resume existing pools
      </h3>

      {toast && (
        <div
          style={{
            padding: 10,
            background: "rgba(52,211,153,0.12)",
            border: "1px solid rgba(52,211,153,0.4)",
            borderRadius: 8,
            color: "#6ee7b7",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {toast}{" "}
          <Link href="/qgood/matching-pools" style={{ color: "#34d399", fontWeight: 700 }}>
            Reload
          </Link>{" "}
          to refresh.
        </div>
      )}

      {pools.length === 0 ? (
        <div
          style={{
            padding: 16,
            background: "#1e293b",
            border: "1px dashed #334155",
            borderRadius: 10,
            color: "#94a3b8",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          No pools to manage yet.
        </div>
      ) : (
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {pools.map((p, idx) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                gap: 12,
                padding: 14,
                borderTop: idx === 0 ? "none" : "1px solid #334155",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {fmtMoney(p.remainingCents, p.currency)} / {fmtMoney(p.totalCents, p.currency)}
                </div>
              </div>
              <div
                style={{
                  padding: "3px 10px",
                  background:
                    p.status === "active"
                      ? "rgba(16,185,129,0.15)"
                      : p.status === "paused"
                        ? "rgba(251,191,36,0.15)"
                        : "rgba(100,116,139,0.18)",
                  border: `1px solid ${
                    p.status === "active"
                      ? "rgba(16,185,129,0.4)"
                      : p.status === "paused"
                        ? "rgba(251,191,36,0.4)"
                        : "rgba(100,116,139,0.4)"
                  }`,
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color:
                    p.status === "active" ? "#6ee7b7" : p.status === "paused" ? "#fbbf24" : "#94a3b8",
                }}
              >
                {p.status}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={busyId === p.id || p.status !== "active"}
                  onClick={() => flipPool(p.id, "pause")}
                  style={{
                    padding: "6px 14px",
                    background: p.status === "active" ? "#fbbf24" : "#334155",
                    color: p.status === "active" ? "#422006" : "#94a3b8",
                    fontWeight: 800,
                    fontSize: 12,
                    borderRadius: 8,
                    border: "none",
                    cursor: busyId === p.id || p.status !== "active" ? "not-allowed" : "pointer",
                    opacity: busyId === p.id ? 0.5 : 1,
                  }}
                >
                  {busyId === p.id ? "…" : "Pause"}
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id || p.status !== "paused"}
                  onClick={() => flipPool(p.id, "resume")}
                  style={{
                    padding: "6px 14px",
                    background: p.status === "paused" ? "#10b981" : "#334155",
                    color: p.status === "paused" ? "#062e22" : "#94a3b8",
                    fontWeight: 800,
                    fontSize: 12,
                    borderRadius: 8,
                    border: "none",
                    cursor: busyId === p.id || p.status !== "paused" ? "not-allowed" : "pointer",
                    opacity: busyId === p.id ? 0.5 : 1,
                  }}
                >
                  {busyId === p.id ? "…" : "Resume"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.02em" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "#64748b" }}>{hint}</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
};
