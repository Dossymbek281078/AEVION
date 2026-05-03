"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  DEFAULT_CONFIG,
  loadRoundUpConfig,
  pendingStash,
  roundUpDiff,
  ROUNDUP_EVENT,
  saveRoundUpConfig,
  yearToDateStash,
  type RoundUpConfig,
  type RoundUpIncrement,
} from "../_lib/roundUp";
import { useSavings } from "../_hooks/useSavings";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

const INCREMENTS: RoundUpIncrement[] = [1, 5, 10];

export function RoundUpStash({
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
  const { goals, contribute } = useSavings();
  const [cfg, setCfg] = useState<RoundUpConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    setCfg(loadRoundUpConfig());
    const handler = () => setCfg(loadRoundUpConfig());
    window.addEventListener(ROUNDUP_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(ROUNDUP_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const persist = (next: RoundUpConfig) => {
    saveRoundUpConfig(next);
    setCfg(next);
  };

  const cursorMs = cfg.realizedCursor
    ? new Date(cfg.realizedCursor).getTime()
    : new Date(Date.now() - 30 * 86_400_000).getTime();

  const stash = useMemo(
    () => pendingStash(operations, myAccountId, cfg.increment, cursorMs),
    [operations, myAccountId, cfg.increment, cursorMs],
  );

  const ytd = useMemo(
    () => yearToDateStash(operations, myAccountId, cfg.increment, cfg.lifetimeRealized),
    [operations, myAccountId, cfg.increment, cfg.lifetimeRealized],
  );

  const recentOps = useMemo(() => {
    const out: { op: Operation; diff: number }[] = [];
    for (const op of operations) {
      if (op.kind !== "transfer" || op.from !== myAccountId) continue;
      const ts = new Date(op.createdAt).getTime();
      if (!Number.isFinite(ts) || ts <= cursorMs) continue;
      const diff = roundUpDiff(op.amount, cfg.increment);
      if (diff <= 0) continue;
      out.push({ op, diff });
      if (out.length >= 5) break;
    }
    return out;
  }, [operations, myAccountId, cfg.increment, cursorMs]);

  const targetGoal = cfg.targetGoalId
    ? goals.find((g) => g.id === cfg.targetGoalId) ?? null
    : null;

  const claim = () => {
    if (!cfg.enabled) {
      notify(t("roundUp.toast.notEnabled"), "error");
      return;
    }
    if (stash.amount <= 0) {
      notify(t("roundUp.toast.empty"), "info");
      return;
    }
    if (!targetGoal) {
      notify(t("roundUp.toast.pickGoal"), "error");
      return;
    }
    contribute(targetGoal.id, stash.amount);
    persist({
      ...cfg,
      realizedCursor: new Date().toISOString(),
      lifetimeRealized: Number((cfg.lifetimeRealized + stash.amount).toFixed(2)),
    });
    notify(
      t("roundUp.toast.claimed", {
        amount: formatCurrency(stash.amount, code),
        goal: targetGoal.label,
      }),
      "success",
    );
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("roundUp.title")}</div>
            <InfoTooltip text={t("roundUp.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("roundUp.subtitle")}
          </div>
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            color: cfg.enabled ? "#059669" : "#64748b",
          }}
        >
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => persist({ ...cfg, enabled: e.target.checked })}
          />
          {cfg.enabled ? t("roundUp.enabledOn") : t("roundUp.enabledOff")}
        </label>
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
          label={t("roundUp.statPending")}
          value={formatCurrency(stash.amount, code)}
          accent="#0d9488"
          hint={t("roundUp.fromOps", { count: stash.opCount })}
        />
        <Stat
          label={t("roundUp.statYtd")}
          value={formatCurrency(ytd.ytd, code)}
          accent="#7c3aed"
        />
        <Stat
          label={t("roundUp.statLifetime")}
          value={formatCurrency(cfg.lifetimeRealized, code)}
          accent="#059669"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
            {t("roundUp.incrementLabel")}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {INCREMENTS.map((inc) => (
              <button
                key={inc}
                onClick={() => persist({ ...cfg, increment: inc })}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: cfg.increment === inc ? "#0f172a" : "transparent",
                  color: cfg.increment === inc ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {inc} AEC
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
            {t("roundUp.targetLabel")}
          </div>
          <select
            value={cfg.targetGoalId ?? ""}
            onChange={(e) =>
              persist({
                ...cfg,
                targetGoalId: e.target.value ? e.target.value : null,
              })
            }
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "#fff",
              fontSize: 13,
              color: "#1e293b",
            }}
          >
            <option value="">{t("roundUp.targetNone")}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={claim}
        disabled={!cfg.enabled || stash.amount <= 0 || !targetGoal}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: "none",
          background:
            !cfg.enabled || stash.amount <= 0 || !targetGoal
              ? "#cbd5e1"
              : "linear-gradient(135deg, #0d9488, #059669)",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          cursor:
            !cfg.enabled || stash.amount <= 0 || !targetGoal ? "not-allowed" : "pointer",
          marginBottom: 12,
        }}
      >
        {!cfg.enabled
          ? t("roundUp.cta.enableFirst")
          : !targetGoal
            ? t("roundUp.cta.pickGoal")
            : stash.amount <= 0
              ? t("roundUp.cta.nothing")
              : t("roundUp.cta.claim", {
                  amount: formatCurrency(stash.amount, code),
                  goal: targetGoal.label,
                })}
      </button>

      {recentOps.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.4, textTransform: "uppercase" as const, marginBottom: 8 }}>
            {t("roundUp.recentTitle")}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {recentOps.map(({ op, diff }) => {
              const dt = new Date(op.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={op.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(13,148,136,0.06)",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "#1e293b" }}>
                      {formatCurrency(op.amount, code)} → {formatCurrency(op.amount + diff, code)}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{dt}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: "#0d9488", fontVariantNumeric: "tabular-nums" }}>
                    +{formatCurrency(diff, code)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
}) {
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
      {hint ? (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{hint}</div>
      ) : null}
    </div>
  );
}

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(13,148,136,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
