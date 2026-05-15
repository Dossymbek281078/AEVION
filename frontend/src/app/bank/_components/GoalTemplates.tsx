"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useSavings } from "../_hooks/useSavings";
import { type GoalIcon } from "../_lib/savings";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

type Template = {
  key: string;
  icon: GoalIcon;
  /** Multiplier applied to user's monthly inflow median to compute target. */
  monthlyMultiplier: number;
  /** Floor target so a brand-new wallet still produces sensible numbers. */
  floor: number;
  deadlineMonths: number | null;
  emoji: string;
};

const TEMPLATES: Template[] = [
  { key: "emergency", icon: "heart", monthlyMultiplier: 3, floor: 500, deadlineMonths: 6, emoji: "🛟" },
  { key: "downpayment", icon: "home", monthlyMultiplier: 36, floor: 5000, deadlineMonths: 36, emoji: "🏠" },
  { key: "vacation", icon: "vacation", monthlyMultiplier: 1, floor: 200, deadlineMonths: 6, emoji: "🏖" },
  { key: "tech", icon: "gear", monthlyMultiplier: 1.5, floor: 300, deadlineMonths: 4, emoji: "💻" },
  { key: "wedding", icon: "heart", monthlyMultiplier: 8, floor: 2000, deadlineMonths: 18, emoji: "💍" },
  { key: "education", icon: "star", monthlyMultiplier: 6, floor: 1500, deadlineMonths: 12, emoji: "🎓" },
  { key: "car", icon: "travel", monthlyMultiplier: 12, floor: 3000, deadlineMonths: 24, emoji: "🚗" },
  { key: "sabbatical", icon: "music", monthlyMultiplier: 6, floor: 2500, deadlineMonths: 12, emoji: "🌴" },
];

function effectIn(op: Operation, myId: string): number {
  if (op.kind === "topup") return op.amount;
  if (op.to === myId && op.kind === "transfer") return op.amount;
  return 0;
}

export function GoalTemplates({
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
  const { goals, add } = useSavings();

  // Median monthly inflow: bucket inflow per month over last 6 months, take median
  const monthlyInflow = useMemo(() => {
    const buckets = new Map<string, number>();
    const cutoff = Date.now() - 6 * 30 * 86_400_000;
    for (const op of operations) {
      const ts = new Date(op.createdAt).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const inAmt = effectIn(op, myAccountId);
      if (inAmt <= 0) continue;
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, (buckets.get(key) ?? 0) + inAmt);
    }
    const vals = Array.from(buckets.values()).sort((a, b) => a - b);
    if (vals.length === 0) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
  }, [operations, myAccountId]);

  const cards = useMemo(
    () =>
      TEMPLATES.map((tpl) => {
        const dynamicTarget = monthlyInflow * tpl.monthlyMultiplier;
        const target = Math.max(tpl.floor, Math.round(dynamicTarget / 50) * 50);
        const exists = goals.some((g) => g.label === t(`goalTpl.${tpl.key}.label`));
        return { tpl, target, exists };
      }),
    [monthlyInflow, goals, t],
  );

  const create = (tpl: Template, target: number) => {
    const label = t(`goalTpl.${tpl.key}.label`);
    const deadlineISO = tpl.deadlineMonths
      ? new Date(Date.now() + tpl.deadlineMonths * 30 * 86_400_000).toISOString()
      : null;
    add({ label, icon: tpl.icon, targetAec: target, deadlineISO });
    notify(t("goalTpl.toast.created", { label, target: formatCurrency(target, code) }), "success");
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("goalTpl.title")}</div>
            <InfoTooltip text={t("goalTpl.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {monthlyInflow > 0
              ? t("goalTpl.subtitleScaled", { median: formatCurrency(monthlyInflow, code) })
              : t("goalTpl.subtitleFloor")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        {cards.map(({ tpl, target, exists }) => (
          <div
            key={tpl.key}
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.08)",
              background: exists ? "rgba(15,23,42,0.04)" : "#fff",
              opacity: exists ? 0.7 : 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>{tpl.emoji}</span>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
                {t(`goalTpl.${tpl.key}.label`)}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, flex: 1 }}>
              {t(`goalTpl.${tpl.key}.hint`)}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: 0.4,
                    textTransform: "uppercase" as const,
                  }}
                >
                  {t("goalTpl.target")}
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(target, code)}
                </div>
                {tpl.deadlineMonths ? (
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
                    {t("goalTpl.byMonths", { months: tpl.deadlineMonths })}
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => create(tpl, target)}
                disabled={exists}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: exists
                    ? "#cbd5e1"
                    : "linear-gradient(135deg, #0d9488, #0ea5e9)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: exists ? "not-allowed" : "pointer",
                }}
              >
                {exists ? t("goalTpl.exists") : t("goalTpl.create")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(14,165,233,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
