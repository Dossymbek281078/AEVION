"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  DEFAULT_PIE,
  loadApplied,
  loadPie,
  PIE_EVENT,
  pendingInflows,
  saveApplied,
  savePie,
  splitFor,
  type PieConfig,
} from "../_lib/investmentPie";
import { useSavings } from "../_hooks/useSavings";
import {
  loadVault,
  newPositionId,
  saveVault,
  TERM_APY,
  type VaultPosition,
  type VaultTerm,
} from "../_lib/vault";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

const TERMS: VaultTerm[] = [30, 90, 180];

export function InvestmentPie({
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
  const [cfg, setCfg] = useState<PieConfig>(DEFAULT_PIE);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    const reload = () => {
      setCfg(loadPie());
      setApplied(loadApplied());
    };
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(PIE_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(PIE_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const persist = (next: PieConfig) => {
    savePie(next);
    setCfg(next);
  };

  const pending = useMemo(
    () => pendingInflows(operations, myAccountId, cfg, applied).slice(0, 10),
    [operations, myAccountId, cfg, applied],
  );

  const totalRemainder = cfg.goalPct + cfg.vaultPct;
  const remainderPct = Math.max(0, 100 - totalRemainder);

  const setGoalPct = (v: number) => {
    const clamped = Math.max(0, Math.min(100 - cfg.vaultPct, v));
    persist({ ...cfg, goalPct: clamped });
  };

  const setVaultPct = (v: number) => {
    const clamped = Math.max(0, Math.min(100 - cfg.goalPct, v));
    persist({ ...cfg, vaultPct: clamped });
  };

  const targetGoal = cfg.goalId ? goals.find((g) => g.id === cfg.goalId) ?? null : null;

  const apply = (op: Operation) => {
    if (!cfg.enabled) {
      notify(t("pie.toast.disabled"), "error");
      return;
    }
    if (!targetGoal && cfg.goalPct > 0) {
      notify(t("pie.toast.pickGoal"), "error");
      return;
    }
    const { goal, vault } = splitFor(op, cfg);
    if (goal > 0 && targetGoal) {
      contribute(targetGoal.id, goal);
    }
    if (vault > 0) {
      const lockedAt = new Date();
      const lockUntil = new Date(lockedAt.getTime() + cfg.vaultTermDays * 86_400_000);
      const next: VaultPosition = {
        id: newPositionId(),
        principal: vault,
        apy: TERM_APY[cfg.vaultTermDays],
        termDays: cfg.vaultTermDays,
        lockedAt: lockedAt.toISOString(),
        lockUntil: lockUntil.toISOString(),
        claimedAt: null,
        claimedYield: 0,
      };
      saveVault([next, ...loadVault()]);
    }
    const nextApplied = new Set(applied);
    nextApplied.add(op.id);
    saveApplied(nextApplied);
    setApplied(nextApplied);
    persist({
      ...cfg,
      lifetimeApplied: cfg.lifetimeApplied + 1,
      lifetimeRouted: Number((cfg.lifetimeRouted + goal + vault).toFixed(2)),
    });
    notify(
      t("pie.toast.applied", {
        amount: formatCurrency(op.amount, code),
        goal: formatCurrency(goal, code),
        vault: formatCurrency(vault, code),
      }),
      "success",
    );
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("pie.title")}</div>
            <InfoTooltip text={t("pie.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("pie.subtitle")}
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
          {cfg.enabled ? t("pie.on") : t("pie.off")}
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat
          label={t("pie.statApplied")}
          value={String(cfg.lifetimeApplied)}
          accent="#0d9488"
        />
        <Stat
          label={t("pie.statRouted")}
          value={formatCurrency(cfg.lifetimeRouted, code)}
          accent="#7c3aed"
        />
        <Stat
          label={t("pie.statPending")}
          value={String(pending.length)}
          accent={pending.length > 0 ? "#d97706" : "#0d9488"}
        />
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "rgba(15,23,42,0.02)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <SliceRow
            color="#0ea5e9"
            label={t("pie.sliceGoal")}
            pct={cfg.goalPct}
            onChange={setGoalPct}
            extras={
              <select
                value={cfg.goalId ?? ""}
                onChange={(e) =>
                  persist({ ...cfg, goalId: e.target.value || null })
                }
                style={smallSelect}
              >
                <option value="">{t("pie.pickGoal")}</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            }
          />
          <SliceRow
            color="#7c3aed"
            label={t("pie.sliceVault")}
            pct={cfg.vaultPct}
            onChange={setVaultPct}
            extras={
              <select
                value={cfg.vaultTermDays}
                onChange={(e) =>
                  persist({
                    ...cfg,
                    vaultTermDays: Number(e.target.value) as VaultTerm,
                  })
                }
                style={smallSelect}
              >
                {TERMS.map((tt) => (
                  <option key={tt} value={tt}>
                    {tt}d @ {(TERM_APY[tt] * 100).toFixed(0)}%
                  </option>
                ))}
              </select>
            }
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(15,23,42,0.05)",
              fontSize: 12,
            }}
          >
            <span style={{ color: "#64748b" }}>{t("pie.sliceRemainder")}</span>
            <span style={{ fontWeight: 800, color: "#0f172a" }}>{remainderPct}%</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
              {t("pie.thresholdLabel")}
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={cfg.threshold}
              onChange={(e) =>
                persist({ ...cfg, threshold: Math.max(0, Number(e.target.value) || 0) })
              }
              style={{
                width: 100,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid rgba(15,23,42,0.15)",
                fontSize: 12,
              }}
            />
            <span style={{ fontSize: 11, color: "#64748b" }}>AEC</span>
          </div>
        </div>
      </div>

      {pending.length > 0 ? (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#64748b",
              letterSpacing: 0.5,
              textTransform: "uppercase" as const,
              marginBottom: 8,
            }}
          >
            {t("pie.pendingTitle")}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {pending.map((op) => {
              const split = splitFor(op, cfg);
              return (
                <div
                  key={op.id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(13,148,136,0.05)",
                    fontSize: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "#1e293b" }}>
                      {op.kind === "topup" ? t("pie.opTopup") : t("pie.opIn")} ·{" "}
                      {formatCurrency(op.amount, code)}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      → {t("pie.preview", {
                        goal: formatCurrency(split.goal, code),
                        vault: formatCurrency(split.vault, code),
                        rem: formatCurrency(split.remainder, code),
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => apply(op)}
                    disabled={!cfg.enabled}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: cfg.enabled ? "#0d9488" : "#cbd5e1",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: cfg.enabled ? "pointer" : "not-allowed",
                    }}
                  >
                    {t("pie.applyCta")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 16,
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
            background: "rgba(13,148,136,0.05)",
            borderRadius: 10,
          }}
        >
          {cfg.enabled ? t("pie.noPending") : t("pie.disabledHint")}
        </div>
      )}
    </section>
  );
}

function SliceRow({
  color,
  label,
  pct,
  onChange,
  extras,
}: {
  color: string;
  label: string;
  pct: number;
  onChange: (v: number) => void;
  extras: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, background: color, borderRadius: "50%" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: color }}
        />
        {extras}
      </div>
    </div>
  );
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

const smallSelect = {
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 12,
  background: "#fff",
} as const;

const containerStyle = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(124,58,237,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
