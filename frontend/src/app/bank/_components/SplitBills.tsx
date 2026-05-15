"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSplits } from "../_hooks/useSplits";
import * as contactsLib from "../_lib/contacts";
import type { Contact } from "../_lib/contacts";
import { formatRelative } from "../_lib/format";
import { absoluteRequestUrl } from "../_lib/paymentRequest";
import { billStatus, splitEqually, type SplitBill } from "../_lib/splits";
import { btnSecondary, Field, inputStyle } from "./formPrimitives";
import { Money } from "./Money";

type Props = {
  myAccountId: string;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
};

export function SplitBills({ myAccountId, notify }: Props) {
  const { t } = useI18n();
  const { items, add, remove, togglePaid } = useSplits();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adHocId, setAdHocId] = useState<string>("");
  const [adHocNick, setAdHocNick] = useState<string>("");
  const [total, setTotal] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [customMode, setCustomMode] = useState<boolean>(false);
  const labelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setContacts(contactsLib.listContacts());
  }, [formOpen, items]);

  useEffect(() => {
    if (formOpen) labelRef.current?.focus();
  }, [formOpen]);

  const participants = useMemo(() => {
    const arr: Array<{ accountId: string; nickname: string }> = [];
    for (const c of contacts) {
      if (selectedIds.has(c.id)) arr.push({ accountId: c.id, nickname: c.nickname });
    }
    return arr;
  }, [contacts, selectedIds]);

  const resetForm = () => {
    setSelectedIds(new Set());
    setAdHocId("");
    setAdHocNick("");
    setTotal("");
    setLabel("");
    setCustomShares({});
    setCustomMode(false);
  };

  const addAdHoc = () => {
    const id = adHocId.trim();
    if (!id.startsWith("acc_")) {
      notify(t("split.toast.idPrefix"), "error");
      return;
    }
    if (id === myAccountId) {
      notify(t("split.toast.selfSplit"), "error");
      return;
    }
    const nick = adHocNick.trim() || id.slice(0, 10) + "…";
    if (!contacts.find((c) => c.id === id)) {
      contactsLib.saveContact(id, nick);
      setContacts(contactsLib.listContacts());
    }
    setSelectedIds((prev) => new Set([...prev, id]));
    setAdHocId("");
    setAdHocNick("");
  };

  const toggleParticipant = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalNum = parseFloat(total);
  const equalPreview = useMemo(() => {
    if (!Number.isFinite(totalNum) || totalNum <= 0 || participants.length === 0) return null;
    return splitEqually(totalNum, participants);
  }, [totalNum, participants]);

  const customTotal = useMemo(() => {
    let s = 0;
    for (const p of participants) {
      const v = parseFloat(customShares[p.accountId] ?? "");
      if (Number.isFinite(v)) s += v;
    }
    return s;
  }, [customShares, participants]);

  const save = () => {
    if (!label.trim()) {
      notify(t("split.toast.needName"), "error");
      return;
    }
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      notify(t("split.toast.invalidTotal"), "error");
      return;
    }
    if (participants.length === 0) {
      notify(t("split.toast.needParticipant"), "error");
      return;
    }
    let shares;
    if (customMode) {
      const parsed = participants.map((p) => {
        const v = parseFloat(customShares[p.accountId] ?? "");
        return { ...p, amount: Number.isFinite(v) && v >= 0 ? +v.toFixed(2) : 0 };
      });
      const sum = parsed.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(sum - totalNum) > 0.01) {
        notify(
          t("split.toast.customMismatch", { sum: sum.toFixed(2), total: totalNum.toFixed(2) }),
          "error",
        );
        return;
      }
      shares = parsed.map((p) => ({
        accountId: p.accountId,
        nickname: p.nickname,
        amount: p.amount,
        paid: false,
        paidAt: null,
      }));
    } else {
      shares = splitEqually(totalNum, participants);
    }
    add(label, totalNum, shares);
    notify(t("split.toast.created", { label, count: participants.length }), "success");
    resetForm();
    setFormOpen(false);
  };

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
      }}
      aria-labelledby="splits-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <h2
          id="splits-heading"
          style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
        >
          {t("split.title")}
          {items.length > 0 ? (
            <span
              style={{
                marginLeft: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(14,165,233,0.12)",
                color: "#0369a1",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {t("split.badge.open", { n: items.filter((b) => !billStatus(b).settled).length })}
            </span>
          ) : null}
        </h2>
        <button
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          aria-controls="split-form"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: formOpen ? "#64748b" : "linear-gradient(135deg, #0ea5e9, #0369a1)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {formOpen ? t("split.btn.cancel") : t("split.btn.new")}
        </button>
      </div>

      {formOpen ? (
        <div
          id="split-form"
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(14,165,233,0.2)",
            background: "rgba(14,165,233,0.04)",
            marginBottom: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field label={t("split.field.name")}>
              <input
                ref={labelRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("split.field.name.placeholder")}
                maxLength={60}
                style={inputStyle}
              />
            </Field>
            <Field label={t("split.field.total")}>
              <input
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                style={inputStyle}
              />
            </Field>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                {t("split.participants", { n: participants.length })}
              </span>
              <label style={{ fontSize: 11, color: "#334155", fontWeight: 700, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={customMode}
                  onChange={(e) => setCustomMode(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                {t("split.customAmounts")}
              </label>
            </div>
            {contacts.length === 0 ? (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {t("split.contacts.empty")}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 4, maxHeight: 180, overflowY: "auto" as const }}>
                {contacts.map((c) => {
                  const selected = selectedIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: selected ? "1px solid rgba(14,165,233,0.4)" : "1px solid rgba(15,23,42,0.08)",
                        background: selected ? "rgba(14,165,233,0.06)" : "#fff",
                      }}
                    >
                      <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer", minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleParticipant(c.id)}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                            flex: 1,
                          }}
                        >
                          {c.nickname}
                        </span>
                      </label>
                      {selected && customMode ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customShares[c.id] ?? ""}
                          onChange={(e) =>
                            setCustomShares((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          placeholder="0.00"
                          style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 12 }}
                          aria-label={t("split.aria.customShare", { nick: c.nickname })}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Field label={t("split.field.adhocId")}>
              <input
                value={adHocId}
                onChange={(e) => setAdHocId(e.target.value)}
                placeholder="acc_..."
                style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }}
              />
            </Field>
            <Field label={t("split.field.nickname")}>
              <input
                value={adHocNick}
                onChange={(e) => setAdHocNick(e.target.value)}
                placeholder={t("split.field.nickname.placeholder")}
                style={inputStyle}
              />
            </Field>
            <button onClick={addAdHoc} style={btnSecondary}>
              {t("split.btn.add")}
            </button>
          </div>

          {equalPreview && !customMode ? (
            <div style={{ fontSize: 12, color: "#334155" }}>
              {t("split.preview.equal.prefix")}<strong><Money aec={equalPreview[0].amount} /></strong>{t("split.preview.equal.suffix")}
            </div>
          ) : null}
          {customMode && participants.length > 0 ? (
            <div
              style={{
                fontSize: 12,
                color: Math.abs(customTotal - totalNum) < 0.01 ? "#059669" : "#dc2626",
                fontWeight: 700,
              }}
            >
              {t("split.preview.customTotal")}<Money aec={customTotal} /> / <Money aec={totalNum} />
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
              style={btnSecondary}
            >
              {t("split.btn.cancel")}
            </button>
            <button
              onClick={save}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #0ea5e9, #0369a1)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("split.btn.create")}
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#64748b",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
          }}
        >
          {t("split.list.empty")}
        </div>
      ) : (
        <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {items.map((b) => (
            <BillRow
              key={b.id}
              bill={b}
              myAccountId={myAccountId}
              onTogglePaid={(share) => togglePaid(b.id, share)}
              onRemove={() => {
                if (confirm(t("split.confirm.delete", { label: b.label }))) remove(b.id);
              }}
              notify={notify}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BillRow({
  bill,
  myAccountId,
  onTogglePaid,
  onRemove,
  notify,
}: {
  bill: SplitBill;
  myAccountId: string;
  onTogglePaid: (shareAccountId: string) => void;
  onRemove: () => void;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean>(false);
  const status = billStatus(bill);
  const progressPct = status.total > 0 ? (status.paid / status.total) * 100 : 0;
  const settled = status.settled;

  const copyLink = async (accountId: string, amount: number) => {
    const url = absoluteRequestUrl({ to: myAccountId, amount, memo: bill.label });
    try {
      await navigator.clipboard.writeText(url);
      notify(t("split.toast.linkCopied", { id: accountId.slice(0, 8) }), "success");
    } catch {
      notify(t("split.toast.clipboardBlocked"), "error");
    }
  };

  return (
    <li
      style={{
        border: `1px solid ${settled ? "rgba(5,150,105,0.25)" : "rgba(14,165,233,0.22)"}`,
        borderRadius: 12,
        background: settled ? "rgba(5,150,105,0.04)" : "#fff",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "center",
          padding: "12px 14px",
          border: "none",
          background: "transparent",
          textAlign: "left" as const,
          cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {bill.label}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
            <Money aec={bill.totalAec} /> · {status.paid}/{status.total} {t("split.row.paidSuffix")} · {formatRelative(bill.createdAt)}
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("split.aria.progress", { label: bill.label, paid: status.paid, total: status.total })}
            style={{
              height: 4,
              borderRadius: 999,
              background: "rgba(15,23,42,0.06)",
              overflow: "hidden",
              marginTop: 6,
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: settled ? "#059669" : "#0ea5e9",
                transition: "width 400ms ease",
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{open ? "▲" : "▼"}</div>
      </button>
      {open ? (
        <div
          style={{
            padding: "0 14px 14px",
            display: "grid",
            gap: 6,
          }}
        >
          {bill.shares.map((s) => (
            <div
              key={s.accountId}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto auto",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: s.paid ? "1px solid rgba(5,150,105,0.25)" : "1px solid rgba(15,23,42,0.08)",
                background: s.paid ? "rgba(5,150,105,0.04)" : "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={s.paid}
                onChange={() => onTogglePaid(s.accountId)}
                aria-label={t("split.aria.markPaid", { nick: s.nickname })}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {s.nickname}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {s.accountId.slice(0, 10)}…
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 13, color: s.paid ? "#059669" : "#0f172a" }}>
                <Money aec={s.amount} />
              </div>
              <button
                onClick={() => void copyLink(s.accountId, s.amount)}
                aria-label={t("split.aria.copyLink", { nick: s.nickname })}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                {t("split.btn.copyLink")}
              </button>
              {s.paid ? (
                <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>{t("split.row.statusPaid")}</span>
              ) : (
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{t("split.row.statusPending")}</span>
              )}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onRemove}
              aria-label={t("split.aria.deleteBill", { label: bill.label })}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(220,38,38,0.2)",
                background: "#fff",
                fontSize: 11,
                fontWeight: 700,
                color: "#991b1b",
                cursor: "pointer",
              }}
            >
              {t("split.btn.delete")}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
