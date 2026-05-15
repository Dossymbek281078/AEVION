"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type RuleId =
  | "velocity"
  | "bin_risk"
  | "country_mismatch"
  | "qsign_device"
  | "amount_threshold"
  | "ip_proxy";

type Rule = {
  id: RuleId;
  name: string;
  category: "velocity" | "device" | "geo" | "amount";
  description: string;
  defaultEnabled: boolean;
  defaultThreshold?: number;
  thresholdLabel?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  thresholdStep?: number;
};

const RULES: Rule[] = [
  {
    id: "velocity",
    name: "Card velocity",
    category: "velocity",
    description:
      "Block if same PAN attempts >N payments in 1 hour across all merchants on the rail.",
    defaultEnabled: true,
    defaultThreshold: 5,
    thresholdLabel: "attempts / hour",
    thresholdMin: 1,
    thresholdMax: 25,
    thresholdStep: 1,
  },
  {
    id: "bin_risk",
    name: "BIN risk score",
    category: "device",
    description:
      "Reject if issuer BIN risk score (0–100) is above threshold. Score is recomputed weekly from chargeback signals.",
    defaultEnabled: true,
    defaultThreshold: 70,
    thresholdLabel: "max score",
    thresholdMin: 0,
    thresholdMax: 100,
    thresholdStep: 5,
  },
  {
    id: "country_mismatch",
    name: "Country mismatch",
    category: "geo",
    description:
      "Flag if billing country ≠ IP geolocation ≠ card-issuing country (any 2-of-3 mismatch triggers).",
    defaultEnabled: true,
    defaultThreshold: 0,
  },
  {
    id: "qsign_device",
    name: "QSign device fingerprint",
    category: "device",
    description:
      "Require a QSign-stamped device handshake. Reject any payment without a recent device certificate (cross-platform anti-bot).",
    defaultEnabled: false,
    defaultThreshold: 0,
  },
  {
    id: "amount_threshold",
    name: "High-amount review",
    category: "amount",
    description:
      "Hold for manual review if a single payment exceeds the threshold (USD-normalized).",
    defaultEnabled: true,
    defaultThreshold: 5000,
    thresholdLabel: "USD",
    thresholdMin: 100,
    thresholdMax: 50000,
    thresholdStep: 100,
  },
  {
    id: "ip_proxy",
    name: "Proxy / VPN / Tor",
    category: "geo",
    description:
      "Block payments routed through known commercial VPN, datacenter ASN, or Tor exit nodes.",
    defaultEnabled: false,
    defaultThreshold: 0,
  },
];

type Verdict = "allow" | "review" | "block";

type FlaggedTransaction = {
  id: string;
  at: number;
  amount: number;
  currency: "USD" | "EUR" | "KZT" | "AEC";
  card: string;
  countries: { billing: string; ip: string; issuer: string };
  triggered: RuleId[];
  verdict: Verdict;
  riskScore: number;
};

const RULES_KEY = "aevion.payments.fraud.rules.v1";
const TXNS_KEY = "aevion.payments.fraud.txns.v1";

const SAMPLE_TXNS: FlaggedTransaction[] = [
  {
    id: "tx_99h2k1",
    at: Date.now() - 1000 * 60 * 12,
    amount: 8400,
    currency: "USD",
    card: "•••• 4242",
    countries: { billing: "US", ip: "RO", issuer: "US" },
    triggered: ["country_mismatch", "amount_threshold"],
    verdict: "review",
    riskScore: 64,
  },
  {
    id: "tx_q3m7p4",
    at: Date.now() - 1000 * 60 * 27,
    amount: 89,
    currency: "USD",
    card: "•••• 1881",
    countries: { billing: "NG", ip: "NG", issuer: "GB" },
    triggered: ["bin_risk", "country_mismatch"],
    verdict: "block",
    riskScore: 88,
  },
  {
    id: "tx_b8d3n6",
    at: Date.now() - 1000 * 60 * 41,
    amount: 320,
    currency: "EUR",
    card: "•••• 0119",
    countries: { billing: "DE", ip: "DE", issuer: "DE" },
    triggered: ["velocity"],
    verdict: "review",
    riskScore: 52,
  },
  {
    id: "tx_e2g5w8",
    at: Date.now() - 1000 * 60 * 60 * 2,
    amount: 12500,
    currency: "USD",
    card: "•••• 7732",
    countries: { billing: "AE", ip: "AE", issuer: "AE" },
    triggered: ["amount_threshold"],
    verdict: "review",
    riskScore: 41,
  },
  {
    id: "tx_z4t9c1",
    at: Date.now() - 1000 * 60 * 60 * 5,
    amount: 49,
    currency: "USD",
    card: "•••• 5544",
    countries: { billing: "US", ip: "US", issuer: "US" },
    triggered: ["ip_proxy"],
    verdict: "block",
    riskScore: 78,
  },
];

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

function verdictMeta(v: Verdict): { bg: string; fg: string; label: string } {
  if (v === "allow") return { bg: "rgba(5,150,105,0.12)", fg: "#047857", label: "Allowed" };
  if (v === "review") return { bg: "rgba(245,158,11,0.12)", fg: "#b45309", label: "Review" };
  return { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", label: "Blocked" };
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.round(diff / (1000 * 60));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function formatAmount(a: number, c: FlaggedTransaction["currency"]) {
  if (c === "AEC") return `${a.toLocaleString()} AEC`;
  if (c === "KZT") return `${a.toLocaleString("ru-RU")} ₸`;
  if (c === "EUR")
    return `€${a.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${a.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function FraudPage() {
  const [rules, setRules] = useState<Record<RuleId, { enabled: boolean; threshold: number }>>(
    () => {
      const init = {} as Record<RuleId, { enabled: boolean; threshold: number }>;
      for (const r of RULES) init[r.id] = { enabled: r.defaultEnabled, threshold: r.defaultThreshold ?? 0 };
      return init;
    }
  );
  const [txns, setTxns] = useState<FlaggedTransaction[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<"all" | Verdict>("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawR = window.localStorage.getItem(RULES_KEY);
      if (rawR) setRules((prev) => ({ ...prev, ...JSON.parse(rawR) }));
      const rawT = window.localStorage.getItem(TXNS_KEY);
      setTxns(rawT ? JSON.parse(rawT) : SAMPLE_TXNS);
    } catch {
      setTxns(SAMPLE_TXNS);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(RULES_KEY, JSON.stringify(rules));
    } catch {
      // ignore
    }
  }, [rules, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(TXNS_KEY, JSON.stringify(txns));
    } catch {
      // ignore
    }
  }, [txns, hydrated]);

  const stats = useMemo(() => {
    const blocked24h = txns.filter(
      (t) => t.verdict === "block" && Date.now() - t.at < 24 * 60 * 60 * 1000
    ).length;
    const review24h = txns.filter(
      (t) => t.verdict === "review" && Date.now() - t.at < 24 * 60 * 60 * 1000
    ).length;
    const enabled = Object.values(rules).filter((r) => r.enabled).length;
    const blockedAmount = txns
      .filter((t) => t.verdict === "block")
      .reduce((acc, t) => acc + (t.currency === "USD" ? t.amount : t.amount / 2), 0);
    return { blocked24h, review24h, enabled, blockedAmount };
  }, [txns, rules]);

  const visible = useMemo(() => {
    const sorted = [...txns].sort((a, b) => b.at - a.at);
    return filter === "all" ? sorted : sorted.filter((t) => t.verdict === filter);
  }, [txns, filter]);

  function toggleRule(id: RuleId) {
    setRules((prev) => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }));
  }
  function setThreshold(id: RuleId, v: number) {
    setRules((prev) => ({ ...prev, [id]: { ...prev[id], threshold: v } }));
  }
  function decide(id: string, v: Verdict) {
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, verdict: v } : t)));
  }

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #7f1d1d 48%, #dc2626 100%)",
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
            Fraud detection
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
            Six rule engines + QSign-stamped device fingerprint, blended into
            a single risk score. Reviewer queue with one-click allow / block
            decisions feeds back into the ML weights.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginTop: 22,
            }}
          >
            <Stat label="Blocked 24h" value={stats.blocked24h.toString()} accent="#fda4af" />
            <Stat label="Review 24h" value={stats.review24h.toString()} accent="#fcd34d" />
            <Stat label="Rules enabled" value={`${stats.enabled}/${RULES.length}`} accent="#5eead4" />
            <Stat
              label="Blocked $ saved"
              value={`$${stats.blockedAmount.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`}
              accent="#86efac"
            />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24, display: "grid", gap: 24 }}>
        <section>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#dc2626",
              marginBottom: 8,
            }}
          >
            Rule engine
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
            6 layers, blended risk score
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
            }}
          >
            {RULES.map((r) => {
              const state = rules[r.id];
              const isOn = state.enabled;
              return (
                <article
                  key={r.id}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    border: `1px solid ${isOn ? "rgba(220,38,38,0.25)" : "rgba(15,23,42,0.1)"}`,
                    background: "#fff",
                    boxShadow: isOn
                      ? "0 4px 14px rgba(220,38,38,0.08)"
                      : "0 2px 10px rgba(15,23,42,0.04)",
                    display: "grid",
                    gap: 10,
                    opacity: isOn ? 1 : 0.78,
                  }}
                >
                  <header
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>
                        {r.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#dc2626",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginTop: 2,
                        }}
                      >
                        {r.category}
                      </div>
                    </div>
                    <Toggle on={isOn} onClick={() => toggleRule(r.id)} />
                  </header>

                  <p
                    style={{
                      fontSize: 13,
                      color: "#475569",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {r.description}
                  </p>

                  {r.thresholdLabel && r.thresholdMin !== undefined && r.thresholdMax !== undefined && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: "#64748b",
                          marginBottom: 4,
                          fontWeight: 700,
                        }}
                      >
                        <span>{r.thresholdLabel}</span>
                        <span style={{ color: "#0f172a", fontWeight: 800 }}>
                          {state.threshold}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={r.thresholdMin}
                        max={r.thresholdMax}
                        step={r.thresholdStep ?? 1}
                        value={state.threshold}
                        onChange={(e) => setThreshold(r.id, Number(e.target.value))}
                        disabled={!isOn}
                        style={{
                          width: "100%",
                          accentColor: "#dc2626",
                        }}
                      />
                    </div>
                  )}

                  {r.id === "qsign_device" && isOn && (
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(13,148,136,0.06)",
                        border: "1px solid rgba(13,148,136,0.2)",
                        fontSize: 11,
                        color: "#0f766e",
                      }}
                    >
                      Powered by QSign. View handshake stamps in <Link
                        href="/qsign"
                        style={{ color: "#0d9488", fontWeight: 700, textDecoration: "underline" }}
                      >QSign module</Link>.
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 22,
                fontWeight: 900,
                margin: 0,
                letterSpacing: "-0.02em",
                color: "#0f172a",
              }}
            >
              Reviewer queue
            </h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => setFilter("all")}
                style={filter === "all" ? chipActive("#0f172a") : chipBase}
              >
                All ({txns.length})
              </button>
              {(["review", "block", "allow"] as Verdict[]).map((v) => {
                const meta = verdictMeta(v);
                const count = txns.filter((t) => t.verdict === v).length;
                return (
                  <button
                    key={v}
                    onClick={() => setFilter(v)}
                    style={filter === v ? chipActive(meta.fg) : chipBase}
                  >
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {visible.length === 0 ? (
              <div
                style={{
                  padding: "32px 24px",
                  borderRadius: 14,
                  border: "1px dashed rgba(15,23,42,0.2)",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 14,
                  background: "rgba(15,23,42,0.02)",
                }}
              >
                Queue is clear.
              </div>
            ) : (
              visible.map((t) => {
                const meta = verdictMeta(t.verdict);
                return (
                  <article
                    key={t.id}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: "1px solid rgba(15,23,42,0.1)",
                      background: "#fff",
                      boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 11,
                            color: "#64748b",
                          }}
                        >
                          {t.id}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{relTime(t.at)}</span>
                      </div>

                      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
                          {formatAmount(t.amount, t.currency)}
                        </span>
                        <span style={{ fontSize: 12, color: "#475569" }}>
                          {t.card} · billing {t.countries.billing} · IP {t.countries.ip} · issuer{" "}
                          {t.countries.issuer}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {t.triggered.map((rid) => {
                          const r = RULES.find((x) => x.id === rid);
                          return (
                            <span
                              key={rid}
                              style={{
                                padding: "2px 8px",
                                borderRadius: 5,
                                background: "rgba(220,38,38,0.08)",
                                border: "1px solid rgba(220,38,38,0.2)",
                                color: "#b91c1c",
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              {r?.name ?? rid}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 6,
                        textAlign: "right",
                        minWidth: 140,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 900,
                          color:
                            t.riskScore > 75
                              ? "#dc2626"
                              : t.riskScore > 50
                              ? "#f59e0b"
                              : "#059669",
                        }}
                      >
                        {t.riskScore}
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginLeft: 4 }}>
                          /100
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {t.verdict !== "allow" && (
                          <button onClick={() => decide(t.id, "allow")} style={miniBtn("#059669")}>Allow</button>
                        )}
                        {t.verdict !== "block" && (
                          <button onClick={() => decide(t.id, "block")} style={miniBtn("#dc2626")}>Block</button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        position: "relative",
        width: 42,
        height: 24,
        borderRadius: 999,
        background: on ? "#dc2626" : "rgba(15,23,42,0.18)",
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function miniBtn(color: string): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    background: color,
    color: "#fff",
    fontWeight: 700,
    fontSize: 11,
    border: "none",
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
