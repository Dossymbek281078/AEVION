"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { describeOp } from "../_lib/format";
import {
  ANOMALY_COLOR,
  ANOMALY_LABEL_KEY,
  detectAnomalies,
  type Anomaly,
} from "../_lib/anomaly";
import type { Operation } from "../_lib/types";

type TimelineEntry = {
  op: Operation;
  anomalies: Anomaly[];
};

type DayGroup = {
  key: string;
  label: string;
  entries: TimelineEntry[];
  flagged: number;
};

function dayLabel(d: Date, t: (k: string, vars?: Record<string, string | number>) => string): string {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const dKey = d.toISOString().slice(0, 10);
  if (dKey === todayKey) return t("activity.day.today");
  if (dKey === yKey) return t("activity.day.yesterday");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function groupByDay(entries: TimelineEntry[], t: (k: string, vars?: Record<string, string | number>) => string): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const e of entries) {
    const d = new Date(e.op.createdAt);
    const key = d.toISOString().slice(0, 10);
    let g = map.get(key);
    if (!g) {
      g = { key, label: dayLabel(d, t), entries: [], flagged: 0 };
      map.set(key, g);
    }
    g.entries.push(e);
    if (e.anomalies.length > 0) g.flagged++;
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const KIND_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  topup: { icon: "+", color: "#065f46", bg: "rgba(16,185,129,0.16)" },
  transferIn: { icon: "↓", color: "#1e40af", bg: "rgba(59,130,246,0.16)" },
  transferOut: { icon: "↑", color: "#475569", bg: "rgba(15,23,42,0.08)" },
};

export function ActivityTimeline({
  myId,
  operations,
}: {
  myId: string;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const { code } = useCurrency();

  const entries = useMemo<TimelineEntry[]>(() => {
    const sorted = [...operations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, 60).map((op) => ({
      op,
      anomalies: detectAnomalies(op, operations, myId),
    }));
  }, [operations, myId]);

  const groups = useMemo(() => groupByDay(entries, t), [entries, t]);
  const totalFlagged = entries.reduce((s, e) => s + (e.anomalies.length > 0 ? 1 : 0), 0);

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        background: "#fff",
      }}
      aria-labelledby="activity-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2
            id="activity-heading"
            style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
          >
            {t("activity.title")}
          </h2>
          {totalFlagged > 0 ? (
            <span
              style={{
                padding: "2px 10px",
                borderRadius: 999,
                background: "rgba(220,38,38,0.1)",
                color: "#991b1b",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {t("activity.flagged", { n: totalFlagged })}
            </span>
          ) : (
            <span
              style={{
                padding: "2px 10px",
                borderRadius: 999,
                background: "rgba(5,150,105,0.1)",
                color: "#047857",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {t("activity.allClear")}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {t("activity.lastEvents", { n: entries.length })}
        </div>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#64748b",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
          }}
        >
          {t("activity.empty")}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    color: "#0f172a",
                  }}
                >
                  {g.label}
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(15,23,42,0.08)" }} />
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  {g.entries.length === 1 ? t("activity.day.events.one") : t("activity.day.events.many", { n: g.entries.length })}{g.flagged ? t("activity.day.flagged", { n: g.flagged }) : ""}
                </span>
              </div>
              <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                {g.entries.map((e) => (
                  <TimelineRow key={e.op.id} entry={e} myId={myId} code={code} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
        {t("activity.footer")}
      </div>
    </section>
  );
}

function TimelineRow({
  entry,
  myId,
  code,
}: {
  entry: TimelineEntry;
  myId: string;
  code: "AEC" | "USD" | "EUR" | "KZT";
}) {
  const { t } = useI18n();
  const { op, anomalies } = entry;
  const d = describeOp(op, myId);
  const flagged = anomalies.length > 0;
  const iconKey = op.kind === "topup" ? "topup" : d.signed >= 0 ? "transferIn" : "transferOut";
  const ic = KIND_ICON[iconKey];

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: flagged ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(15,23,42,0.08)",
        background: flagged ? "rgba(220,38,38,0.04)" : "#fff",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: ic.bg,
          color: ic.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {ic.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {d.label}
            {d.counterparty ? ` · ${d.counterparty.slice(0, 10)}…` : ""}
          </span>
          {anomalies.map((a) => {
            const label = t(ANOMALY_LABEL_KEY[a.kind]);
            const message = a.messageKey ? t(a.messageKey, a.messageVars) : a.message;
            return (
              <span
                key={a.kind}
                title={message}
                aria-label={t("activity.row.aria", { label, message })}
                style={{
                  padding: "1px 8px",
                  borderRadius: 999,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  background: `${ANOMALY_COLOR[a.kind]}18`,
                  color: ANOMALY_COLOR[a.kind],
                  border: `1px solid ${ANOMALY_COLOR[a.kind]}55`,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          <time dateTime={op.createdAt}>{formatTime(op.createdAt)}</time>
          {anomalies.length > 0
            ? ` · ${anomalies.map((a) => (a.messageKey ? t(a.messageKey, a.messageVars) : a.message)).join(" · ")}`
            : ""}
        </div>
      </div>
      <div
        style={{
          fontWeight: 900,
          fontSize: 13,
          color: d.signed >= 0 ? "#059669" : "#dc2626",
          whiteSpace: "nowrap" as const,
        }}
      >
        {formatCurrency(d.signed, code, { sign: true })}
      </div>
    </li>
  );
}
