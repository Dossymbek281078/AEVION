"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import type { Account } from "../_lib/types";

type Mode = "menu" | "topup" | "send" | "request";

export function QuickActionsFloater({
  account,
  send,
  topup,
  setActiveTab,
  notify,
}: {
  account: Account;
  send: (to: string, amount: number) => Promise<boolean>;
  topup: (amount: number) => Promise<boolean>;
  setActiveTab: (id: "overview" | "earn" | "send" | "grow" | "security") => void;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [amountStr, setAmountStr] = useState<string>("");
  const [toStr, setToStr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("menu");
        setAmountStr("");
        setToStr("");
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const reset = () => {
    setMode("menu");
    setAmountStr("");
    setToStr("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const onTopup = async () => {
    const amt = Number(amountStr);
    if (!Number.isFinite(amt) || amt <= 0) {
      notify(t("qaf.toast.invalid"), "error");
      return;
    }
    setBusy(true);
    try {
      const ok = await topup(amt);
      if (ok) close();
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    const amt = Number(amountStr);
    if (!Number.isFinite(amt) || amt <= 0) {
      notify(t("qaf.toast.invalid"), "error");
      return;
    }
    if (!toStr.trim()) {
      notify(t("qaf.toast.noTo"), "error");
      return;
    }
    setBusy(true);
    try {
      const ok = await send(toStr.trim(), amt);
      if (ok) close();
    } finally {
      setBusy(false);
    }
  };

  const goRequest = () => {
    setActiveTab("overview");
    if (typeof document !== "undefined") {
      const el = document.getElementById("bank-anchor-flow");
      // Send tab anchor — fall back gracefully
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    notify(t("qaf.toast.requestRouted"), "info");
    close();
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: 16,
        bottom: 88,
        zIndex: 70,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("qaf.toggleAria")}
        title={t("qaf.toggleAria")}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: open
            ? "linear-gradient(135deg, #dc2626, #f97316)"
            : "linear-gradient(135deg, #0ea5e9, #7c3aed)",
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(15,23,42,0.32)",
          fontSize: 24,
          fontWeight: 800,
          transform: open ? "rotate(45deg)" : "none",
          transition: "transform 200ms ease",
        }}
      >
        +
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 68,
            width: 280,
            maxWidth: "calc(100vw - 32px)",
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.1)",
            borderRadius: 14,
            boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
            padding: 14,
          }}
        >
          {mode === "menu" ? (
            <>
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
                {t("qaf.menuTitle")}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <ActionItem
                  icon="↑"
                  color="#dc2626"
                  label={t("qaf.send")}
                  hint={t("qaf.sendHint", { balance: formatCurrency(account.balance, code) })}
                  onClick={() => setMode("send")}
                />
                <ActionItem
                  icon="↓"
                  color="#059669"
                  label={t("qaf.topup")}
                  hint={t("qaf.topupHint")}
                  onClick={() => setMode("topup")}
                />
                <ActionItem
                  icon="QR"
                  color="#7c3aed"
                  label={t("qaf.request")}
                  hint={t("qaf.requestHint")}
                  onClick={goRequest}
                />
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                  {mode === "topup" ? t("qaf.topupTitle") : t("qaf.sendTitle")}
                </div>
                <button
                  onClick={reset}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#64748b",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ← {t("qaf.back")}
                </button>
              </div>
              {mode === "send" ? (
                <input
                  type="text"
                  placeholder={t("qaf.toPlaceholder")}
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  style={inputStyle}
                />
              ) : null}
              <input
                type="number"
                min="0"
                step="1"
                placeholder={t("qaf.amountPlaceholder")}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                style={{ ...inputStyle, marginTop: mode === "send" ? 6 : 0 }}
              />
              <button
                onClick={mode === "topup" ? onTopup : onSend}
                disabled={busy}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: busy
                    ? "#cbd5e1"
                    : "linear-gradient(135deg, #0d9488, #0ea5e9)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy
                  ? t("qaf.busy")
                  : mode === "topup"
                    ? t("qaf.topupCta")
                    : t("qaf.sendCta")}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ActionItem({
  icon,
  color,
  label,
  hint,
  onClick,
}: {
  icon: string;
  color: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(15,23,42,0.06)",
        background: `${color}06`,
        cursor: "pointer",
        textAlign: "left" as const,
        width: "100%",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: color,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{hint}</div>
      </div>
    </button>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  boxSizing: "border-box" as const,
};
