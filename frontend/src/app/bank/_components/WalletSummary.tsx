"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  buildSparkline,
  formatRelative,
  lastActivityMs,
  sparklineDelta,
  stats30d,
} from "../_lib/format";
import type { Account, Operation } from "../_lib/types";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { AnimatedMoney, BalanceTrendIndicator } from "./AnimatedMoney";
import { CoinTower } from "./CoinTower";
import { InfoTooltip } from "./InfoTooltip";
import { Sparkline, StatCard } from "./primitives";

export function WalletSummary({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
  const { t } = useI18n();
  const sparkline = useMemo(
    () => buildSparkline(operations, account.balance, account.id),
    [operations, account.balance, account.id],
  );

  const s = useMemo(() => stats30d(operations, account.id), [operations, account.id]);
  const last = useMemo(() => lastActivityMs(operations), [operations]);
  const delta = useMemo(() => sparklineDelta(sparkline), [sparkline]);
  const { code } = useCurrency();

  // 7-day balance trend: use last 7 points of the 14-day sparkline
  const week7 = useMemo(() => {
    if (sparkline.length < 2) return null;
    const slice = sparkline.slice(-7);
    const start = slice[0];
    const end = slice[slice.length - 1];
    if (start === 0) return end === 0 ? 0 : 100;
    return ((end - start) / Math.abs(start)) * 100;
  }, [sparkline]);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        padding: "20px 28px 12px",
        background: "rgba(15,23,42,0.02)",
        borderTop: "1px solid rgba(15,23,42,0.06)",
        alignItems: "center",
      }}
    >
      <div style={{ flex: "1 1 280px", display: "flex", gap: 12, alignItems: "flex-end" }}>
        <CoinTower balance={account.balance} height={140} coinWidth={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
            {t("wallet.trend.title")}
          </div>
          <Sparkline data={sparkline} width={220} height={50} />
          <div
            style={{
              fontSize: 11,
              color: delta >= 0 ? "#059669" : "#dc2626",
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {t("wallet.trend.delta", {
              delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`,
            })}
          </div>
          {week7 !== null ? (
            <div
              title="7-day balance change"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 6,
                padding: "3px 8px",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 800,
                background: week7 >= 0 ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.08)",
                color: week7 >= 0 ? "#059669" : "#dc2626",
                border: `1px solid ${week7 >= 0 ? "rgba(5,150,105,0.25)" : "rgba(220,38,38,0.2)"}`,
                letterSpacing: 0.3,
              }}
            >
              <span style={{ fontSize: 9 }}>{week7 >= 0 ? "▲" : "▼"}</span>
              {week7 >= 0 ? "+" : ""}
              {week7.toFixed(1)}% this week
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "2 1 400px" }}>
        <StatCard
          label={
            <InfoTooltip text={t("tip.balance")} side="bottom">
              <span>{t("wallet.stat.balance")}</span>
            </InfoTooltip>
          }
          value={
            <>
              <AnimatedMoney aec={account.balance} />
              <BalanceTrendIndicator balance={account.balance} />
            </>
          }
          accent="#0f766e"
        />
        <StatCard
          label={
            <InfoTooltip text={t("tip.netflow")} side="bottom">
              <span>{t("wallet.stat.netflow")}</span>
            </InfoTooltip>
          }
          value={formatCurrency(s.netFlow, code, { sign: true })}
          accent={s.netFlow >= 0 ? "#059669" : "#dc2626"}
          hint={t("wallet.stat.netflow.hint", {
            in: formatCurrency(s.incoming, code, { decimals: 0 }),
            out: formatCurrency(s.outgoing, code, { decimals: 0 }),
          })}
        />
        <StatCard
          label={
            <InfoTooltip text={t("tip.ops")} side="bottom">
              <span>{t("wallet.stat.ops")}</span>
            </InfoTooltip>
          }
          value={String(s.count)}
        />
        <StatCard
          label={
            <InfoTooltip text={t("tip.lastActivity")} side="bottom">
              <span>{t("wallet.stat.last")}</span>
            </InfoTooltip>
          }
          value={last ? formatRelative(new Date(last).toISOString()) : "—"}
          hint={last ? undefined : t("wallet.stat.last.empty")}
        />
      </div>
    </div>
  );
}
