"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Currency = "USD" | "EUR" | "KZT" | "AEC";

type PaymentLink = {
  id: string;
  amount: number;
  currency: Currency;
  title: string;
  status: "active" | "paid" | "expired";
  createdAt: number;
};

type Subscription = {
  id: string;
  amount: number;
  currency: Currency;
  interval: "weekly" | "monthly" | "quarterly" | "yearly";
  status: "trialing" | "active" | "past_due" | "paused" | "canceled";
};

type Settlement = {
  id: string;
  amount: number;
  currency: Currency;
  status: "pending" | "scheduled" | "paid";
  scheduledFor: number;
  paidAt: number | null;
  reference: string;
};

type WebhookEndpoint = { id: string; url: string; enabled: boolean };

type DeliveryAttempt = {
  id: string;
  endpointId: string;
  event: string;
  status: "pending" | "delivered" | "failed";
  at: number;
};

type FlaggedTxn = {
  id: string;
  at: number;
  amount: number;
  currency: Currency;
  verdict: "allow" | "review" | "block";
  riskScore: number;
};

type ApiKey = { id: string; name: string; livemode: boolean; createdAt: number };

const KEYS = {
  links: "aevion.payments.links.v1",
  subs: "aevion.payments.subscriptions.v1",
  settlements: "aevion.payments.settlements.v1",
  webhookEndpoints: "aevion.payments.webhooks.endpoints.v1",
  webhookDeliveries: "aevion.payments.webhooks.deliveries.v1",
  fraudTxns: "aevion.payments.fraud.txns.v1",
  apiKeys: "aevion.payments.api.keys.v1",
  methods: "aevion.payments.methods.v1",
};

const INTERVAL_DAYS = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };

function toUsd(amount: number, currency: Currency): number {
  if (currency === "USD") return amount;
  if (currency === "EUR") return amount * 1.08;
  if (currency === "KZT") return amount / 470;
  if (currency === "AEC") return amount * 0.5;
  return amount;
}

function relTime(ts: number) {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const m = Math.round(abs / 60000);
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return future ? `in ${h}h` : `${h}h ago`;
  const d = Math.round(h / 24);
  return future ? `in ${d}d` : `${d}d ago`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type ActivityItem = {
  id: string;
  at: number;
  icon: string;
  title: string;
  detail: string;
  href: string;
  accent: string;
};

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryAttempt[]>([]);
  const [flagged, setFlagged] = useState<FlaggedTxn[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [methodsState, setMethodsState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLinks(readJson<PaymentLink[]>(KEYS.links, []));
    setSubs(readJson<Subscription[]>(KEYS.subs, []));
    setSettlements(readJson<Settlement[]>(KEYS.settlements, []));
    setEndpoints(readJson<WebhookEndpoint[]>(KEYS.webhookEndpoints, []));
    setDeliveries(readJson<DeliveryAttempt[]>(KEYS.webhookDeliveries, []));
    setFlagged(readJson<FlaggedTxn[]>(KEYS.fraudTxns, []));
    setApiKeys(readJson<ApiKey[]>(KEYS.apiKeys, []));
    setMethodsState(readJson<Record<string, boolean>>(KEYS.methods, {}));
    setHydrated(true);
  }, []);

  const stats = useMemo(() => {
    const subMrr = subs
      .filter((s) => s.status === "active" || s.status === "trialing")
      .reduce((acc, s) => {
        const periodsPerYear = 365 / INTERVAL_DAYS[s.interval];
        return acc + (toUsd(s.amount, s.currency) * periodsPerYear) / 12;
      }, 0);

    const linksActive = links.filter((l) => l.status === "active").length;
    const linksOpenVolume = links
      .filter((l) => l.status === "active")
      .reduce((acc, l) => acc + toUsd(l.amount, l.currency), 0);

    const settlePending = settlements
      .filter((s) => s.status !== "paid")
      .reduce((acc, s) => acc + toUsd(s.amount, s.currency), 0);
    const settlePaid7d = settlements
      .filter(
        (s) =>
          s.status === "paid" &&
          s.paidAt &&
          Date.now() - s.paidAt < 7 * 24 * 60 * 60 * 1000
      )
      .reduce((acc, s) => acc + toUsd(s.amount, s.currency), 0);

    const webhookDelivered24h = deliveries.filter(
      (d) =>
        d.status === "delivered" && Date.now() - d.at < 24 * 60 * 60 * 1000
    ).length;
    const webhookFailed24h = deliveries.filter(
      (d) => d.status === "failed" && Date.now() - d.at < 24 * 60 * 60 * 1000
    ).length;

    const fraudReview = flagged.filter((t) => t.verdict === "review").length;
    const fraudBlocked24h = flagged.filter(
      (t) => t.verdict === "block" && Date.now() - t.at < 24 * 60 * 60 * 1000
    ).length;

    const subsActive = subs.filter(
      (s) => s.status === "active" || s.status === "trialing"
    ).length;
    const subsPastDue = subs.filter((s) => s.status === "past_due").length;

    const methodsOn = Object.values(methodsState).filter(Boolean).length;

    return {
      subMrr,
      subsActive,
      subsPastDue,
      linksActive,
      linksOpenVolume,
      settlePending,
      settlePaid7d,
      webhookDelivered24h,
      webhookFailed24h,
      webhookEndpointsActive: endpoints.filter((e) => e.enabled).length,
      fraudReview,
      fraudBlocked24h,
      apiKeys: apiKeys.length,
      methodsOn,
    };
  }, [links, subs, settlements, endpoints, deliveries, flagged, apiKeys, methodsState]);

  const sparks = useMemo(() => {
    const buckets = 12;
    const bucketMs = 2 * 60 * 60 * 1000; // 2h per bucket → 24h window
    const now = Date.now();
    const windowStart = now - buckets * bucketMs;

    function bucketize<T>(items: T[], at: (t: T) => number, weight: (t: T) => number): number[] {
      const out = new Array(buckets).fill(0);
      for (const it of items) {
        const t = at(it);
        if (t < windowStart || t > now) continue;
        const idx = Math.min(buckets - 1, Math.floor((t - windowStart) / bucketMs));
        out[idx] += weight(it);
      }
      return out;
    }

    return {
      links: bucketize(links, (l) => l.createdAt, () => 1),
      settlements: bucketize(
        settlements.filter((s) => s.status === "paid"),
        (s) => s.paidAt ?? 0,
        (s) => toUsd(s.amount, s.currency)
      ),
      webhooksOk: bucketize(
        deliveries.filter((d) => d.status === "delivered"),
        (d) => d.at,
        () => 1
      ),
      webhooksFail: bucketize(
        deliveries.filter((d) => d.status === "failed"),
        (d) => d.at,
        () => 1
      ),
      fraud: bucketize(flagged, (t) => t.at, () => 1),
    };
  }, [links, settlements, deliveries, flagged]);

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const l of links.slice(0, 12)) {
      items.push({
        id: `link_${l.id}`,
        at: l.createdAt,
        icon: "🔗",
        title: l.status === "paid" ? "Payment captured" : "Link created",
        detail: `${l.title} · ${l.amount} ${l.currency}`,
        href: "/payments/links",
        accent: l.status === "paid" ? "#059669" : "#0d9488",
      });
    }
    for (const d of deliveries.slice(0, 12)) {
      items.push({
        id: `wh_${d.id}`,
        at: d.at,
        icon: d.status === "delivered" ? "⚡" : d.status === "failed" ? "✗" : "…",
        title: `Webhook ${d.status}`,
        detail: d.event,
        href: "/payments/webhooks",
        accent:
          d.status === "delivered" ? "#059669" : d.status === "failed" ? "#dc2626" : "#f59e0b",
      });
    }
    for (const t of flagged.slice(0, 8)) {
      items.push({
        id: `fr_${t.id}`,
        at: t.at,
        icon: t.verdict === "block" ? "🛡️" : t.verdict === "review" ? "⚠" : "✓",
        title: `Fraud · ${t.verdict}`,
        detail: `risk ${t.riskScore}/100 · ${t.amount} ${t.currency}`,
        href: "/payments/fraud",
        accent: t.verdict === "block" ? "#dc2626" : t.verdict === "review" ? "#f59e0b" : "#059669",
      });
    }
    for (const s of settlements.slice(0, 8)) {
      items.push({
        id: `st_${s.id}`,
        at: s.paidAt ?? s.scheduledFor,
        icon: "🏦",
        title: s.status === "paid" ? "Settlement paid" : "Settlement scheduled",
        detail: `${s.reference} · ${s.amount} ${s.currency}`,
        href: "/payments/settlements",
        accent: s.status === "paid" ? "#059669" : "#2563eb",
      });
    }
    return items.sort((a, b) => b.at - a.at).slice(0, 16);
  }, [links, deliveries, flagged, settlements]);

  const isEmpty =
    hydrated &&
    links.length === 0 &&
    subs.length === 0 &&
    deliveries.length === 0 &&
    flagged.length === 0;

  return (
    <main style={{ padding: 0 }}>
      <section
        style={{
          background:
            "linear-gradient(145deg, #0f172a 0%, #134e4a 48%, #0d9488 100%)",
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
            Dashboard
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
            Live overview across all 8 surfaces: MRR, links, settlements,
            webhooks, fraud, compliance, methods, and API. Reads from the same
            local stores each surface writes to.
          </p>
        </div>
      </section>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gap: 20,
        }}
      >
        {isEmpty && (
          <div
            style={{
              padding: "20px 22px",
              borderRadius: 16,
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.25)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 800, color: "#92400e", fontSize: 14 }}>
              No data yet
            </div>
            <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.55 }}>
              Create a link, fire a test webhook, or visit the Settlements
              page to seed demo data — this dashboard reflects the same
              localStorage your other surfaces write to.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <Link href="/payments/links" style={emptyBtn("#0d9488")}>
                Create a link →
              </Link>
              <Link href="/payments/webhooks" style={emptyBtn("#7c3aed")}>
                Test a webhook →
              </Link>
              <Link href="/payments/settlements" style={emptyBtn("#059669")}>
                Seed settlements →
              </Link>
            </div>
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <KpiCard
            href="/payments/subscriptions"
            label="MRR (USD)"
            value={`$${stats.subMrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            sub={`${stats.subsActive} active${stats.subsPastDue > 0 ? ` · ${stats.subsPastDue} past due` : ""}`}
            accent="#0ea5e9"
          />
          <KpiCard
            href="/payments/settlements"
            label="Pending settlements"
            value={`$${stats.settlePending.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            sub={`Paid 7d: $${stats.settlePaid7d.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            accent="#059669"
            spark={sparks.settlements}
          />
          <KpiCard
            href="/payments/links"
            label="Active links"
            value={stats.linksActive.toString()}
            sub={`Open volume $${stats.linksOpenVolume.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            accent="#0d9488"
            spark={sparks.links}
          />
          <KpiCard
            href="/payments/webhooks"
            label="Webhooks 24h"
            value={`${stats.webhookDelivered24h} ✓ / ${stats.webhookFailed24h} ✗`}
            sub={`${stats.webhookEndpointsActive} live endpoint${stats.webhookEndpointsActive === 1 ? "" : "s"}`}
            accent={stats.webhookFailed24h > 0 ? "#dc2626" : "#7c3aed"}
            spark={sparks.webhooksOk}
            sparkSecondary={sparks.webhooksFail}
          />
          <KpiCard
            href="/payments/fraud"
            label="Fraud queue"
            value={stats.fraudReview.toString()}
            sub={`${stats.fraudBlocked24h} blocked 24h`}
            accent={stats.fraudReview > 0 ? "#f59e0b" : "#dc2626"}
            spark={sparks.fraud}
          />
          <KpiCard
            href="/payments/methods"
            label="Methods enabled"
            value={`${stats.methodsOn}/12`}
            sub="Across cards · wallets · bank · crypto · AEVION"
            accent="#2563eb"
          />
          <KpiCard
            href="/payments/compliance"
            label="Compliance"
            value="OK"
            sub="5 sanctions lists synced · 7 jurisdictions tracked"
            accent="#4338ca"
          />
          <KpiCard
            href="/payments/api"
            label="API keys"
            value={stats.apiKeys.toString()}
            sub={
              stats.apiKeys === 0
                ? "Generate one to unlock SDK samples"
                : "Use in cURL / Node / Python snippets"
            }
            accent="#4f46e5"
          />
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <article
            style={{
              padding: 22,
              borderRadius: 16,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#fff",
              boxShadow: "0 2px 12px rgba(15,23,42,0.05)",
              display: "grid",
              gap: 12,
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#0d9488",
                  }}
                >
                  Recent activity
                </div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    margin: "4px 0 0",
                    letterSpacing: "-0.02em",
                    color: "#0f172a",
                  }}
                >
                  Cross-surface feed
                </h2>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {activity.length} event{activity.length === 1 ? "" : "s"}
              </div>
            </header>

            {activity.length === 0 ? (
              <div
                style={{
                  padding: "20px 16px",
                  borderRadius: 12,
                  border: "1px dashed rgba(15,23,42,0.18)",
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 13,
                  background: "rgba(15,23,42,0.02)",
                }}
              >
                Activity will appear here as you interact with each surface.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {activity.map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(15,23,42,0.02)",
                      border: "1px solid rgba(15,23,42,0.05)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: a.accent + "1a",
                        color: a.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {a.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.detail}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {relTime(a.at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article
            style={{
              padding: 22,
              borderRadius: 16,
              background: "linear-gradient(135deg, #0f172a, #1e293b)",
              color: "#fff",
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5eead4",
              }}
            >
              All surfaces
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
              Quick navigation
            </h2>
            <div style={{ display: "grid", gap: 6 }}>
              {[
                { href: "/payments/links", label: "Payment Links", emoji: "🔗" },
                { href: "/payments/methods", label: "Payment Methods", emoji: "💳" },
                { href: "/payments/webhooks", label: "Webhooks", emoji: "⚡" },
                { href: "/payments/settlements", label: "Settlements", emoji: "🏦" },
                { href: "/payments/subscriptions", label: "Subscriptions", emoji: "🔁" },
                { href: "/payments/fraud", label: "Fraud detection", emoji: "🛡️" },
                { href: "/payments/compliance", label: "Compliance", emoji: "📋" },
                { href: "/payments/api", label: "Developer API", emoji: "⚙️" },
                { href: "/payments/status", label: "Status", emoji: "🟢" },
              ].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{n.emoji}</span>
                  {n.label}
                  <span style={{ marginLeft: "auto", color: "#94a3b8" }}>→</span>
                </Link>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  href,
  label,
  value,
  sub,
  accent,
  spark,
  sparkSecondary,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  accent: string;
  spark?: number[];
  sparkSecondary?: number[];
}) {
  return (
    <Link
      href={href}
      style={{
        padding: 16,
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.1)",
        background: "#fff",
        boxShadow: "0 2px 10px rgba(15,23,42,0.04)",
        textDecoration: "none",
        color: "inherit",
        display: "grid",
        gap: 6,
        transition: "transform 0.12s, box-shadow 0.12s",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {spark && (
        <Sparkline data={spark} secondary={sparkSecondary} accent={accent} />
      )}
      <div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div>
    </Link>
  );
}

function Sparkline({
  data,
  secondary,
  accent,
}: {
  data: number[];
  secondary?: number[];
  accent: string;
}) {
  const w = 200;
  const h = 32;
  const pad = 2;
  const all = secondary ? [...data, ...secondary] : data;
  const max = Math.max(1, ...all);
  function pathFor(arr: number[]) {
    if (arr.length === 0) return "";
    const stepX = (w - pad * 2) / Math.max(1, arr.length - 1);
    return arr
      .map((v, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (v / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }
  const fillFor = (arr: number[]) => {
    const p = pathFor(arr);
    if (!p) return "";
    const stepX = (w - pad * 2) / Math.max(1, arr.length - 1);
    const lastX = pad + (arr.length - 1) * stepX;
    return `${p} L ${lastX.toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z`;
  };
  const total = data.reduce((acc, v) => acc + v, 0);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{
        width: "100%",
        height: 32,
        display: "block",
        opacity: total === 0 ? 0.35 : 1,
      }}
      aria-hidden="true"
    >
      {secondary && (
        <>
          <path d={fillFor(secondary)} fill={"#dc2626"} fillOpacity={0.06} />
          <path d={pathFor(secondary)} fill="none" stroke="#dc2626" strokeWidth={1.5} />
        </>
      )}
      <path d={fillFor(data)} fill={accent} fillOpacity={0.12} />
      <path d={pathFor(data)} fill="none" stroke={accent} strokeWidth={1.6} />
    </svg>
  );
}

function emptyBtn(color: string): CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    background: color,
    color: "#fff",
    fontWeight: 700,
    fontSize: 12,
    textDecoration: "none",
  };
}
