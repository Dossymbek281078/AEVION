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
