"use client";

import { useMemo, useState } from "react";
import { useAdvance } from "../_hooks/useAdvance";
import { eligibilityFor } from "../_lib/advance";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { formatRelative } from "../_lib/format";
import { computeEcosystemTrustScore, tierColor, tierLabel } from "../_lib/trust";
import type { Account, Operation } from "../_lib/types";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

type Props = {
  account: Account;
  operations: Operation[];
  topup: (amount: number) => Promise<boolean>;
  notify: Notify;
};

export function SalaryAdvance({ account, operations, topup, notify }: Props) {
  const { advance, request, repayManual, close } = useAdvance();
  const [requesting, setRequesting] = useState<boolean>(false);
  const { royalty, chess, ecosystem } = useEcosystemData();
  const [repayInput, setRepayInput] = useState<string>("");
  const { code } = useCurrency();

  const trust = useMemo(
    () => computeEcosystemTrustScore({ account, operations, royalty, chess, ecosystem }),
    [account, operations, royalty, chess, ecosystem],
  );

  const eligibility = eligibilityFor(trust.tier);
  const color = tierColor[trust.tier];

  const doRequest = async (amount: number) => {
    if (amount <= 0 || amount > eligibility.limit) {
      notify("Invalid advance amount", "error");
      return;
    }
    setRequesting(true);
    const ok = await topup(amount);
    if (ok) {
      request(amount);
      notify(`${formatCurrency(amount, code)} advance credited`, "success");
    }
    setRequesting(false);
  };

  const progress =
    advance && advance.principal > 0
      ? ((advance.principal - advance.outstanding) / advance.principal) * 100
      : 0;

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: advance && advance.outstanding > 0
          ? "linear-gradient(180deg, rgba(14,165,233,0.04) 0%, #ffffff 100%)"
          : "#fff",
      }}
      aria-labelledby="advance-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${color}18`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ⚡
          </span>
          <div>
            <h2
              id="advance-heading"
              style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
            >
              Instant advance
            </h2>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
              Trust tier: <strong style={{ color }}>{tierLabel[trust.tier]}</strong> · score {trust.score}/100
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "4px 12px",
            borderRadius: 999,
            background: `${color}14`,
            color,
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          Limit: {formatCurrency(eligibility.limit, code, { decimals: 0 })}
        </div>
      </div>

      {eligibility.limit === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px dashed rgba(15,23,42,0.1)",
            background: "rgba(15,23,42,0.02)",
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          {eligibility.reason}. Protect creative work in QRight, play CyberChess, complete Planet
          tasks — your Trust Score grows, and so does your advance limit.
        </div>
      ) : !advance || advance.closedAt ? (
        <>
          <div
            style={{
              fontSize: 13,
              color: "#334155",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            {eligibility.reason}. Instant credit with auto-repayment from your incoming royalty /
            chess / Planet streams ({eligibility.rateLabel}).
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[0.25, 0.5, 1].map((frac) => {
              const amount = Math.round(eligibility.limit * frac);
              return (
                <button
                  key={frac}
                  onClick={() => doRequest(amount)}
                  disabled={requesting}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: requesting ? "#94a3b8" : `linear-gradient(135deg, ${color}, ${color}cc)`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: requesting ? "default" : "pointer",
                  }}
                >
                  {formatCurrency(amount, code, { decimals: 0 })}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>
            Tap an amount — money lands instantly via qtrade; auto-repays as earnings arrive.
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <MiniStat label="Principal" value={formatCurrency(advance.principal, code)} />
            <MiniStat
              label="Outstanding"
              value={formatCurrency(advance.outstanding, code)}
              accent={advance.outstanding === 0 ? "#059669" : color}
            />
            <MiniStat label="Repaid" value={formatCurrency(advance.principal - advance.outstanding, code)} accent="#059669" />
            <MiniStat label="Since" value={formatRelative(advance.startedAt)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "rgba(15,23,42,0.06)",
                overflow: "hidden",
              }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Advance repayment progress"
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: advance.outstanding === 0
                    ? "linear-gradient(90deg, #059669, #10b981)"
                    : `linear-gradient(90deg, ${color}, ${color}cc)`,
                  transition: "width 600ms ease",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              {progress.toFixed(1)}% repaid ·{" "}
              {advance.outstanding > 0
                ? "Auto-repayment active (1%/4s from royalty stream)"
                : "Fully repaid — request again anytime"}
            </div>
          </div>

          {advance.outstanding > 0 ? (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ display: "grid", gap: 4, flex: "1 1 140px" }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Manual repay AEC</span>
                <input
                  value={repayInput}
                  onChange={(e) => setRepayInput(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(15,23,42,0.15)",
                    fontSize: 13,
                    background: "#fff",
                  }}
                />
              </label>
              <button
                onClick={() => {
                  const n = parseFloat(repayInput);
                  if (!Number.isFinite(n) || n <= 0) {
                    notify("Invalid repay amount", "error");
                    return;
                  }
                  repayManual(n);
                  setRepayInput("");
                  notify(`Repaid ${formatCurrency(n, code)}`, "success");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "#fff",
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Repay
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                close();
                notify("Advance closed — you can request a new one", "info");
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "1px solid rgba(5,150,105,0.3)",
                background: "rgba(5,150,105,0.06)",
                color: "#047857",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Close & request new
            </button>
          )}

          {advance.repayments.length > 0 ? (
            <details>
              <summary
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                }}
              >
                Repayment history ({advance.repayments.length})
              </summary>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  marginTop: 8,
                  maxHeight: 140,
                  overflowY: "auto" as const,
                  display: "grid",
                  gap: 4,
                }}
              >
                {[...advance.repayments].reverse().map((r, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      background: r.kind === "manual" ? "rgba(15,23,42,0.04)" : "rgba(5,150,105,0.04)",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>
                      {r.kind === "auto" ? "Auto-repay" : "Manual repay"} · {formatRelative(r.at)}
                    </span>
                    <span style={{ color: "#059669", fontWeight: 700 }}>
                      −{formatCurrency(r.amount, code)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: accent || "#0f172a",
          letterSpacing: "-0.02em",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
