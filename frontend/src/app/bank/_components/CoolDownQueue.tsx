"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  activeItems,
  COOLDOWN_EVENT,
  DEFAULT_HOLD_HOURS,
  HOLD_OPTIONS,
  loadCoolDown,
  newItem,
  refreshStatus,
  saveCoolDown,
  timeRemaining,
  totalHeld,
  type CoolDownItem,
  type HoldHours,
} from "../_lib/coolDown";
import { InfoTooltip } from "./InfoTooltip";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

export function CoolDownQueue({
  myAccountId,
  send,
  notify,
}: {
  myAccountId: string;
  send: (to: string, amount: number) => Promise<boolean>;
  notify: Notify;
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [items, setItems] = useState<CoolDownItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const reload = () => setItems(refreshStatus(loadCoolDown()));
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(COOLDOWN_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(COOLDOWN_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  // Tick every minute so the countdown updates and items flip waiting → ready.
  useEffect(() => {
    const id = window.setInterval(() => {
      const refreshed = refreshStatus(loadCoolDown());
      setItems(refreshed);
      tick((n) => (n + 1) % 1024);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => activeItems(items), [items]);
  const released = useMemo(
    () => items.filter((i) => i.status === "released" || i.status === "cancelled").slice(-3),
    [items],
  );
  const held = totalHeld(items);

  const cancel = (id: string) => {
    const updated = items.map((i) =>
      i.id === id ? { ...i, status: "cancelled" as const, cancelledAt: new Date().toISOString() } : i,
    );
    saveCoolDown(updated);
    setItems(updated);
    notify(t("cooldown.toast.cancelled"), "info");
  };

  const release = async (item: CoolDownItem) => {
    if (item.status !== "ready") return;
    if (item.to.trim() === myAccountId) {
      notify(t("cooldown.toast.selfPay"), "error");
      return;
    }
    const ok = await send(item.to.trim(), item.amount);
    if (!ok) return;
    const updated = items.map((i) =>
      i.id === item.id ? { ...i, status: "released" as const, releasedOpId: null } : i,
    );
    saveCoolDown(updated);
    setItems(updated);
    notify(t("cooldown.toast.released"), "success");
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("cooldown.title")}</div>
            <InfoTooltip text={t("cooldown.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("cooldown.subtitle")}
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: showForm ? "#0f172a" : "transparent",
            color: showForm ? "#fff" : "#0f172a",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {showForm ? t("cooldown.cancel") : `+ ${t("cooldown.add")}`}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        <Stat label={t("cooldown.statHeld")} value={formatCurrency(held, code)} accent="#d97706" />
        <Stat label={t("cooldown.statQueue")} value={String(active.length)} accent="#0d9488" />
      </div>

      {showForm ? (
        <CoolDownForm
          onCancel={() => setShowForm(false)}
          onCreate={(it) => {
            const updated = [...items, it];
            saveCoolDown(updated);
            setItems(updated);
            setShowForm(false);
            notify(
              t("cooldown.toast.created", {
                label: it.label,
                hours: Math.round((new Date(it.releaseAt).getTime() - new Date(it.createdAt).getTime()) / 3600_000),
              }),
              "info",
            );
          }}
        />
      ) : null}

      {active.length === 0 ? (
        <div
          style={{
            padding: 18,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            background: "rgba(217,119,6,0.05)",
            borderRadius: 12,
            marginTop: showForm ? 12 : 0,
          }}
        >
          {t("cooldown.empty")}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: showForm ? 12 : 0 }}>
          {active.map((it) => (
            <ActiveRow
              key={it.id}
              item={it}
              code={code}
              onCancel={() => cancel(it.id)}
              onRelease={() => void release(it)}
            />
          ))}
        </div>
      )}

      {released.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div style={sectionHeaderStyle}>{t("cooldown.history")}</div>
          <div style={{ display: "grid", gap: 4 }}>
            {released.slice().reverse().map((it) => (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#64748b",
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(15,23,42,0.03)",
                }}
              >
                <span>
                  {it.status === "released" ? "✓" : "✕"} {it.label} · {it.status === "released" ? t("cooldown.released") : t("cooldown.cancelled")}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(it.amount, code)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ActiveRow({
  item,
  code,
  onCancel,
  onRelease,
}: {
  item: CoolDownItem;
  code: ReturnType<typeof useCurrency>["code"];
  onCancel: () => void;
  onRelease: () => void;
}) {
  const { t } = useI18n();
  const remaining = timeRemaining(item);
  const ready = item.status === "ready";
  const totalHours = Math.round((new Date(item.releaseAt).getTime() - new Date(item.createdAt).getTime()) / 3600_000);
  const elapsed = totalHours * 3600_000 - remaining.ms;
  const pct = totalHours > 0 ? Math.min(100, (elapsed / (totalHours * 3600_000)) * 100) : 100;
  const accent = ready ? "#059669" : "#d97706";

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: ready ? "rgba(5,150,105,0.05)" : "#fff",
        border: `1px solid ${accent}33`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>
            ⏳ {item.label}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
            → {item.to.length > 22 ? item.to.slice(0, 14) + "…" + item.to.slice(-4) : item.to}
          </div>
          {item.reason ? (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontStyle: "italic" }}>
              "{item.reason}"
            </div>
          ) : null}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(item.amount, code)}
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: 0.5, textTransform: "uppercase" as const, marginTop: 2 }}>
            {ready ? t("cooldown.statusReady") : t("cooldown.timeRemain", { h: remaining.hours, m: remaining.minutes })}
          </div>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(15,23,42,0.06)", overflow: "hidden", marginBottom: 8 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: accent,
            transition: "width 240ms ease",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnSecondary}>
          {t("cooldown.cancelItem")}
        </button>
        {ready ? (
          <button onClick={onRelease} style={btnPrimary}>
            {t("cooldown.releaseNow")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CoolDownForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (it: CoolDownItem) => void;
}) {
  const { t } = useI18n();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState<HoldHours>(DEFAULT_HOLD_HOURS);

  const submit = () => {
    const amt = Number(amount);
    if (!to.trim() || !label.trim() || !Number.isFinite(amt) || amt <= 0) return;
    onCreate(
      newItem({
        to: to.trim(),
        amount: amt,
        label: label.trim(),
        reason: reason.trim(),
        holdHours: hours,
      }),
    );
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(217,119,6,0.05)",
        border: "1px solid rgba(217,119,6,0.2)",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <input
          placeholder={t("cooldown.field.label")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder={t("cooldown.field.to")}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }}
        />
        <input
          type="number"
          min="0"
          placeholder={t("cooldown.field.amount")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={inputStyle}
        />
        <textarea
          placeholder={t("cooldown.field.reason")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" as const }}
        />
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>
            {t("cooldown.field.hold")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {HOLD_OPTIONS.map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: hours === h ? "#0f172a" : "#fff",
                  color: hours === h ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>
          {t("cooldown.cancel")}
        </button>
        <button onClick={submit} style={btnPrimary}>
          {t("cooldown.queue")}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${accent}33`,
        background: `${accent}0d`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: accent,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  boxSizing: "border-box" as const,
};

const btnPrimary = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #d97706, #f97316)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const btnSecondary = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "#fff",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const sectionHeaderStyle = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  marginBottom: 6,
} as const;

const containerStyle = {
  border: "1px solid rgba(217,119,6,0.2)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(217,119,6,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 4,
  gap: 12,
  flexWrap: "wrap" as const,
};
