"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  accruedYield,
  computeClaimAmount,
  isMature,
  lifetimeStats,
  loadVault,
  newPositionId,
  saveVault,
  TERM_APY,
  timeLeftHours,
  VAULT_EVENT,
  type VaultPosition,
  type VaultTerm,
} from "../_lib/vault";
import type { Account } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

const TERMS: VaultTerm[] = [30, 90, 180];

export function AecVault({
  account,
  topup,
  notify,
}: {
  account: Account;
  topup: (amount: number) => Promise<boolean>;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [positions, setPositions] = useState<VaultPosition[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());
  const [term, setTerm] = useState<VaultTerm>(90);
  const [amountStr, setAmountStr] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    const reload = () => setPositions(loadVault());
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(VAULT_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(VAULT_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  // Tick the accrued yield display once per second
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stats = useMemo(() => lifetimeStats(positions), [positions]);
  const apy = TERM_APY[term];
  const amount = Number(amountStr);
  const amountValid = Number.isFinite(amount) && amount > 0;

  const lockNow = () => {
    if (!amountValid) {
      notify(t("vault.toast.invalid"), "error");
      return;
    }
    if (amount > account.balance) {
      notify(t("vault.toast.notEnough"), "error");
      return;
    }
    const lockedAt = new Date();
    const lockUntil = new Date(lockedAt.getTime() + term * 86_400_000);
    const next: VaultPosition = {
      id: newPositionId(),
      principal: amount,
      apy: TERM_APY[term],
      termDays: term,
      lockedAt: lockedAt.toISOString(),
      lockUntil: lockUntil.toISOString(),
      claimedAt: null,
      claimedYield: 0,
    };
    const updated = [next, ...positions];
    setPositions(updated);
    saveVault(updated);
    setAmountStr("");
    notify(
      t("vault.toast.locked", {
        amount: formatCurrency(amount, code),
        days: term,
        apy: (TERM_APY[term] * 100).toFixed(0),
      }),
      "success",
    );
  };

  const claim = async (id: string) => {
    if (busy) return;
    const p = positions.find((x) => x.id === id);
    if (!p) return;
    const { yieldEarned, penalty, net, early } = computeClaimAmount(p, now);
    if (net <= 0) {
      notify(t("vault.toast.nothingToClaim"), "info");
      return;
    }
    setBusy(true);
    try {
      const ok = await topup(net);
      if (!ok) {
        notify(t("vault.toast.claimFailed"), "error");
        return;
      }
      const updated = positions.map((x) =>
        x.id === id
          ? { ...x, claimedAt: new Date().toISOString(), claimedYield: net }
          : x,
      );
      setPositions(updated);
      saveVault(updated);
      notify(
        early
          ? t("vault.toast.earlyClaimed", {
              net: formatCurrency(net, code),
              gross: formatCurrency(yieldEarned, code),
              penalty: formatCurrency(penalty, code),
            })
          : t("vault.toast.claimed", { net: formatCurrency(net, code) }),
        "success",
      );
    } finally {
      setBusy(false);
    }
  };

  const active = positions.filter((p) => !p.claimedAt);
  const claimed = positions.filter((p) => p.claimedAt).slice(0, 5);

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("vault.title")}</div>
            <InfoTooltip text={t("vault.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("vault.subtitle")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat label={t("vault.statActive")} value={String(stats.activeCount)} accent="#0d9488" />
        <Stat label={t("vault.statLocked")} value={formatCurrency(stats.lockedPrincipal, code)} accent="#7c3aed" />
        <Stat label={t("vault.statPending")} value={formatCurrency(stats.pendingYield, code)} accent="#d97706" />
        <Stat label={t("vault.statClaimed")} value={formatCurrency(stats.claimedTotal, code)} accent="#059669" />
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(13,148,136,0.18)",
          background: "rgba(13,148,136,0.04)",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#0f766e",
            letterSpacing: 0.5,
            textTransform: "uppercase" as const,
            marginBottom: 10,
          }}
        >
          {t("vault.openTitle")}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {TERMS.map((tt) => (
            <button
              key={tt}
              onClick={() => setTerm(tt)}
              style={{
                flex: 1,
                minWidth: 90,
                padding: "10px 14px",
                borderRadius: 10,
                border: term === tt ? `2px solid #0d9488` : "1px solid rgba(15,23,42,0.12)",
                background: term === tt ? "rgba(13,148,136,0.08)" : "#fff",
                cursor: "pointer",
                textAlign: "left" as const,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                {tt} {t("vault.daysShort")}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", marginTop: 2 }}>
                {(TERM_APY[tt] * 100).toFixed(0)}% APY
              </div>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
          <input
            type="number"
            min="0"
            step="1"
            placeholder={t("vault.amountPlaceholder")}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 14,
            }}
          />
          <button
            onClick={lockNow}
            disabled={!amountValid || busy}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background:
                !amountValid || busy
                  ? "#cbd5e1"
                  : "linear-gradient(135deg, #0d9488, #059669)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: !amountValid || busy ? "not-allowed" : "pointer",
            }}
          >
            {t("vault.lockCta", { apy: (apy * 100).toFixed(0) })}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
          {t("vault.openHint")}
        </div>
      </div>

      {active.length > 0 ? (
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#64748b",
              letterSpacing: 0.5,
              textTransform: "uppercase" as const,
            }}
          >
            {t("vault.activeTitle")}
          </div>
          {active.map((p) => {
            const yieldNow = accruedYield(p, now);
            const mature = isMature(p, now);
            const hLeft = timeLeftHours(p, now);
            const hStr =
              hLeft >= 24
                ? t("vault.timeLeft.dh", { d: Math.floor(hLeft / 24), h: hLeft % 24 })
                : hLeft > 0
                  ? t("vault.timeLeft.h", { h: hLeft })
                  : t("vault.timeLeft.mature");
            return (
              <div
                key={p.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: mature
                    ? "1px solid rgba(5,150,105,0.4)"
                    : "1px solid rgba(15,23,42,0.08)",
                  background: mature ? "rgba(5,150,105,0.06)" : "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
                      {formatCurrency(p.principal, code)}{" "}
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                        @ {(p.apy * 100).toFixed(0)}% · {p.termDays}d
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {hStr}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const }}>
                      {t("vault.accrued")}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#0d9488",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      +{formatCurrency(yieldNow, code)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void claim(p.id)}
                  disabled={busy}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: mature
                      ? "linear-gradient(135deg, #0d9488, #059669)"
                      : "rgba(217,119,6,0.12)",
                    color: mature ? "#fff" : "#92400e",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {mature
                    ? t("vault.claimMature", { amount: formatCurrency(yieldNow, code) })
                    : t("vault.claimEarly", {
                        net: formatCurrency(yieldNow * 0.5, code),
                      })}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {claimed.length > 0 ? (
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
            {t("vault.historyTitle")}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {claimed.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(15,23,42,0.04)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#475569" }}>
                  {formatCurrency(p.principal, code)} @ {(p.apy * 100).toFixed(0)}% · {p.termDays}d
                </span>
                <span style={{ fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums" }}>
                  +{formatCurrency(p.claimedYield, code)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
        {t("vault.disclaimer")}
      </div>
    </section>
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
