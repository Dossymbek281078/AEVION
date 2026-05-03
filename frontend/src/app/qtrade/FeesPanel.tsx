"use client";

// Inline fees & slippage settings — toggle + 3 bps inputs.
// Persists через svFees(); читается hot-reload-style через ldFees() при каждом
// market open / close в page.tsx (state не shared, так что hooks не нужны).

import { useEffect, useState } from "react";
import { ldFees, svFees, DEFAULT_FEES, todayRealizedPnl, type FeeConfig, type PairFeeOverride } from "./fees";
import { fmtUsd, type ClosedPosition, type PairId } from "./marketSim";

const PAIRS: PairId[] = ["AEV/USD", "BTC/USD", "ETH/USD", "SOL/USD"];

type Props = {
  onChange?: (cfg: FeeConfig) => void;
  closed?: ClosedPosition[];
};

export default function FeesPanel({ onChange, closed = [] }: Props) {
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

  const cap = cfg.dailyLossLimitUsd ?? 0;
  const todayPnl = todayRealizedPnl(closed);
  const usagePct = cap > 0 && todayPnl < 0 ? Math.min(100, (-todayPnl / cap) * 100) : 0;
  const usageColor = usagePct >= 100 ? "#f87171" : usagePct >= 75 ? "#fbbf24" : "#86efac";
  const showRisk = cfg.enabled && cap > 0;

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
        {showRisk && (
          <span
            style={{
              marginLeft: 6,
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
              color: usageColor,
              background: `${usageColor}1f`,
              border: `1px solid ${usageColor}66`,
            }}
            title={`Сегодня: ${todayPnl >= 0 ? "+" : ""}${fmtUsd(todayPnl)} · cap ${fmtUsd(cap)}`}
          >
            🛡 {todayPnl >= 0 ? "+" : ""}{fmtUsd(todayPnl)} · {usagePct.toFixed(0)}%
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{open ? "▾" : "▸"}</span>
      </div>

      {showRisk && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }} aria-label="Daily loss usage">
          <div
            style={{
              position: "relative",
              height: 6,
              borderRadius: 3,
              background: "rgba(148,163,184,0.18)",
              overflow: "hidden",
            }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usagePct)}
          >
            <div
              style={{
                width: `${usagePct}%`,
                height: "100%",
                background: usageColor,
                transition: "width 0.3s, background 0.3s",
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
            <span>Today: {todayPnl >= 0 ? "+" : ""}{fmtUsd(todayPnl)}</span>
            <span>Cap: {fmtUsd(cap)} · usage {usagePct.toFixed(0)}%</span>
          </div>
        </div>
      )}

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
            <FeeInput
              label="Daily-loss USD"
              hint="0 = без лимита"
              value={cfg.dailyLossLimitUsd ?? 0}
              onChange={(n) => setCfg((c) => ({ ...c, dailyLossLimitUsd: n }))}
              disabled={!cfg.enabled}
            />
          </div>

          {cfg.enabled && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.40)",
                color: "#d8b4fe",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ✨ Promo: <strong>AEV/USD</strong> maker fee = <strong>0%</strong> (native pair)
            </div>
          )}

          {cfg.enabled && (
            <PairOverridesEditor
              cfg={cfg}
              onChange={(next) => setCfg(next)}
            />
          )}

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

// Per-pair overrides — collapsible sub-section. User-defined makerBps / takerBps /
// slippageBps по-pair переопределяют глобальные ставки и system promo.
function PairOverridesEditor({
  cfg,
  onChange,
}: {
  cfg: FeeConfig;
  onChange: (next: FeeConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const overrides = cfg.pairOverrides ?? {};
  const activeCount = Object.values(overrides).reduce(
    (acc, o) => acc + (o ? Object.keys(o).length : 0),
    0,
  );

  const update = (pair: PairId, field: keyof PairFeeOverride, raw: string) => {
    const trimmed = raw.trim();
    const cur = { ...(overrides[pair] ?? {}) } as PairFeeOverride;
    if (trimmed === "") {
      delete cur[field];
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) return;
      cur[field] = n;
    }
    const nextPairOverrides: NonNullable<FeeConfig["pairOverrides"]> = { ...overrides };
    if (Object.keys(cur).length > 0) nextPairOverrides[pair] = cur;
    else delete nextPairOverrides[pair];
    onChange({
      ...cfg,
      pairOverrides: Object.keys(nextPairOverrides).length > 0 ? nextPairOverrides : undefined,
    });
  };

  const clearAll = () => onChange({ ...cfg, pairOverrides: undefined });

  return (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        background: "rgba(15,23,42,0.55)",
        border: "1px solid #334155",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          userSelect: "none",
          fontSize: 11,
          fontWeight: 800,
          color: "#94a3b8",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        <span>🎚 Per-pair overrides</span>
        <span
          style={{
            padding: "1px 7px",
            borderRadius: 999,
            fontSize: 10,
            color: activeCount > 0 ? "#67e8f9" : "#64748b",
            background: activeCount > 0 ? "rgba(34,211,238,0.15)" : "rgba(148,163,184,0.10)",
            border: `1px solid ${activeCount > 0 ? "rgba(34,211,238,0.35)" : "#334155"}`,
          }}
        >
          {activeCount} active
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "70px repeat(3, 1fr)",
              gap: 6,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.4,
              color: "#94a3b8",
              textTransform: "uppercase",
            }}
          >
            <span>Pair</span>
            <span>Maker</span>
            <span>Taker</span>
            <span>Slip</span>
          </div>
          {PAIRS.map((pair) => {
            const o = overrides[pair] ?? {};
            return (
              <div
                key={pair}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px repeat(3, 1fr)",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", fontFamily: "ui-monospace, monospace" }}>{pair}</span>
                <OverrideInput
                  value={o.makerBps}
                  onChange={(v) => update(pair, "makerBps", v)}
                  ariaLabel={`${pair} maker bps override`}
                  placeholder="default"
                />
                <OverrideInput
                  value={o.takerBps}
                  onChange={(v) => update(pair, "takerBps", v)}
                  ariaLabel={`${pair} taker bps override`}
                  placeholder="default"
                />
                <OverrideInput
                  value={o.slippageBps}
                  onChange={(v) => update(pair, "slippageBps", v)}
                  ariaLabel={`${pair} slippage bps override`}
                  placeholder="default"
                />
              </div>
            );
          })}
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              style={{
                alignSelf: "flex-start",
                padding: "3px 9px",
                borderRadius: 4,
                border: "1px solid #334155",
                background: "transparent",
                color: "#cbd5e1",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear all overrides
            </button>
          )}
          <span style={{ fontSize: 10, color: "#64748b" }}>
            Empty cell ⇒ глобальная ставка (плюс promo для AEV/USD maker = 0). Override побеждает promo.
          </span>
        </div>
      )}
    </div>
  );
}

function OverrideInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  value: number | undefined;
  onChange: (raw: string) => void;
  ariaLabel: string;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{
        padding: "4px 8px",
        borderRadius: 4,
        border: "1px solid #334155",
        background: "#0f172a",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        width: "100%",
        fontFamily: "ui-monospace, monospace",
      }}
    />
  );
}
