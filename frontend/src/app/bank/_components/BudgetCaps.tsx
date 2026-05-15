"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  BUDGET_CAPS_EVENT,
  evaluateCaps,
  loadBudgetCaps,
  saveBudgetCaps,
  type BudgetCaps as Caps,
  type CapStatus,
} from "../_lib/budgetCaps";
import { CATEGORY_COLOR, CATEGORY_LABEL_KEY, type SpendCategory } from "../_lib/spending";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

const CATEGORIES: SpendCategory[] = ["subscriptions", "tips", "contacts", "untagged"];

const STATUS_TONE: Record<CapStatus, { color: string; bg: string }> = {
  ok: { color: "#059669", bg: "rgba(5,150,105,0.08)" },
  warning: { color: "#d97706", bg: "rgba(217,119,6,0.10)" },
  breach: { color: "#dc2626", bg: "rgba(220,38,38,0.10)" },
  uncapped: { color: "#64748b", bg: "rgba(100,116,139,0.06)" },
};

export function BudgetCaps({
  myAccountId,
  operations,
  notify,
}: {
  myAccountId: string;
  operations: Operation[];
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [caps, setCaps] = useState<Caps>(loadBudgetCaps);
  const [editing, setEditing] = useState<SpendCategory | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const handler = () => setCaps(loadBudgetCaps());
    window.addEventListener(BUDGET_CAPS_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(BUDGET_CAPS_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const progress = useMemo(
    () => evaluateCaps(operations, myAccountId, caps),
    [operations, myAccountId, caps],
  );

  const breaches = progress.filter((p) => p.status === "breach").length;
  const warnings = progress.filter((p) => p.status === "warning").length;

  const startEdit = (cat: SpendCategory) => {
    setEditing(cat);
    setDraft(caps[cat] !== null ? String(caps[cat]) : "");
  };

  const commitEdit = () => {
    if (!editing) return;
    const trimmed = draft.trim();
    const next: Caps = { ...caps };
    if (trimmed === "") {
      next[editing] = null;
    } else {
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num < 0) {
        notify(t("caps.toast.invalid"), "error");
        return;
      }
      next[editing] = num;
    }
    setCaps(next);
    saveBudgetCaps(next);
    setEditing(null);
    setDraft("");
  };

  const clearCap = (cat: SpendCategory) => {
    const next: Caps = { ...caps, [cat]: null };
    setCaps(next);
    saveBudgetCaps(next);
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("caps.title")}</div>
            <InfoTooltip text={t("caps.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("caps.subtitle")}
          </div>
        </div>
        {breaches + warnings > 0 ? (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {breaches > 0 ? (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: STATUS_TONE.breach.bg,
                  color: STATUS_TONE.breach.color,
                }}
              >
                {t("caps.badgeBreach", { count: breaches })}
              </span>
            ) : null}
            {warnings > 0 ? (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: STATUS_TONE.warning.bg,
                  color: STATUS_TONE.warning.color,
                }}
              >
                {t("caps.badgeWarn", { count: warnings })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {progress.map((p) => {
          const color = CATEGORY_COLOR[p.category];
          const tone = STATUS_TONE[p.status];
          const isEditing = editing === p.category;
          const ratio = Math.min(1.2, p.ratio);
          const fillPct = Math.min(100, p.ratio * 100);
          return (
            <div
              key={p.category}
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${tone.color}33`,
                background: tone.bg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        background: color,
                        borderRadius: "50%",
                      }}
                    />
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
                      {t(CATEGORY_LABEL_KEY[p.category])}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: tone.color,
                        textTransform: "uppercase" as const,
                        letterSpacing: 0.4,
                      }}
                    >
                      {t(`caps.status.${p.status}`)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                    {p.cap !== null
                      ? t("caps.row.spent", {
                          spent: formatCurrency(p.spent, code),
                          cap: formatCurrency(p.cap, code),
                          pct: Math.round(p.ratio * 100),
                        })
                      : t("caps.row.uncapped", { spent: formatCurrency(p.spent, code) })}
                  </div>
                </div>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      autoFocus
                      placeholder={t("caps.placeholderAec")}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") {
                          setEditing(null);
                          setDraft("");
                        }
                      }}
                      style={{
                        width: 100,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(15,23,42,0.2)",
                        fontSize: 13,
                      }}
                    />
                    <button onClick={commitEdit} style={smallBtn(color)}>
                      {t("caps.save")}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(p.category)} style={smallBtn("#0f172a")}>
                      {p.cap !== null ? t("caps.edit") : t("caps.setCap")}
                    </button>
                    {p.cap !== null ? (
                      <button onClick={() => clearCap(p.category)} style={smallBtn("#94a3b8")}>
                        {t("caps.clear")}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              {p.cap !== null ? (
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "rgba(15,23,42,0.06)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: `${fillPct}%`,
                      height: "100%",
                      background: tone.color,
                      transition: "width 240ms ease",
                    }}
                  />
                  {p.ratio > 1 ? (
                    <div
                      style={{
                        position: "absolute",
                        right: 4,
                        top: -16,
                        fontSize: 10,
                        fontWeight: 800,
                        color: tone.color,
                      }}
                    >
                      +{Math.round((p.ratio - 1) * 100)}%
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "#64748b",
          lineHeight: 1.5,
        }}
      >
        {t("caps.footer")}
      </div>
    </section>
  );
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

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(217,119,6,0.03) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
