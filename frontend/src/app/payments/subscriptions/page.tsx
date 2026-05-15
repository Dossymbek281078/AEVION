"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Interval = "weekly" | "monthly" | "quarterly" | "yearly";
type Currency = "USD" | "EUR" | "KZT" | "AEC";
type SubStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";

type Subscription = {
  id: string;
  customerEmail: string;
  planName: string;
  amount: number;
  currency: Currency;
  interval: Interval;
  trialDays: number;
  status: SubStatus;
  createdAt: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  failedAttempts: number;
};

const STORAGE_KEY = "aevion.payments.subscriptions.v1";

const INTERVAL_DAYS: Record<Interval, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

const INTERVAL_LABEL: Record<Interval, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

function formatAmount(a: number, c: Currency) {
  if (c === "AEC") return `${a.toLocaleString()} AEC`;
  if (c === "KZT") return `${a.toLocaleString("ru-RU")} ₸`;
  if (c === "EUR")
    return `€${a.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${a.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function relTime(ts: number) {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const d = Math.round(abs / (1000 * 60 * 60 * 24));
  if (d < 1) {
    const h = Math.round(abs / (1000 * 60 * 60));
    return future ? `in ${h}h` : `${h}h ago`;
  }
  return future ? `in ${d}d` : `${d}d ago`;
}

function genId() {
  return `sub_${Date.now().toString(36).slice(-4)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const SAMPLE: Subscription[] = [
  {
    id: "sub_demo_pro",
    customerEmail: "alice@example.com",
    planName: "AEVION Pro · Monthly",
    amount: 29,
    currency: "USD",
    interval: "monthly",
    trialDays: 0,
    status: "active",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
    currentPeriodStart: Date.now() - 1000 * 60 * 60 * 24 * 12,
    currentPeriodEnd: Date.now() + 1000 * 60 * 60 * 24 * 18,
    failedAttempts: 0,
  },
  {
    id: "sub_demo_studio",
    customerEmail: "studio@example.com",
    planName: "Bureau Studio · Yearly",
    amount: 1990,
    currency: "USD",
    interval: "yearly",
    trialDays: 0,
    status: "active",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 100,
    currentPeriodStart: Date.now() - 1000 * 60 * 60 * 24 * 100,
    currentPeriodEnd: Date.now() + 1000 * 60 * 60 * 24 * 265,
    failedAttempts: 0,
  },
  {
    id: "sub_demo_kz",
    customerEmail: "almaty@example.kz",
    planName: "QSign Local · Monthly",
    amount: 4900,
    currency: "KZT",
    interval: "monthly",
    trialDays: 14,
    status: "trialing",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    currentPeriodStart: Date.now() - 1000 * 60 * 60 * 24 * 4,
    currentPeriodEnd: Date.now() + 1000 * 60 * 60 * 24 * 10,
    failedAttempts: 0,
  },
  {
    id: "sub_demo_pastdue",
    customerEmail: "lapsed@example.com",
    planName: "AEVION Pro · Monthly",
    amount: 29,
    currency: "USD",
    interval: "monthly",
    trialDays: 0,
    status: "past_due",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 90,
    currentPeriodStart: Date.now() - 1000 * 60 * 60 * 24 * 35,
    currentPeriodEnd: Date.now() - 1000 * 60 * 60 * 24 * 5,
    failedAttempts: 2,
  },
];

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

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const chipBase: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  color: "#0f172a",
};

function chipActive(color: string): CSSProperties {
  return {
    ...chipBase,
    background: color,
    color: "#fff",
    borderColor: color,
    boxShadow: `0 4px 12px ${color}44`,
  };
}

function statusMeta(s: SubStatus): { bg: string; fg: string; label: string } {
  switch (s) {
    case "active":
      return { bg: "rgba(5,150,105,0.12)", fg: "#047857", label: "Active" };
    case "trialing":
      return { bg: "rgba(13,148,136,0.12)", fg: "#0f766e", label: "Trial" };
    case "past_due":
      return { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", label: "Past due" };
    case "paused":
      return { bg: "rgba(245,158,11,0.12)", fg: "#b45309", label: "Paused" };
    case "canceled":
      return { bg: "rgba(100,116,139,0.12)", fg: "#475569", label: "Canceled" };
  }
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<"all" | SubStatus>("all");

  const [planName, setPlanName] = useState("AEVION Pro · Monthly");
  const [amount, setAmount] = useState("29");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [interval, setInterval] = useState<Interval>("monthly");
  const [trialDays, setTrialDays] = useState(7);
  const [email, setEmail] = useState("customer@example.com");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setSubs(raw ? JSON.parse(raw) : SAMPLE);
    } catch {
      setSubs(SAMPLE);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
    } catch {
      // ignore
    }
  }, [subs, hydrated]);

  const visible = useMemo(() => {
    const sorted = [...subs].sort((a, b) => b.createdAt - a.createdAt);
    return filter === "all" ? sorted : sorted.filter((s) => s.status === filter);
  }, [subs, filter]);

  const stats = useMemo(() => {
    const active = subs.filter((s) => s.status === "active" || s.status === "trialing").length;
    const past_due = subs.filter((s) => s.status === "past_due").length;
    const canceled = subs.filter((s) => s.status === "canceled").length;
    const usd = (s: Subscription) => {
      let perPeriod = s.amount;
      if (s.currency === "EUR") perPeriod *= 1.08;
      else if (s.currency === "KZT") perPeriod /= 470;
      else if (s.currency === "AEC") perPeriod *= 0.5;
      const periodsPerYear = 365 / INTERVAL_DAYS[s.interval];
      return perPeriod * periodsPerYear;
    };
    const arr = subs
      .filter((s) => s.status === "active" || s.status === "trialing")
      .reduce((acc, s) => acc + usd(s), 0);
    return { active, past_due, canceled, arr };
  }, [subs]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) return;
    if (!planName.trim() || !email.trim()) return;
    const now = Date.now();
    const periodEnd = now + INTERVAL_DAYS[interval] * 24 * 60 * 60 * 1000;
    const sub: Subscription = {
      id: genId(),
      customerEmail: email.trim(),
      planName: planName.trim(),
      amount: num,
      currency,
      interval,
      trialDays,
      status: trialDays > 0 ? "trialing" : "active",
      createdAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: trialDays > 0 ? now + trialDays * 24 * 60 * 60 * 1000 : periodEnd,
      failedAttempts: 0,
    };
    setSubs((prev) => [sub, ...prev]);
  }

  function pause(id: string) {
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status: "paused" } : s)));
  }
  function resume(id: string) {
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status: "active" } : s)));
  }
  function cancel(id: string) {
    if (!window.confirm("Cancel this subscription?")) return;
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status: "canceled" } : s)));
  }
  function retry(id: string) {
    setSubs((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: "active",
              failedAttempts: 0,
              currentPeriodStart: Date.now(),
              currentPeriodEnd: Date.now() + INTERVAL_DAYS[s.interval] * 86400000,
            }
          : s
      )
    );
  }
  function remove(id: string) {
    setSubs((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #1e3a8a 48%, #0d9488 100%)",
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
            Subscriptions & recurring billing
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
            Create plans with optional trials, manage active subscribers,
            handle dunning automatically. Smart-retry past-due invoices over 3
            attempts before marking canceled.
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
              label="MRR (USD)"
              value={`$${(stats.arr / 12).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              accent="#5eead4"
            />
            <Stat
              label="ARR (USD)"
              value={`$${stats.arr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              accent="#86efac"
            />
            <Stat label="Active + trial" value={stats.active.toString()} accent="#fcd34d" />
            <Stat label="Past due" value={stats.past_due.toString()} accent="#fda4af" />
          </div>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <form
          onSubmit={handleCreate}
          style={{
            padding: 22,
            borderRadius: 18,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
            display: "grid",
            gap: 12,
            position: "sticky",
            top: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#0d9488",
            }}
          >
            New subscription
          </div>

          <div>
            <label style={labelStyle}>Plan name</label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Customer email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                style={inputStyle}
              >
                {(["USD", "EUR", "KZT", "AEC"] as Currency[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Interval</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(INTERVAL_LABEL) as Interval[]).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInterval(i)}
                  style={interval === i ? chipActive("#0d9488") : chipBase}
                >
                  {INTERVAL_LABEL[i]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Trial</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[0, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTrialDays(d)}
                  style={trialDays === d ? chipActive("#7c3aed") : chipBase}
                >
                  {d === 0 ? "No trial" : `${d}d`}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: "13px 20px",
              borderRadius: 12,
              background: "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
            }}
          >
            Create subscription →
          </button>

          <div
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.04)",
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            <strong>Smart dunning:</strong> failed payments retry on day 1, 3,
            7. After 3 failures the subscription is marked canceled and{" "}
            <code>customer.subscription.canceled</code> webhook fires.
          </div>
        </form>

        <section style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setFilter("all")}
              style={filter === "all" ? chipActive("#0f172a") : chipBase}
            >
              All ({subs.length})
            </button>
            {(["active", "trialing", "past_due", "paused", "canceled"] as SubStatus[]).map(
              (s) => {
                const meta = statusMeta(s);
                const count = subs.filter((x) => x.status === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    style={filter === s ? chipActive(meta.fg) : chipBase}
                  >
                    {meta.label} ({count})
                  </button>
                );
              }
            )}
          </div>

          {visible.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                borderRadius: 16,
                border: "1px dashed rgba(15,23,42,0.2)",
                textAlign: "center",
                color: "#64748b",
                fontSize: 14,
                background: "rgba(15,23,42,0.02)",
              }}
            >
              No subscriptions match this filter.
            </div>
          ) : (
            visible.map((s) => {
              const meta = statusMeta(s.status);
              const isTrial = s.status === "trialing";
              return (
                <article
                  key={s.id}
                  style={{
                    padding: 18,
                    borderRadius: 16,
                    border: "1px solid rgba(15,23,42,0.1)",
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: 4,
                        }}
                      >
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
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {s.customerEmail}
                        </span>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>
                        {s.planName}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {formatAmount(s.amount, s.currency)} / {INTERVAL_LABEL[s.interval].toLowerCase()}
                        {isTrial && ` · trial ends ${relTime(s.currentPeriodEnd)}`}
                        {!isTrial &&
                          s.status !== "canceled" &&
                          ` · next invoice ${relTime(s.currentPeriodEnd)}`}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {s.status === "active" && (
                        <>
                          <button onClick={() => pause(s.id)} style={miniBtn("#475569")}>Pause</button>
                          <button onClick={() => cancel(s.id)} style={miniBtn("#dc2626", true)}>Cancel</button>
                        </>
                      )}
                      {s.status === "trialing" && (
                        <button onClick={() => cancel(s.id)} style={miniBtn("#dc2626", true)}>Cancel trial</button>
                      )}
                      {s.status === "paused" && (
                        <>
                          <button onClick={() => resume(s.id)} style={miniBtn("#059669")}>Resume</button>
                          <button onClick={() => cancel(s.id)} style={miniBtn("#dc2626", true)}>Cancel</button>
                        </>
                      )}
                      {s.status === "past_due" && (
                        <>
                          <button onClick={() => retry(s.id)} style={miniBtn("#0d9488")}>Retry now</button>
                          <button onClick={() => cancel(s.id)} style={miniBtn("#dc2626", true)}>Cancel</button>
                        </>
                      )}
                      {s.status === "canceled" && (
                        <button onClick={() => remove(s.id)} style={miniBtn("#dc2626", true)}>Delete</button>
                      )}
                    </div>
                  </header>

                  {s.status === "past_due" && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(220,38,38,0.06)",
                        border: "1px solid rgba(220,38,38,0.18)",
                        fontSize: 12,
                        color: "#b91c1c",
                      }}
                    >
                      <strong>{s.failedAttempts} failed attempt{s.failedAttempts === 1 ? "" : "s"}</strong> — next
                      retry scheduled by smart dunning. Customer email sent on
                      attempt 1 and 3.
                    </div>
                  )}

                  {(s.status === "active" || s.status === "trialing") && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: "rgba(15,23,42,0.08)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(
                              100,
                              ((Date.now() - s.currentPeriodStart) /
                                Math.max(
                                  1,
                                  s.currentPeriodEnd - s.currentPeriodStart
                                )) *
                                100
                            )}%`,
                            background: isTrial ? "#7c3aed" : "#0d9488",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        Period: {new Date(s.currentPeriodStart).toLocaleDateString()} →{" "}
                        {new Date(s.currentPeriodEnd).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function miniBtn(color: string, ghost = false): CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    background: ghost ? "transparent" : color,
    color: ghost ? color : "#fff",
    fontWeight: 700,
    fontSize: 11,
    border: ghost ? `1px solid ${color}55` : "none",
    cursor: "pointer",
  };
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
