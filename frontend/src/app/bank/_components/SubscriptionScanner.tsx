"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  loadRecurring,
  RECURRING_EVENT,
  saveRecurring,
  type Recurring,
} from "../_lib/recurring";

function periodKey(p: Recurring["period"]): string {
  return `period.${p}`;
}
import { scanRecurring, totalMonthlySpend, type ScanFlag } from "../_lib/subscriptionScan";
import { InfoTooltip } from "./InfoTooltip";

const FLAG_COLOR: Record<ScanFlag, string> = {
  stale: "#64748b",
  expensive: "#dc2626",
  duplicate: "#d97706",
};

const SEVERITY_COLOR = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#0d9488",
} as const;

export function SubscriptionScanner({
  notify,
}: {
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [items, setItems] = useState<Recurring[]>([]);

  useEffect(() => {
    const reload = () => setItems(loadRecurring());
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(RECURRING_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(RECURRING_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const findings = useMemo(() => scanRecurring(items), [items]);
  const monthly = useMemo(() => totalMonthlySpend(items), [items]);
  const flaggedMonthly = useMemo(() => {
    let s = 0;
    for (const f of findings) {
      if (!f.recurring.active) continue;
      const r = f.recurring;
      switch (r.period) {
        case "daily":
          s += r.amount * 30;
          break;
        case "weekly":
          s += r.amount * 4.33;
          break;
        case "biweekly":
          s += r.amount * 2.17;
          break;
        case "monthly":
          s += r.amount;
          break;
      }
    }
    return s;
  }, [findings]);

  const pause = (id: string) => {
    const next = items.map((r) => (r.id === id ? { ...r, active: false } : r));
    setItems(next);
    saveRecurring(next);
    notify(t("subScan.toast.paused"), "success");
  };

  const remove = (id: string) => {
    const next = items.filter((r) => r.id !== id);
    setItems(next);
    saveRecurring(next);
    notify(t("subScan.toast.removed"), "success");
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("subScan.title")}</div>
            <InfoTooltip text={t("subScan.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("subScan.subtitle")}
          </div>
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
        <Stat
          label={t("subScan.statTotal")}
          value={String(items.filter((r) => r.active).length)}
          accent="#0d9488"
        />
        <Stat
          label={t("subScan.statFlagged")}
          value={String(findings.length)}
          accent={findings.length > 0 ? "#d97706" : "#0d9488"}
        />
        <Stat
          label={t("subScan.statMonthly")}
          value={formatCurrency(monthly, code)}
          accent="#7c3aed"
        />
        <Stat
          label={t("subScan.statFlaggedMonthly")}
          value={formatCurrency(flaggedMonthly, code)}
          accent={flaggedMonthly > 0 ? "#dc2626" : "#0d9488"}
        />
      </div>

      {findings.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 12,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
            color: "#0f766e",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {items.length === 0 ? t("subScan.noRecurring") : t("subScan.allClear")}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {findings.map((f) => {
            const sev = SEVERITY_COLOR[f.severity];
            return (
              <div
                key={f.recurring.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: `1px solid ${sev}33`,
                  background: `${sev}08`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
                      {f.recurring.label}{" "}
                      {!f.recurring.active ? (
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginLeft: 6 }}>
                          {t("subScan.paused")}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {formatCurrency(f.recurring.amount, code)} ·{" "}
                      {t(periodKey(f.recurring.period))} →{" "}
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>
                        {f.recurring.recipientNickname || shortId(f.recurring.toAccountId)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {f.recurring.active ? (
                      <button onClick={() => pause(f.recurring.id)} style={smallBtn("#d97706")}>
                        {t("subScan.pause")}
                      </button>
                    ) : null}
                    <button onClick={() => remove(f.recurring.id)} style={smallBtn("#dc2626")}>
                      {t("subScan.remove")}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {f.flags.map((flag) => (
                    <span
                      key={flag}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase" as const,
                        letterSpacing: 0.4,
                        background: `${FLAG_COLOR[flag]}1a`,
                        color: FLAG_COLOR[flag],
                      }}
                    >
                      {t(`subScan.flag.${flag}`)}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                  {f.flags.includes("stale") && f.daysSinceRun !== null
                    ? t("subScan.detail.stale", { days: f.daysSinceRun }) + " "
                    : null}
                  {f.flags.includes("expensive") && f.expensiveRatio
                    ? t("subScan.detail.expensive", { ratio: f.expensiveRatio.toFixed(1) }) + " "
                    : null}
                  {f.flags.includes("duplicate") && f.duplicateOfIds.length > 0
                    ? t("subScan.detail.duplicate", { count: f.duplicateOfIds.length })
                    : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function smallBtn(color: string) {
  return {
    padding: "5px 12px",
    borderRadius: 8,
    border: "none",
    background: color,
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  } as const;
}

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
      <div style={{ fontWeight: 900, fontSize: 16, color: "#1e293b", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(217,119,6,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
