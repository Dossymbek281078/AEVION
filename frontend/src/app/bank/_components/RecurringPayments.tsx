"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useRecurring } from "../_hooks/useRecurring";
import * as contactsLib from "../_lib/contacts";
import {
  formatCountdown,
  formatPast,
  type RecurrencePeriod,
  type Recurring,
} from "../_lib/recurring";
import { Field, inputStyle } from "./formPrimitives";
import { Money } from "./Money";

type Props = {
  myAccountId: string;
  balance: number;
  send: (to: string, amount: number) => Promise<boolean>;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
};

const PERIOD_OPTIONS: RecurrencePeriod[] = ["daily", "weekly", "biweekly", "monthly"];

function periodKey(p: RecurrencePeriod): string {
  return `period.${p}`;
}

function todayLocalISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function RecurringPayments({ myAccountId, balance, send, notify }: Props) {
  const { t } = useI18n();
  const { items, add, remove, toggle } = useRecurring({ send, notify });
  const [formOpen, setFormOpen] = useState<boolean>(false);

  const [to, setTo] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [period, setPeriod] = useState<RecurrencePeriod>("monthly");
  const [label, setLabel] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>(todayLocalISO());
  const toInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (formOpen) toInputRef.current?.focus();
  }, [formOpen]);

  const reset = () => {
    setTo("");
    setNickname("");
    setAmount("");
    setPeriod("monthly");
    setLabel("");
    setStartsAt(todayLocalISO());
  };

  const save = () => {
    const trimmedTo = to.trim();
    const n = parseFloat(amount);
    if (!trimmedTo.startsWith("acc_")) {
      notify(t("rec.toast.recipient"), "error");
      return;
    }
    if (trimmedTo === myAccountId) {
      notify(t("rec.toast.self"), "error");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      notify(t("rec.toast.amount"), "error");
      return;
    }
    if (!label.trim()) {
      notify(t("rec.toast.label"), "error");
      return;
    }
    const starts = new Date(startsAt);
    if (Number.isNaN(starts.getTime())) {
      notify(t("rec.toast.startDate"), "error");
      return;
    }
    const finalNick = nickname.trim() || contactsLib.contactsById().get(trimmedTo) || "";
    add({
      toAccountId: trimmedTo,
      recipientNickname: finalNick,
      amount: n,
      period,
      label: label.trim(),
      startsAt: starts.toISOString(),
    });
    notify(t("rec.toast.scheduled", { label: label.trim() }), "success");
    reset();
    setFormOpen(false);
  };

  const activeCount = items.filter((i) => i.active).length;

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        background: "#fff",
      }}
      aria-labelledby="recurring-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2
            id="recurring-heading"
            style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
          >
            {t("rec.title")}
          </h2>
          {items.length > 0 ? (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(13,148,136,0.12)",
                color: "#0f766e",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {t("rec.status.activePaused", {
                active: activeCount,
                paused: items.length - activeCount,
              })}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          aria-controls="recurring-form"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: formOpen ? "#64748b" : "#0f172a",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {formOpen ? t("rec.cancel") : t("rec.add")}
        </button>
      </div>

      {formOpen ? (
        <div
          id="recurring-form"
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(13,148,136,0.2)",
            background: "rgba(13,148,136,0.04)",
            marginBottom: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <Field label={t("rec.field.label")}>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("rec.field.label.placeholder")}
                maxLength={60}
                style={inputStyle}
              />
            </Field>
            <Field label={t("rec.field.recipient")}>
              <input
                ref={toInputRef}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="acc_..."
                style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }}
              />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Field label={t("rec.field.nickname")}>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("rec.field.nickname.placeholder")}
                maxLength={40}
                style={inputStyle}
              />
            </Field>
            <Field label={t("rec.field.amount")}>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                style={inputStyle}
              />
            </Field>
            <Field label={t("rec.field.period")}>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as RecurrencePeriod)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {t(periodKey(p))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("rec.field.startsAt")}>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                reset();
                setFormOpen(false);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                color: "#334155",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("rec.cancel")}
            </button>
            <button
              onClick={save}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("rec.save")}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {t("rec.balance.label")} <Money aec={balance} /> · {t("rec.balance.hint")}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#94a3b8",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
          }}
        >
          {t("rec.empty")}
        </div>
      ) : (
        <ul
          role="list"
          style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}
        >
          {items.map((r) => (
            <RecurringRow key={r.id} r={r} onToggle={toggle} onRemove={remove} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecurringRow({
  r,
  onToggle,
  onRemove,
}: {
  r: Recurring;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useI18n();
  const shortTo = r.toAccountId.length > 12 ? `${r.toAccountId.slice(0, 8)}…${r.toAccountId.slice(-4)}` : r.toAccountId;
  const color = r.active ? "#0f766e" : "#94a3b8";
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${r.active ? "rgba(13,148,136,0.25)" : "rgba(15,23,42,0.08)"}`,
        background: r.active ? "rgba(13,148,136,0.04)" : "rgba(15,23,42,0.02)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {r.label}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              color,
            }}
          >
            {r.active ? t("rec.row.active") : t("rec.row.paused")}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>
          <Money aec={r.amount} /> · {t(periodKey(r.period))}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
          {t("rec.row.toLabel")} {r.recipientNickname ? <strong>{r.recipientNickname}</strong> : <code style={{ fontFamily: "ui-monospace, monospace" }}>{shortTo}</code>}
          {" · "}
          {r.active ? t("rec.row.next", { when: formatCountdown(r.nextRunAt, t) }) : t("rec.row.pausedShort")}
          {" · "}
          {formatPast(r.lastRunAt, t)} · {t("rec.row.runs", { n: r.runs })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => onToggle(r.id)}
          aria-label={t(r.active ? "rec.aria.pause" : "rec.aria.resume", { label: r.label })}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            fontSize: 11,
            fontWeight: 700,
            color: "#334155",
            cursor: "pointer",
          }}
        >
          {r.active ? t("rec.btn.pause") : t("rec.btn.resume")}
        </button>
        <button
          onClick={() => {
            if (confirm(t("rec.confirm.delete", { label: r.label }))) onRemove(r.id);
          }}
          aria-label={t("rec.aria.delete", { label: r.label })}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(220,38,38,0.2)",
            background: "#fff",
            fontSize: 11,
            fontWeight: 700,
            color: "#991b1b",
            cursor: "pointer",
          }}
        >
          {t("rec.btn.delete")}
        </button>
      </div>
    </li>
  );
}

