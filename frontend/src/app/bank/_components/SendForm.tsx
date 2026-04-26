"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { lookupAccountByEmail } from "../_lib/api";
import {
  AUTOPILOT_EVENT,
  loadConfig as loadAutopilotConfig,
} from "../_lib/autopilot";
import { useBiometric } from "../_lib/BiometricContext";
import * as contactsLib from "../_lib/contacts";
import type { Contact } from "../_lib/contacts";
import { FREEZE_EVENT, isFrozen, loadFreeze, secondsUntilSober } from "../_lib/freeze";
import { GIFTS_EVENT, timelockReserveWithin } from "../_lib/gifts";
import type { PaymentRequest } from "../_lib/paymentRequest";

type Props = {
  myId: string;
  balance: number;
  prefill?: PaymentRequest | null;
  onSend: (to: string, amount: number) => Promise<boolean>;
  onError: (msg: string) => void;
};

export function SendForm({ myId, balance, prefill, onSend, onError }: Props) {
  const { t } = useI18n();
  const { settings: bioSettings, guard: bioGuard } = useBiometric();
  const [to, setTo] = useState<string>(prefill?.to ?? "");
  const [amount, setAmount] = useState<string>(prefill?.amount ? String(prefill.amount) : "");
  const [nickname, setNickname] = useState<string>("");
  const [memo, setMemo] = useState<string>(prefill?.memo ?? "");
  const [busy, setBusy] = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [frozen, setFrozen] = useState<boolean>(false);
  const [timelockReserve, setTimelockReserve] = useState<number>(0);
  const [guardEnabled, setGuardEnabled] = useState<boolean>(false);
  const prefillSignature = prefill ? `${prefill.to}|${prefill.amount ?? ""}|${prefill.memo ?? ""}` : "";
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setContacts(contactsLib.listContacts());
  }, []);

  useEffect(() => {
    const sync = () => setFrozen(isFrozen());
    sync();
    window.addEventListener(FREEZE_EVENT, sync);
    return () => window.removeEventListener(FREEZE_EVENT, sync);
  }, []);

  useEffect(() => {
    const syncGuard = () => {
      const cfg = loadAutopilotConfig();
      const active = cfg.enabled && cfg.timelockGuard;
      setGuardEnabled(active);
      if (active) {
        setTimelockReserve(timelockReserveWithin(cfg.timelockGuardHr * 60 * 60 * 1000));
      } else {
        setTimelockReserve(0);
      }
    };
    syncGuard();
    // Tick once per minute to refresh the countdown-derived reserve.
    const id = window.setInterval(syncGuard, 60_000);
    window.addEventListener(GIFTS_EVENT, syncGuard);
    window.addEventListener(AUTOPILOT_EVENT, syncGuard);
    window.addEventListener("focus", syncGuard);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(GIFTS_EVENT, syncGuard);
      window.removeEventListener(AUTOPILOT_EVENT, syncGuard);
      window.removeEventListener("focus", syncGuard);
    };
  }, []);

  useEffect(() => {
    if (prefill?.to) setTo(prefill.to);
    if (prefill?.amount) setAmount(String(prefill.amount));
    if (prefill?.memo) setMemo(prefill.memo);
  }, [prefill, prefillSignature]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const existingContact = useMemo(
    () => contacts.find((c) => c.id === to.trim()),
    [contacts, to],
  );

  const submit = async () => {
    const rawTo = to.trim();
    const n = parseFloat(amount);
    if (!rawTo) {
      onError(t("send.error.recipient.empty"));
      return;
    }
    // Resolve email → accountId (acc_… ids are returned as-is by the resolver).
    let trimmedTo = rawTo;
    if (!rawTo.startsWith("acc_")) {
      if (!rawTo.includes("@")) {
        onError(t("send.error.recipient.format"));
        return;
      }
      setBusy(true);
      const resolved = await lookupAccountByEmail(rawTo);
      setBusy(false);
      if (!resolved) {
        onError(t("send.error.notFound"));
        return;
      }
      trimmedTo = resolved;
    }
    if (trimmedTo === myId) {
      onError(t("send.error.self"));
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      onError(t("send.error.amount"));
      return;
    }
    if (n > balance) {
      onError(t("send.error.funds"));
      return;
    }
    const fs = loadFreeze();
    if (fs) {
      const wait = secondsUntilSober(fs);
      onError(
        wait > 0
          ? t("send.error.frozen.wait", { wait })
          : t("send.error.frozen.unfreeze"),
      );
      return;
    }
    if (guardEnabled && timelockReserve > 0 && balance - n < timelockReserve) {
      onError(t("send.error.timelock", { amt: timelockReserve.toFixed(2) }));
      return;
    }
    setBusy(true);
    if (bioSettings && n >= bioSettings.threshold) {
      const allowed = await bioGuard(n);
      if (!allowed) {
        onError(t("send.error.bio"));
        setBusy(false);
        return;
      }
    }
    const ok = await onSend(trimmedTo, n);
    if (ok) {
      if (nickname.trim() && !existingContact) {
        contactsLib.saveContact(trimmedTo, nickname.trim());
      } else if (existingContact) {
        contactsLib.touchContact(trimmedTo);
      }
      setContacts(contactsLib.listContacts());
      setTo("");
      setAmount("");
      setNickname("");
      setMemo("");
    }
    setBusy(false);
  };

  const pickContact = (c: Contact) => {
    setTo(c.id);
    setShowPicker(false);
  };

  const deleteContact = (id: string) => {
    contactsLib.removeContact(id);
    setContacts(contactsLib.listContacts());
  };

  return (
    <section
      aria-label="Send"
      style={{
        border: frozen ? "1px solid rgba(220,38,38,0.35)" : "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        background: frozen ? "rgba(220,38,38,0.03)" : "#fff",
      }}
    >
      {frozen ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.25)",
            marginBottom: 12,
            fontSize: 12,
            color: "#991b1b",
            fontWeight: 700,
          }}
          role="alert"
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>
            🔒
          </span>
          {t("send.frozen.banner")}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 15 }}>{t("send.title")}</div>
        {contacts.length > 0 ? (
          <div style={{ position: "relative" as const }} ref={pickerRef}>
            <button
              onClick={() => setShowPicker((v) => !v)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {t("send.contacts.btn", { n: contacts.length })}
            </button>
            {showPicker ? (
              <div
                style={{
                  position: "absolute" as const,
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.12)",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                  zIndex: 10,
                  minWidth: 240,
                  maxHeight: 280,
                  overflowY: "auto" as const,
                }}
              >
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderBottom: "1px solid rgba(15,23,42,0.05)",
                    }}
                  >
                    <button
                      onClick={() => pickContact(c)}
                      style={{
                        flex: 1,
                        textAlign: "left" as const,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                        {c.nickname}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {c.id.slice(0, 12)}…
                      </div>
                    </button>
                    <button
                      onClick={() => deleteContact(c.id)}
                      title={t("send.contact.remove")}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: 4,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
            {t("send.recipient.label")}
          </div>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="acc_… or email@example.com"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 14,
              fontFamily: "ui-monospace, monospace",
            }}
          />
          {existingContact ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "#0f766e", fontWeight: 700 }}>
              {t("send.contact.known", { nickname: existingContact.nickname })}
            </div>
          ) : to.trim().startsWith("acc_") && to.trim().length > 10 ? (
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("send.contact.save.placeholder")}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.1)",
                fontSize: 12,
                background: "rgba(15,23,42,0.02)",
              }}
            />
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              {t("send.amount.label")}
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                fontSize: 14,
              }}
            />
          </div>
          <button
            onClick={() => void submit()}
            disabled={busy || frozen}
            aria-disabled={busy || frozen}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: busy || frozen ? "#94a3b8" : "#0f172a",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: busy || frozen ? "not-allowed" : "pointer",
              whiteSpace: "nowrap" as const,
            }}
            title={frozen ? t("send.frozen.tooltip") : undefined}
          >
            {frozen ? t("send.cta.frozen") : busy ? t("send.cta.sending") : t("send.cta.send")}
          </button>
        </div>
        {memo ? (
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              background: "rgba(124,58,237,0.05)",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(124,58,237,0.15)",
            }}
          >
            {t("send.memo.label")} <strong>{memo}</strong>
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>
        {t("send.footer.fee", { balance: balance.toFixed(2) })}
        {bioSettings ? t("send.footer.biom", { threshold: bioSettings.threshold }) : null}
        {guardEnabled && timelockReserve > 0 ? (
          <span style={{ color: "#7c3aed", fontWeight: 700 }}>
            {t("send.footer.timelock", { reserved: timelockReserve.toFixed(2) })}
          </span>
        ) : null}
      </div>
    </section>
  );
}
