"use client";

import { useMemo } from "react";
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
import { Sparkline, StatCard } from "./primitives";

export function WalletSummary({
  account,
  operations,
}: {
  account: Account;
  operations: Operation[];
}) {
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
      <div style={{ flex: "1 1 280px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>
          BALANCE TREND (14 DAYS)
        </div>
        <Sparkline data={sparkline} width={280} height={50} />
        <div
          style={{
            fontSize: 11,
            color: delta >= 0 ? "#059669" : "#dc2626",
            fontWeight: 700,
            marginTop: 2,
          }}
        >
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs 14 days ago
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "2 1 400px" }}>
        <StatCard label="Balance" value={formatCurrency(account.balance, code)} accent="#0f766e" />
        <StatCard
          label="Net flow 30d"
          value={formatCurrency(s.netFlow, code, { sign: true })}
          accent={s.netFlow >= 0 ? "#059669" : "#dc2626"}
          hint={`In ${formatCurrency(s.incoming, code, { decimals: 0 })} · Out ${formatCurrency(s.outgoing, code, { decimals: 0 })}`}
        />
        <StatCard label="Operations 30d" value={String(s.count)} />
        <StatCard
          label="Last activity"
          value={last ? formatRelative(new Date(last).toISOString()) : "—"}
          hint={last ? undefined : "no operations yet"}
        />
      </div>
    </div>
  );
}
