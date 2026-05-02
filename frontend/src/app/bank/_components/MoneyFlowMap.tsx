"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  SOURCE_COLOR,
  SOURCE_LABEL_KEY,
  type EarningSource,
} from "../_lib/ecosystem";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL_KEY,
  categorise,
  type SpendCategory,
} from "../_lib/spending";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";
import { SkeletonBlock } from "./Skeleton";

type Period = "30d" | "90d" | "365d";

const PERIOD_DAYS: Record<Period, number> = { "30d": 30, "90d": 90, "365d": 365 };
const PERIOD_KEY: Record<Period, string> = {
  "30d": "te.period.30d",
  "90d": "te.period.90d",
  "365d": "te.period.365d",
};

const SOURCE_ICON: Record<EarningSource, string> = {
  banking: "₳",
  qright: "♪",
  chess: "♞",
  planet: "◉",
};

const CATEGORY_ICON: Record<SpendCategory, string> = {
  subscriptions: "↻",
  tips: "✦",
  contacts: "♥",
  untagged: "→",
};

const SOURCES: EarningSource[] = ["banking", "qright", "chess", "planet"];
const CATEGORIES: SpendCategory[] = ["subscriptions", "tips", "contacts", "untagged"];

type FlowNode = {
  id: string;
  label: string;
  color: string;
  amount: number;
  side: "in" | "out";
  icon: string;
};

type Layout = {
  node: FlowNode;
  y: number;
  h: number;
  cy: number;
  hubY1: number;
  hubY2: number;
};

export function MoneyFlowMap({
  accountId,
  operations,
}: {
  accountId: string;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const { ecosystem } = useEcosystemData();
  const [period, setPeriod] = useState<Period>("30d");
  const [hovered, setHovered] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!ecosystem) return null;
    const days = PERIOD_DAYS[period];
    const slice = ecosystem.daily.slice(-days);

    const inNodes: FlowNode[] = SOURCES.map((src) => ({
      id: `in-${src}`,
      label: t(SOURCE_LABEL_KEY[src]),
      color: SOURCE_COLOR[src],
      amount: slice.reduce((s, d) => s + d[src], 0),
      side: "in" as const,
      icon: SOURCE_ICON[src],
    })).filter((n) => n.amount > 0);

    const cutoff = Date.now() - days * 86_400_000;
    const byCat: Record<SpendCategory, number> = {
      subscriptions: 0,
      tips: 0,
      contacts: 0,
      untagged: 0,
    };
    for (const op of operations) {
      const ts = new Date(op.createdAt).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const cat = categorise(op, accountId);
      if (!cat) continue;
      byCat[cat] += op.amount;
    }
    const outNodes: FlowNode[] = CATEGORIES.filter((c) => byCat[c] > 0).map((c) => ({
      id: `out-${c}`,
      label: t(CATEGORY_LABEL_KEY[c]),
      color: CATEGORY_COLOR[c],
      amount: byCat[c],
      side: "out" as const,
      icon: CATEGORY_ICON[c],
    }));

    const totalIn = inNodes.reduce((s, n) => s + n.amount, 0);
    const totalOut = outNodes.reduce((s, n) => s + n.amount, 0);
    return { inNodes, outNodes, totalIn, totalOut, net: totalIn - totalOut };
  }, [ecosystem, operations, accountId, period, t]);

  const layout = useMemo(() => {
    if (!data) return null;
    const vbW = 800;
    const vbH = 360;
    const padY = 16;
    const innerH = vbH - padY * 2;
    const xL2 = 360;
    const xH1 = 360;
    const xH2 = 440;
    const xR1 = 440;
    const maxTotal = Math.max(data.totalIn, data.totalOut, 1);
    const hubH = innerH * (Math.max(data.totalIn, data.totalOut) / maxTotal);
    const hubY = padY + (innerH - hubH) / 2;

    const layoutSide = (nodes: FlowNode[], total: number, side: "in" | "out"): Layout[] => {
      if (nodes.length === 0 || total <= 0) return [];
      const gaps = (nodes.length - 1) * 6;
      const usable = innerH - gaps;
      const sideScale = total / maxTotal;
      const stackH = usable * sideScale;
      let y = padY + (innerH - (stackH + gaps)) / 2;
      let hubCum = 0;
      const out: Layout[] = [];
      for (const n of nodes) {
        const h = (n.amount / total) * stackH;
        const cy = y + h / 2;
        const hubShare = (n.amount / total) * hubH;
        const hubY1 = hubY + hubCum;
        const hubY2 = hubY1 + hubShare;
        out.push({ node: n, y, h, cy, hubY1, hubY2 });
        y += h + 6;
        hubCum += hubShare;
      }
      return out;
    };

    return {
      vbW,
      vbH,
      xL2,
      xH1,
      xH2,
      xR1,
      hubY,
      hubH,
      left: layoutSide(data.inNodes, data.totalIn, "in"),
      right: layoutSide(data.outNodes, data.totalOut, "out"),
    };
  }, [data]);

  if (!ecosystem) {
    return (
      <section style={containerStyle}>
        <div style={titleRowStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{t("moneyFlow.title")}</div>
        </div>
        <SkeletonBlock label={t("moneyFlow.title")} minHeight={300} />
      </section>
    );
  }

  if (!data || !layout || (data.inNodes.length === 0 && data.outNodes.length === 0)) {
    return (
      <section style={containerStyle}>
        <div style={titleRowStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{t("moneyFlow.title")}</div>
        </div>
        <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
          {t("moneyFlow.empty")}
        </div>
      </section>
    );
  }

  const periods: Period[] = ["30d", "90d", "365d"];

  const ribbonPath = (
    x1: number,
    y1Top: number,
    y1Bot: number,
    x2: number,
    y2Top: number,
    y2Bot: number,
  ): string => {
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1Top} C ${cx} ${y1Top}, ${cx} ${y2Top}, ${x2} ${y2Top} L ${x2} ${y2Bot} C ${cx} ${y2Bot}, ${cx} ${y1Bot}, ${x1} ${y1Bot} Z`;
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("moneyFlow.title")}</div>
            <InfoTooltip text={t("moneyFlow.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("moneyFlow.subtitle")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                background: period === p ? "#0f172a" : "transparent",
                color: period === p ? "#fff" : "#475569",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t(PERIOD_KEY[p])}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat label={t("moneyFlow.in")} value={formatCurrency(data.totalIn, code)} accent="#0d9488" />
        <Stat label={t("moneyFlow.out")} value={formatCurrency(data.totalOut, code)} accent="#dc2626" />
        <Stat
          label={t("moneyFlow.net")}
          value={`${data.net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(data.net), code)}`}
          accent={data.net >= 0 ? "#059669" : "#dc2626"}
        />
      </div>

      <div style={{ position: "relative", overflow: "hidden", borderRadius: 12 }}>
        <svg
          viewBox={`0 0 ${layout.vbW} ${layout.vbH}`}
          width="100%"
          style={{ display: "block", maxHeight: 420 }}
          role="img"
          aria-label={t("moneyFlow.title")}
        >
          <defs>
            {[...layout.left, ...layout.right].map((nl) => (
              <linearGradient
                key={`grad-${nl.node.id}`}
                id={`mfm-grad-${nl.node.id}`}
                x1="0"
                x2="1"
                y1="0"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor={nl.node.color}
                  stopOpacity={nl.node.side === "in" ? 0.55 : 0.3}
                />
                <stop
                  offset="100%"
                  stopColor={nl.node.color}
                  stopOpacity={nl.node.side === "in" ? 0.3 : 0.55}
                />
              </linearGradient>
            ))}
          </defs>

          {/* Hub */}
          <rect
            x={layout.xH1}
            y={layout.hubY}
            width={layout.xH2 - layout.xH1}
            height={Math.max(2, layout.hubH)}
            rx={6}
            fill="#0f172a"
            opacity={0.92}
          />
          <text
            x={(layout.xH1 + layout.xH2) / 2}
            y={layout.hubY - 6}
            textAnchor="middle"
            fontSize={11}
            fontWeight={800}
            fill="#0f172a"
          >
            {t("moneyFlow.hubLabel")}
          </text>

          {/* Left flows (sources → hub) */}
          {layout.left.map((nl) => {
            const dim =
              hovered != null && hovered !== nl.node.id ? 0.25 : 1;
            return (
              <path
                key={`lflow-${nl.node.id}`}
                d={ribbonPath(layout.xL2, nl.y, nl.y + nl.h, layout.xH1, nl.hubY1, nl.hubY2)}
                fill={`url(#mfm-grad-${nl.node.id})`}
                opacity={dim}
                style={{ transition: "opacity 180ms ease" }}
                onMouseEnter={() => setHovered(nl.node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`${nl.node.label}: ${formatCurrency(nl.node.amount, code)}`}</title>
              </path>
            );
          })}

          {/* Right flows (hub → destinations) */}
          {layout.right.map((nl) => {
            const dim =
              hovered != null && hovered !== nl.node.id ? 0.25 : 1;
            return (
              <path
                key={`rflow-${nl.node.id}`}
                d={ribbonPath(layout.xH2, nl.hubY1, nl.hubY2, layout.xR1, nl.y, nl.y + nl.h)}
                fill={`url(#mfm-grad-${nl.node.id})`}
                opacity={dim}
                style={{ transition: "opacity 180ms ease" }}
                onMouseEnter={() => setHovered(nl.node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`${nl.node.label}: ${formatCurrency(nl.node.amount, code)}`}</title>
              </path>
            );
          })}

          {/* Left node bars + labels */}
          {layout.left.map((nl) => (
            <g
              key={`lnode-${nl.node.id}`}
              onMouseEnter={() => setHovered(nl.node.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              <rect
                x={layout.xL2 - 8}
                y={nl.y}
                width={8}
                height={Math.max(2, nl.h)}
                fill={nl.node.color}
                rx={2}
              />
              <text
                x={layout.xL2 - 14}
                y={nl.cy + 4}
                textAnchor="end"
                fontSize={11}
                fontWeight={700}
                fill="#1e293b"
              >
                {nl.node.icon} {nl.node.label}
              </text>
              <text
                x={layout.xL2 - 14}
                y={nl.cy + 18}
                textAnchor="end"
                fontSize={10}
                fill="#64748b"
              >
                {formatCurrency(nl.node.amount, code)}
              </text>
            </g>
          ))}

          {/* Right node bars + labels */}
          {layout.right.map((nl) => (
            <g
              key={`rnode-${nl.node.id}`}
              onMouseEnter={() => setHovered(nl.node.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              <rect
                x={layout.xR1}
                y={nl.y}
                width={8}
                height={Math.max(2, nl.h)}
                fill={nl.node.color}
                rx={2}
              />
              <text
                x={layout.xR1 + 14}
                y={nl.cy + 4}
                fontSize={11}
                fontWeight={700}
                fill="#1e293b"
              >
                {nl.node.icon} {nl.node.label}
              </text>
              <text
                x={layout.xR1 + 14}
                y={nl.cy + 18}
                fontSize={10}
                fill="#64748b"
              >
                {formatCurrency(nl.node.amount, code)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginTop: 12,
          fontSize: 11,
          color: "#64748b",
          justifyContent: "space-between",
        }}
      >
        <span>← {t("moneyFlow.legendIn")}</span>
        <span>{t("moneyFlow.legendOut")} →</span>
      </div>
    </section>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(13,148,136,0.03) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${accent}33`,
        background: `${accent}0d`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: accent,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#1e293b", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
