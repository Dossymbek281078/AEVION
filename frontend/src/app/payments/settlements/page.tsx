"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type SettlementTarget = "bank" | "aec";
type SettlementStatus = "pending" | "scheduled" | "paid";

type RoyaltyPart = {
  party: string;
  share: number;
  description: string;
};

type Settlement = {
  id: string;
  target: SettlementTarget;
  amount: number;
  currency: "USD" | "EUR" | "KZT" | "AEC";
  status: SettlementStatus;
  scheduledFor: number;
  paidAt: number | null;
  reference: string;
  payments: number;
  royalty: RoyaltyPart[];
};

const STORAGE_KEY = "aevion.payments.settlements.v1";

const SAMPLE: Settlement[] = [
  {
    id: "st_q9w2k4",
    target: "bank",
    amount: 124500,
    currency: "USD",
    status: "paid",
    scheduledFor: Date.now() - 1000 * 60 * 60 * 28,
    paidAt: Date.now() - 1000 * 60 * 60 * 4,
    reference: "AEV-2026-04-26-USD",
    payments: 47,
    royalty: [
      { party: "Creator pool", share: 0.7, description: "Direct creator earnings" },
      { party: "IP holder royalty", share: 0.15, description: "Bureau-registered IP" },
      { party: "Platform fee", share: 0.1, description: "AEVION operations" },
      { party: "Treasury", share: 0.05, description: "AEC reserve" },
    ],
  },
  {
    id: "st_a3f7m1",
    target: "aec",
    amount: 86200,
    currency: "AEC",
    status: "paid",
    scheduledFor: Date.now() - 1000 * 60 * 60 * 50,
    paidAt: Date.now() - 1000 * 60 * 60 * 26,
    reference: "AEV-2026-04-26-AEC",
    payments: 219,
    royalty: [
      { party: "Creator pool", share: 0.85, description: "Native AEC zero-fee path" },
      { party: "Platform fee", share: 0.08, description: "AEVION operations" },
      { party: "Treasury", share: 0.07, description: "AEC reserve" },
    ],
  },
  {
    id: "st_b8h5n2",
    target: "bank",
    amount: 38900,
    currency: "EUR",
    status: "scheduled",
    scheduledFor: Date.now() + 1000 * 60 * 60 * 18,
    paidAt: null,
    reference: "AEV-2026-04-28-EUR",
    payments: 22,
    royalty: [
      { party: "Creator pool", share: 0.7, description: "Direct creator earnings" },
      { party: "IP holder royalty", share: 0.15, description: "Bureau-registered IP" },
      { party: "Platform fee", share: 0.1, description: "AEVION operations" },
      { party: "Treasury", share: 0.05, description: "AEC reserve" },
    ],
  },
  {
    id: "st_c2d4p9",
    target: "bank",
    amount: 1820000,
    currency: "KZT",
    status: "scheduled",
    scheduledFor: Date.now() + 1000 * 60 * 60 * 24,
    paidAt: null,
    reference: "AEV-2026-04-28-KZT",
    payments: 14,
    royalty: [
      { party: "Creator pool", share: 0.72, description: "KZ-residency tax-adjusted" },
      { party: "IP holder royalty", share: 0.13, description: "Bureau-registered IP" },
      { party: "Platform fee", share: 0.1, description: "AEVION operations" },
      { party: "Treasury", share: 0.05, description: "AEC reserve" },
    ],
  },
  {
    id: "st_e5g8t6",
    target: "aec",
    amount: 42700,
    currency: "AEC",
    status: "pending",
    scheduledFor: Date.now() + 1000 * 60 * 60 * 6,
    paidAt: null,
    reference: "AEV-2026-04-28-AEC",
    payments: 138,
    royalty: [
      { party: "Creator pool", share: 0.85, description: "Native AEC zero-fee path" },
      { party: "Platform fee", share: 0.08, description: "AEVION operations" },
      { party: "Treasury", share: 0.07, description: "AEC reserve" },
    ],
  },
];

function formatCurrency(amount: number, currency: Settlement["currency"]) {
  if (currency === "AEC") return `${amount.toLocaleString()} AEC`;
  if (currency === "KZT") return `${amount.toLocaleString("ru-RU")} ₸`;
  if (currency === "EUR")
    return `€${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function relativeTime(ts: number) {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const hours = Math.round(abs / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.max(1, Math.round(abs / (1000 * 60)));
    return future ? `in ${mins}m` : `${mins}m ago`;
  }
  if (hours < 48) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

const chipBase: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  color: "#0f172a",
  transition: "all 0.12s",
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

function statusMeta(s: SettlementStatus): { bg: string; fg: string; label: string } {
  if (s === "paid")
    return { bg: "rgba(5,150,105,0.12)", fg: "#047857", label: "Paid" };
  if (s === "scheduled")
    return { bg: "rgba(37,99,235,0.12)", fg: "#1d4ed8", label: "Scheduled" };
  return { bg: "rgba(245,158,11,0.12)", fg: "#b45309", label: "Pending" };
}

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [filter, setFilter] = useState<"all" | SettlementStatus>("all");
  const [hydrated, setHydrated] = useState(false);
  const [openRoyalty, setOpenRoyalty] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettlements(JSON.parse(raw));
      } else {
        setSettlements(SAMPLE);
      }
    } catch {
      setSettlements(SAMPLE);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settlements));
    } catch {
      // ignore
    }
  }, [settlements, hydrated]);

  const visible = useMemo(() => {
    const sorted = [...settlements].sort(
      (a, b) => b.scheduledFor - a.scheduledFor
    );
    return filter === "all" ? sorted : sorted.filter((s) => s.status === filter);
  }, [settlements, filter]);

  const stats = useMemo(() => {
    const usd = (s: Settlement) => {
      if (s.currency === "USD") return s.amount;
      if (s.currency === "EUR") return s.amount * 1.08;
      if (s.currency === "KZT") return s.amount / 470;
      if (s.currency === "AEC") return s.amount * 0.5;
      return s.amount;
    };
    const pending = settlements
      .filter((s) => s.status !== "paid")
      .reduce((acc, s) => acc + usd(s), 0);
    const paid7d = settlements
      .filter(
        (s) =>
          s.status === "paid" &&
          s.paidAt &&
          Date.now() - s.paidAt < 7 * 24 * 60 * 60 * 1000
      )
      .reduce((acc, s) => acc + usd(s), 0);
    const totalPayments = settlements.reduce((acc, s) => acc + s.payments, 0);
    const next = settlements
      .filter((s) => s.status === "scheduled" || s.status === "pending")
      .sort((a, b) => a.scheduledFor - b.scheduledFor)[0];
    return { pending, paid7d, totalPayments, next };
  }, [settlements]);

  function payNow(id: string) {
    setSettlements((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "paid", paidAt: Date.now() } : s
      )
    );
  }

  function reseed() {
    if (
      !window.confirm(
        "Reset settlements demo data? Local changes will be lost."
      )
    )
      return;
    setSettlements(SAMPLE);
  }

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #064e3b 48%, #059669 100%)",
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
            Settlements
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
            Daily or on-demand settlement to bank or AEC wallet. Royalty
            auto-split executes via AEVION Bank — full audit trail with every
            payout.
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
              label="Pending USD"
              value={`$${stats.pending.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`}
              accent="#fcd34d"
            />
            <Stat
              label="Paid 7d USD"
              value={`$${stats.paid7d.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`}
              accent="#86efac"
            />
            <Stat
              label="Payments routed"
              value={stats.totalPayments.toString()}
              accent="#5eead4"
            />
            <Stat
              label="Next payout"
              value={stats.next ? relativeTime(stats.next.scheduledFor) : "—"}
              accent="#c4b5fd"
            />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 18,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setFilter("all")}
              style={filter === "all" ? chipActive("#0f172a") : chipBase}
            >
              All ({settlements.length})
            </button>
            {(["pending", "scheduled", "paid"] as SettlementStatus[]).map(
              (s) => {
                const meta = statusMeta(s);
                const count = settlements.filter((x) => x.status === s).length;
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

          <button
            onClick={reseed}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid rgba(15,23,42,0.2)",
              color: "#475569",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ↻ Reset demo data
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
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
              No settlements match this filter.
            </div>
          ) : (
            visible.map((s) => {
              const meta = statusMeta(s.status);
              const isOpen = openRoyalty === s.id;
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
                    gap: 12,
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: 6,
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
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: 6,
                            background:
                              s.target === "bank"
                                ? "rgba(13,148,136,0.1)"
                                : "rgba(124,58,237,0.1)",
                            color:
                              s.target === "bank" ? "#0f766e" : "#6d28d9",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {s.target === "bank" ? "🏦 AEVION Bank" : "💎 AEC Wallet"}
                        </span>
                        <span
                          style={{
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 11,
                            color: "#64748b",
                          }}
                        >
                          {s.reference}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#475569",
                          lineHeight: 1.55,
                        }}
                      >
                        {s.payments} payments ·{" "}
                        {s.status === "paid" && s.paidAt
                          ? `paid ${relativeTime(s.paidAt)}`
                          : `scheduled ${relativeTime(s.scheduledFor)}`}
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        fontWeight: 900,
                        fontSize: 24,
                        color: "#059669",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatCurrency(s.amount, s.currency)}
                    </div>
                  </header>

                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      borderRadius: 8,
                      overflow: "hidden",
                      height: 8,
                      background: "rgba(15,23,42,0.06)",
                    }}
                  >
                    {s.royalty.map((r, i) => {
                      const colors = ["#0d9488", "#7c3aed", "#f59e0b", "#64748b"];
                      return (
                        <div
                          key={r.party}
                          title={`${r.party}: ${(r.share * 100).toFixed(0)}%`}
                          style={{
                            background: colors[i % colors.length],
                            width: `${r.share * 100}%`,
                          }}
                        />
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenRoyalty(isOpen ? null : s.id)
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "transparent",
                        border: "1px solid rgba(15,23,42,0.15)",
                        color: "#475569",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {isOpen ? "Hide royalty split" : "Show royalty split"}
                    </button>
                    {s.status !== "paid" && (
                      <button
                        type="button"
                        onClick={() => payNow(s.id)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          background: "#059669",
                          border: "none",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                        }}
                      >
                        Pay now →
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(15,23,42,0.03)",
                        border: "1px solid rgba(15,23,42,0.06)",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Royalty auto-split — executes via AEVION Bank
                      </div>
                      {s.royalty.map((r, i) => {
                        const colors = ["#0d9488", "#7c3aed", "#f59e0b", "#64748b"];
                        const cut = Math.round(s.amount * r.share);
                        return (
                          <div
                            key={r.party}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: "#fff",
                              border: "1px solid rgba(15,23,42,0.06)",
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 3,
                                    background: colors[i % colors.length],
                                  }}
                                />
                                <span
                                  style={{
                                    fontWeight: 800,
                                    fontSize: 13,
                                    color: "#0f172a",
                                  }}
                                >
                                  {r.party}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "#64748b",
                                    fontWeight: 700,
                                  }}
                                >
                                  {(r.share * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#64748b",
                                  marginTop: 2,
                                  marginLeft: 18,
                                }}
                              >
                                {r.description}
                              </div>
                            </div>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 14,
                                color: "#059669",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatCurrency(cut, s.currency)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        <section
          style={{
            marginTop: 32,
            padding: 24,
            borderRadius: 18,
            background: "linear-gradient(135deg, #0f172a, #064e3b)",
            color: "#fff",
            display: "grid",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#86efac",
            }}
          >
            How settlement works
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Daily by default · on-demand when you need it
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {[
              {
                t: "Net & batch",
                d: "Captured payments are aggregated across the day. Refunds and chargebacks net automatically before payout.",
              },
              {
                t: "Currency convert",
                d: "Multi-currency payouts convert at quote time using mid-market rates with a transparent spread.",
              },
              {
                t: "Royalty split",
                d: "Bureau-registered IP shares are deducted automatically and routed to the right wallets via AEVION Bank.",
              },
              {
                t: "Payout",
                d: "Funds arrive in your bank or AEC wallet. Webhook settlement.paid fires with the full audit payload.",
              },
            ].map((b, i) => (
              <div
                key={b.t}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#5eead4",
                    marginBottom: 4,
                  }}
                >
                  STEP {i + 1}
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                  {b.t}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
                  {b.d}
                </div>
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
