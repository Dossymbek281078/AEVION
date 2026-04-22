"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBiometric } from "../_lib/BiometricContext";
import * as contactsLib from "../_lib/contacts";
import type { Contact } from "../_lib/contacts";
import type { PaymentRequest } from "../_lib/paymentRequest";

type Props = {
  myId: string;
  balance: number;
  prefill?: PaymentRequest | null;
  onSend: (to: string, amount: number) => Promise<boolean>;
  onError: (msg: string) => void;
};

export function SendForm({ myId, balance, prefill, onSend, onError }: Props) {
  const { settings: bioSettings, guard: bioGuard } = useBiometric();
  const [to, setTo] = useState<string>(prefill?.to ?? "");
  const [amount, setAmount] = useState<string>(prefill?.amount ? String(prefill.amount) : "");
  const [nickname, setNickname] = useState<string>("");
  const [memo, setMemo] = useState<string>(prefill?.memo ?? "");
  const [busy, setBusy] = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const prefillSignature = prefill ? `${prefill.to}|${prefill.amount ?? ""}|${prefill.memo ?? ""}` : "";
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setContacts(contactsLib.listContacts());
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
    const trimmedTo = to.trim();
    const n = parseFloat(amount);
    if (!trimmedTo) {
      onError("Enter recipient account ID");
      return;
    }
    if (!trimmedTo.startsWith("acc_")) {
      onError("Recipient must be an account ID (acc_...)");
      return;
    }
    if (trimmedTo === myId) {
      onError("Cannot send to yourself");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      onError("Invalid amount");
      return;
    }
    if (n > balance) {
      onError("Insufficient funds");
      return;
    }
    setBusy(true);
    if (bioSettings && n >= bioSettings.threshold) {
      const allowed = await bioGuard(n);
      if (!allowed) {
        onError("Biometric verification cancelled or failed");
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
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        background: "#fff",
      }}
    >
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
        <div style={{ fontWeight: 900, fontSize: 15 }}>Send AEC</div>
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
              Contacts ({contacts.length})
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
                      title="Remove"
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
            Recipient account ID
          </div>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="acc_..."
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
              Known contact: {existingContact.nickname}
            </div>
          ) : to.trim().startsWith("acc_") && to.trim().length > 10 ? (
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Save as contact (nickname, optional)"
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
              Amount AEC
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
            disabled={busy}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: busy ? "#94a3b8" : "#0f172a",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: busy ? "default" : "pointer",
              whiteSpace: "nowrap" as const,
            }}
          >
            {busy ? "Sending…" : "Send"}
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
            Memo: <strong>{memo}</strong>
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>
        Fee 0.1% · Instant · Available: {balance.toFixed(2)} AEC
        {bioSettings ? <> · Biometric required ≥ {bioSettings.threshold} AEC</> : null}
      </div>
    </section>
  );
}
