"use client";

// Inline fees & slippage settings — toggle + 3 bps inputs.
// Persists через svFees(); читается hot-reload-style через ldFees() при каждом
// market open / close в page.tsx (state не shared, так что hooks не нужны).

import { useEffect, useState } from "react";
import { ldFees, svFees, DEFAULT_FEES, type FeeConfig } from "./fees";

type Props = {
  onChange?: (cfg: FeeConfig) => void;
};

export default function FeesPanel({ onChange }: Props) {
  const [cfg, setCfg] = useState<FeeConfig>(DEFAULT_FEES);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setCfg(ldFees());
  }, []);

  useEffect(() => {
    svFees(cfg);
    onChange?.(cfg);
  }, [cfg, onChange]);

  const reset = () => setCfg(DEFAULT_FEES);

  const summary = cfg.enabled
    ? `M ${(cfg.makerBps / 100).toFixed(2)}% · T ${(cfg.takerBps / 100).toFixed(2)}% · Slip ${(cfg.slippageBps / 100).toFixed(2)}%`
    : "off · idealised fills";

  return (
    <section
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #1e293b",
        background: "rgba(15,23,42,0.65)",
        color: "#e2e8f0",
      }}
      aria-label="Trading fees and slippage settings"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: "#94a3b8", textTransform: "uppercase" }}>
          💸 Fees & Slippage
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            color: cfg.enabled ? "#86efac" : "#94a3b8",
            background: cfg.enabled ? "rgba(34,197,94,0.18)" : "rgba(148,163,184,0.12)",
            border: `1px solid ${cfg.enabled ? "rgba(34,197,94,0.45)" : "#334155"}`,
          }}
        >
          {summary}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#cbd5e1" }}>
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
              aria-label="Enable trading fees"
            />
            <span>Включить fees & slippage (применяется при market open/close)</span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <FeeInput
              label="Maker bps"
              hint="лимитные ордера"
              value={cfg.makerBps}
              onChange={(n) => setCfg((c) => ({ ...c, makerBps: n }))}
              disabled={!cfg.enabled}
            />
            <FeeInput
              label="Taker bps"
              hint="market-ордера"
              value={cfg.takerBps}
              onChange={(n) => setCfg((c) => ({ ...c, takerBps: n }))}
              disabled={!cfg.enabled}
            />
            <FeeInput
              label="Slippage bps"
              hint="entry/exit slip"
              value={cfg.slippageBps}
              onChange={(n) => setCfg((c) => ({ ...c, slippageBps: n }))}
              disabled={!cfg.enabled}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: "#94a3b8" }}>
            <button
              onClick={reset}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #334155",
                background: "transparent",
                color: "#cbd5e1",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reset → Binance USDM defaults (4 / 10 / 5 bps)
            </button>
            <span>1 bps = 0.01%. Fees вычитаются из realized P&L; slippage ухудшает execution price.</span>
          </div>
        </div>
      )}
    </section>
  );
}

function FeeInput({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, opacity: disabled ? 0.55 : 1 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: "#94a3b8", textTransform: "uppercase" }}>
        {label}
      </span>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        aria-label={label}
        style={{
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
        }}
      />
      <span style={{ fontSize: 10, color: "#64748b" }}>{hint}</span>
    </label>
  );
}
