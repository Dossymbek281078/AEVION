"use client";

import { useEffect, useRef, useState } from "react";
import * as contactsLib from "../_lib/contacts";
import type { Contact } from "../_lib/contacts";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { formatRelative } from "../_lib/format";
import {
  appendGift,
  GIFT_THEMES,
  getTheme,
  loadGifts,
  type Gift,
  type GiftThemeId,
} from "../_lib/gifts";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

type Props = {
  myAccountId: string;
  balance: number;
  send: (to: string, amount: number) => Promise<boolean>;
  notify: Notify;
};

export function GiftMode({ myAccountId, balance, send, notify }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recipientId, setRecipientId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [themeId, setThemeId] = useState<GiftThemeId>("thanks");
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [history, setHistory] = useState<Gift[]>([]);
  const { code } = useCurrency();
  const recipientRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    const cs = contactsLib.listContacts();
    setContacts(cs);
    if (cs.length > 0 && !recipientId) setRecipientId(cs[0].id);
    setHistory(loadGifts());
  }, [recipientId]);

  const theme = getTheme(themeId);
  const amountNum = parseFloat(amount);
  const recipient = contacts.find((c) => c.id === recipientId);

  const submit = async () => {
    if (!recipient) {
      notify("Pick a recipient", "error");
      return;
    }
    if (recipient.id === myAccountId) {
      notify("You can't gift yourself", "error");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      notify("Invalid amount", "error");
      return;
    }
    if (amountNum > balance) {
      notify("Insufficient funds", "error");
      return;
    }
    if (!message.trim()) {
      notify("Add a message to make it personal", "error");
      return;
    }

    setBusy(true);
    const ok = await send(recipient.id, amountNum);
    if (ok) {
      appendGift({
        id: `gift_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        recipientAccountId: recipient.id,
        recipientNickname: recipient.nickname,
        amount: amountNum,
        themeId,
        message: message.trim(),
        sentAt: new Date().toISOString(),
      });
      setHistory(loadGifts());
      setAmount("");
      setMessage("");
      notify(`Gift sent to ${recipient.nickname}`, "success");
    }
    setBusy(false);
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
      aria-labelledby="gift-heading"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(219,39,119,0.14)",
            color: "#be185d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 900,
          }}
        >
          ✦
        </span>
        <div>
          <h2 id="gift-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
            Gift mode
          </h2>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Send AEC with a custom card — birthdays, thanks, royalty splits.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Recipient</span>
            <select
              ref={recipientRef}
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              style={inputStyle}
            >
              {contacts.length === 0 ? <option value="">No contacts yet</option> : null}
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Amount AEC</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="25.00"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Happy birthday! Treat yourself ♫"
              maxLength={200}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" as const }}>
              {message.length}/200
            </span>
          </label>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>
              Theme
            </div>
            <div
              role="radiogroup"
              aria-label="Gift card theme"
              style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              {GIFT_THEMES.map((t) => {
                const active = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setThemeId(t.id)}
                    title={t.label}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: active ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.12)",
                      background: t.gradient,
                      color: t.textColor,
                      fontSize: 16,
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: active ? "0 2px 8px rgba(15,23,42,0.2)" : "none",
                    }}
                  >
                    {t.icon}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={submit}
            disabled={busy || contacts.length === 0}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: busy || contacts.length === 0 ? "#94a3b8" : "linear-gradient(135deg, #db2777, #9d174d)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: busy || contacts.length === 0 ? "default" : "pointer",
            }}
          >
            {busy ? "Sending…" : contacts.length === 0 ? "Add a contact first" : "Send gift"}
          </button>
        </div>

        <GiftPreview
          theme={theme.id}
          amount={Number.isFinite(amountNum) ? amountNum : 0}
          message={message || "Your message will appear here"}
          recipientNickname={recipient?.nickname || "—"}
          currencyCode={code}
        />
      </div>

      {history.length > 0 ? (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            Sent gifts
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            {history.slice(0, 6).map((g) => (
              <MiniGift key={g.id} g={g} code={code} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GiftPreview({
  theme,
  amount,
  message,
  recipientNickname,
  currencyCode,
}: {
  theme: GiftThemeId;
  amount: number;
  message: string;
  recipientNickname: string;
  currencyCode: "AEC" | "USD" | "EUR" | "KZT";
}) {
  const t = getTheme(theme);
  return (
    <div
      aria-label="Gift card preview"
      style={{
        padding: 18,
        borderRadius: 14,
        background: t.gradient,
        color: t.textColor,
        minHeight: 220,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative" as const,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute" as const,
          top: -30,
          right: -30,
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent}44 0%, transparent 70%)`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" as const }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          {t.icon}
        </span>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            opacity: 0.85,
          }}
        >
          {t.label} · AEVION gift
        </div>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.5,
          position: "relative" as const,
          maxHeight: 80,
          overflow: "hidden",
        }}
      >
        {message}
      </div>
      <div style={{ position: "relative" as const }}>
        <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>To {recipientNickname}</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            marginTop: 2,
          }}
        >
          {amount > 0 ? formatCurrency(amount, currencyCode) : "—"}
        </div>
      </div>
    </div>
  );
}

function MiniGift({
  g,
  code,
}: {
  g: Gift;
  code: "AEC" | "USD" | "EUR" | "KZT";
}) {
  const t = getTheme(g.themeId);
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: t.gradient,
        color: t.textColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 6,
        minHeight: 100,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          opacity: 0.85,
          textTransform: "uppercase" as const,
        }}
      >
        {t.icon} {t.label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.35,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}
      >
        {g.message}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 10, opacity: 0.8 }}>
          {g.recipientNickname} · {formatRelative(g.sentAt)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 900 }}>{formatCurrency(g.amount, code)}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  background: "#fff",
};
