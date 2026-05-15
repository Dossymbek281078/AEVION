"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { listAccounts, listOperations } from "../_lib/api";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../_lib/currency";
import {
  fetchEcosystemEarnings,
  SOURCE_COLOR,
  SOURCE_LABEL_KEY,
  type EarningSource,
  type EcosystemEarningsSummary,
} from "../_lib/ecosystem";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL_KEY,
  summariseSpending,
  type SpendCategory,
  type SpendingPeriod,
} from "../_lib/spending";
import type { Account, Operation } from "../_lib/types";

const SOURCES: EarningSource[] = ["banking", "qright", "chess", "planet"];
const CATEGORIES: SpendCategory[] = ["subscriptions", "tips", "contacts", "untagged"];

const PERIODS: SpendingPeriod[] = ["thisMonth", "last30d"];
const PERIOD_LABEL_KEY: Record<SpendingPeriod, string> = {
  thisMonth: "spending.period.thisMonth.label",
  last30d: "spending.period.last30d.label",
};

const W = 760;
const H = 420;
const COL_W = 60;
const PADDING_Y = 30;
const GAP = 6;

type Node = {
  id: string;
  label: string;
  color: string;
  amount: number;
  side: "left" | "right";
  y: number;
  height: number;
};

type Flow = {
  from: Node;
  to: Node;
  amount: number;
  thickness: number;
  fromY: number;
  toY: number;
};

function layoutColumn(items: { id: string; amount: number; color: string; label: string }[], side: "left" | "right"): Node[] {
  const nonzero = items.filter((i) => i.amount > 0);
  const total = nonzero.reduce((s, i) => s + i.amount, 0);
  if (total <= 0) return [];
  const usable = H - 2 * PADDING_Y - GAP * (nonzero.length - 1);
  let y = PADDING_Y;
  return nonzero.map((i) => {
    const height = (i.amount / total) * usable;
    const node: Node = {
      ...i,
      side,
      y,
      height: Math.max(8, height),
    };
    y += node.height + GAP;
    return node;
  });
}

function curvePath(x1: number, y1: number, x2: number, y2: number, h1: number, h2: number): string {
  const cx1 = x1 + (x2 - x1) * 0.5;
  const cx2 = x1 + (x2 - x1) * 0.5;
  const top = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
  const bottomReturn = `L ${x2} ${y2 + h2} C ${cx2} ${y2 + h2}, ${cx1} ${y1 + h1}, ${x1} ${y1 + h1} Z`;
  return `${top} ${bottomReturn}`;
}

export default function FlowPage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [eco, setEco] = useState<EcosystemEarningsSummary | null>(null);
  const [period, setPeriod] = useState<SpendingPeriod>("last30d");

  useEffect(() => {
    setCode(loadCurrency());
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myAccount = accounts[0] ?? null;

  useEffect(() => {
    if (!myAccount) return;
    let cancelled = false;
    void fetchEcosystemEarnings({ accountId: myAccount.id, operations }).then((e) => {
      if (!cancelled) setEco(e);
    });
    return () => {
      cancelled = true;
    };
  }, [myAccount, operations]);

  const summary = useMemo(() => {
    if (!myAccount) return null;
    return summariseSpending(operations, myAccount.id, period);
  }, [operations, myAccount, period]);

  const sourceItems = useMemo(() => {
    if (!eco) return [];
    return SOURCES.map((s) => ({
      id: s,
      amount: period === "last30d" ? eco.perSource[s].last30d : eco.perSource[s].last30d, // last 30d for both — month is close enough
      color: SOURCE_COLOR[s],
      label: t(SOURCE_LABEL_KEY[s]),
    }));
  }, [eco, period, t]);

  const categoryItems = useMemo(() => {
    if (!summary) return [];
    return summary.byCategory.map((c) => ({
      id: c.category as string,
      amount: c.amount,
      color: CATEGORY_COLOR[c.category],
      label: t(CATEGORY_LABEL_KEY[c.category]),
    }));
  }, [summary, t]);

  const totalIn = sourceItems.reduce((s, i) => s + i.amount, 0);
  const totalOut = summary?.totalSpent ?? 0;
  const net = totalIn - totalOut;

  const leftNodes = useMemo(() => layoutColumn(sourceItems, "left"), [sourceItems]);
  const rightNodes = useMemo(() => layoutColumn(categoryItems, "right"), [categoryItems]);

  // Build proportional flows: each source sends to each category in proportion
  // to the category's share of total outflow. When totalOut === 0, no flows.
  const flows = useMemo<Flow[]>(() => {
    if (totalOut <= 0 || rightNodes.length === 0 || leftNodes.length === 0) return [];
    const result: Flow[] = [];
    for (const from of leftNodes) {
      // share of this source in total inflow
      const sourceShare = totalIn > 0 ? from.amount / totalIn : 0;
      let fromOffset = 0;
      for (const to of rightNodes) {
        const catShare = totalOut > 0 ? to.amount / totalOut : 0;
        // Flow is sourceShare × catShare × min(in, out) for visual scaling
        const visScale = Math.min(totalIn, totalOut);
        const flowAmount = sourceShare * catShare * visScale;
        if (flowAmount <= 0) continue;
        const ribbonHeight = (flowAmount / from.amount) * from.height;
        const targetHeight = (flowAmount / to.amount) * to.height;
        let toOffset = 0;
        // Compute toOffset by summing previous from→to ribbons
        for (const prev of leftNodes) {
          if (prev.id === from.id) break;
          const prevSourceShare = totalIn > 0 ? prev.amount / totalIn : 0;
          const prevFlow = prevSourceShare * catShare * visScale;
          if (prevFlow > 0) toOffset += (prevFlow / to.amount) * to.height;
        }
        result.push({
          from,
          to,
          amount: flowAmount,
          thickness: ribbonHeight,
          fromY: from.y + fromOffset,
          toY: to.y + toOffset,
        });
        fromOffset += ribbonHeight;
      }
    }
    return result;
  }, [leftNodes, rightNodes, totalIn, totalOut]);

  const fmt = (n: number) => formatCurrency(n, code);
  const hasData = totalIn > 0 || totalOut > 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(13,148,136,0.18), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#5eead4",
              textTransform: "uppercase",
            }}
          >
            {t("flowPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("flowPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 660 }}>
            {t("flowPage.lede")}
          </div>
        </header>

        {/* Period switch */}
        <div role="tablist" aria-label={t("flowPage.periodAria")} style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {PERIODS.map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: active ? "linear-gradient(135deg, #0d9488, #0ea5e9)" : "rgba(15,23,42,0.55)",
                  color: active ? "#fff" : "#cbd5e1",
                  border: active ? "1px solid rgba(94,234,212,0.40)" : "1px solid rgba(255,255,255,0.10)",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {t(PERIOD_LABEL_KEY[p])}
              </button>
            );
          })}
        </div>

        {/* Top stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Stat label={t("flowPage.stat.in")} value={fmt(totalIn)} accent="#5eead4" />
          <Stat label={t("flowPage.stat.out")} value={`−${fmt(totalOut)}`} accent="#f472b6" />
          <Stat
            label={t("flowPage.stat.net")}
            value={`${net >= 0 ? "+" : "−"}${fmt(Math.abs(net))}`}
            accent={net >= 0 ? "#fbbf24" : "#dc2626"}
          />
        </div>

        {/* Sankey */}
        {hasData ? (
          <section
            style={{
              padding: 20,
              borderRadius: 18,
              background: "rgba(15,23,42,0.55)",
              border: "1px solid rgba(94,234,212,0.18)",
              marginBottom: 24,
              overflowX: "auto",
            }}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              style={{ display: "block", maxWidth: "100%" }}
              role="img"
              aria-label={t("flowPage.sankey.aria")}
            >
              {/* Flows under nodes */}
              <g opacity={0.55}>
                {flows.map((f, i) => {
                  const x1 = COL_W;
                  const x2 = W - COL_W;
                  const path = curvePath(x1, f.fromY, x2, f.toY, f.thickness, (f.amount / f.to.amount) * f.to.height);
                  return (
                    <path
                      key={`${f.from.id}-${f.to.id}-${i}`}
                      d={path}
                      fill={f.from.color}
                      opacity={0.45}
                    >
                      <title>
                        {f.from.label} → {f.to.label} · {fmt(f.amount)}
                      </title>
                    </path>
                  );
                })}
              </g>
              {/* Left nodes */}
              {leftNodes.map((n) => (
                <g key={n.id}>
                  <rect
                    x={0}
                    y={n.y}
                    width={COL_W}
                    height={n.height}
                    fill={n.color}
                    rx={4}
                  />
                  <text
                    x={COL_W + 8}
                    y={n.y + n.height / 2}
                    fill="#fff"
                    fontSize={11}
                    fontWeight={800}
                    dominantBaseline="middle"
                  >
                    {n.label}
                  </text>
                  <text
                    x={COL_W + 8}
                    y={n.y + n.height / 2 + 14}
                    fill="rgba(255,255,255,0.55)"
                    fontSize={10}
                    fontWeight={700}
                    dominantBaseline="middle"
                  >
                    {fmt(n.amount)}
                  </text>
                </g>
              ))}
              {/* Right nodes */}
              {rightNodes.map((n) => (
                <g key={n.id}>
                  <rect
                    x={W - COL_W}
                    y={n.y}
                    width={COL_W}
                    height={n.height}
                    fill={n.color}
                    rx={4}
                  />
                  <text
                    x={W - COL_W - 8}
                    y={n.y + n.height / 2}
                    fill="#fff"
                    fontSize={11}
                    fontWeight={800}
                    dominantBaseline="middle"
                    textAnchor="end"
                  >
                    {n.label}
                  </text>
                  <text
                    x={W - COL_W - 8}
                    y={n.y + n.height / 2 + 14}
                    fill="rgba(255,255,255,0.55)"
                    fontSize={10}
                    fontWeight={700}
                    dominantBaseline="middle"
                    textAnchor="end"
                  >
                    {fmt(n.amount)}
                  </text>
                </g>
              ))}
              {/* Column captions */}
              <text x={0} y={16} fill="#5eead4" fontSize={10} fontWeight={800} letterSpacing={2}>
                {t("flowPage.col.in").toUpperCase()}
              </text>
              <text
                x={W}
                y={16}
                fill="#f472b6"
                fontSize={10}
                fontWeight={800}
                letterSpacing={2}
                textAnchor="end"
              >
                {t("flowPage.col.out").toUpperCase()}
              </text>
            </svg>
          </section>
        ) : (
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: "rgba(15,23,42,0.55)",
              border: "1px dashed rgba(94,234,212,0.30)",
              textAlign: "center",
              color: "#cbd5e1",
              marginBottom: 24,
            }}
          >
            <div aria-hidden style={{ fontSize: 42, color: "#5eead4", marginBottom: 10, lineHeight: 1 }}>
              ⤳
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              {t("flowPage.empty.title")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
              {t("flowPage.empty.body")}
            </div>
          </div>
        )}

        {/* Methodology */}
        <section
          style={{
            padding: 18,
            borderRadius: 12,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#5eead4", textTransform: "uppercase", marginBottom: 8 }}>
            {t("flowPage.method.kicker")}
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 }}>
            {t("flowPage.method.body")}
          </div>
        </section>

        {/* CTA */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(99,102,241,0.10))",
            border: "1px solid rgba(94,234,212,0.30)",
            marginTop: 4,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#5eead4", textTransform: "uppercase" }}>
            {t("flowPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("flowPage.cta.title")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank/insights" style={ctaPrimary}>
              {t("flowPage.cta.insights")} →
            </Link>
            <Link href="/bank/savings" style={ctaSecondary}>
              {t("flowPage.cta.savings")} →
            </Link>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <InstallBanner />
        </div>
        <div style={{ marginTop: 16 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, textTransform: "uppercase", color: accent }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 4 }}>{value}</div>
    </div>
  );
}

const ctaPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};

const ctaSecondary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};
