"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import * as contactsLib from "../_lib/contacts";
import type { Contact } from "../_lib/contacts";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { formatRelative } from "../_lib/format";
import {
  appendGift,
  canCancelGift,
  GIFT_THEMES,
  GIFTS_EVENT,
  getTheme,
  loadGifts,
  readyToUnlockGifts,
  updateGiftStatus,
  type Gift,
  type GiftThemeId,
} from "../_lib/gifts";
import { buildGiftShareUrl } from "../_lib/giftLink";
import { inputStyle } from "./formPrimitives";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

type Props = {
  myAccountId: string;
  balance: number;
  send: (to: string, amount: number) => Promise<boolean>;
  notify: Notify;
};

async function copyShareLink(
  g: Gift,
  fromName: string | undefined,
  notify: Notify,
  t: (k: string, vars?: Record<string, string | number>) => string,
): Promise<void> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = buildGiftShareUrl(origin, g, fromName);
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      notify(t("gift.share.copied"), "success");
      return;
    }
    throw new Error("Clipboard unavailable");
  } catch {
    notify(t("gift.share.fallback", { url }), "info");
  }
}

export function GiftMode({ myAccountId, balance, send, notify }: Props) {
  const { t } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recipientId, setRecipientId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [themeId, setThemeId] = useState<GiftThemeId>("thanks");
  const [message, setMessage] = useState<string>("");
  const [unlockDate, setUnlockDate] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [history, setHistory] = useState<Gift[]>([]);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const { code } = useCurrency();
  const recipientRef = useRef<HTMLSelectElement | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    const cs = contactsLib.listContacts();
    setContacts(cs);
    if (cs.length > 0 && !recipientId) setRecipientId(cs[0].id);
    setHistory(loadGifts());
  }, [recipientId]);

  // Subscribe to gift changes + tick for countdown + auto-fire unlock.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setHistory(loadGifts());
    sync();
    window.addEventListener(GIFTS_EVENT, sync);
    window.addEventListener("focus", sync);
    const tick = async () => {
      setNowTick(Date.now());
      const ready = readyToUnlockGifts();
      for (const g of ready) {
        // Fire and forget — status transitions to "sent" only on successful
        // transfer; otherwise the gift stays pending for the next tick.
        try {
          const ok = await sendRef.current(g.recipientAccountId, g.amount);
          if (ok) {
            updateGiftStatus(g.id, { status: "sent", sentAt: new Date().toISOString() });
            notify(t("gift.notify.unlocked", { nickname: g.recipientNickname, amount: g.amount.toFixed(2) }), "success");
          }
        } catch {
          // Leave pending; surface quietly next tick.
        }
      }
    };
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.removeEventListener(GIFTS_EVENT, sync);
      window.removeEventListener("focus", sync);
      window.clearInterval(id);
    };
  }, [notify, t]);

  const theme = getTheme(themeId);
  const amountNum = parseFloat(amount);
  const recipient = contacts.find((c) => c.id === recipientId);

  const submit = async () => {
    if (!recipient) {
      notify(t("gift.notify.pickRecipient"), "error");
      return;
    }
    if (recipient.id === myAccountId) {
      notify(t("gift.notify.cannotGiftSelf"), "error");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      notify(t("gift.notify.invalidAmount"), "error");
      return;
    }
    if (amountNum > balance) {
      notify(t("gift.notify.insufficient"), "error");
      return;
    }
    if (!message.trim()) {
      notify(t("gift.notify.messageRequired"), "error");
      return;
    }

    // Timelocked variant: record as pending, don't transfer yet. Auto-fire
    // tick (every 30s) will send on unlockAt. Balance is NOT escrowed —
    // when unlock fires, a normal send() is attempted; if balance is
    // insufficient at that moment, the gift stays pending until balance
    // recovers (shown to the user as "awaiting balance" in UI).
    const unlockIso = unlockDate ? new Date(unlockDate).toISOString() : "";
    const unlockFuture = !!unlockIso && Date.parse(unlockIso) > Date.now();

    if (unlockFuture) {
      appendGift({
        id: `gift_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        recipientAccountId: recipient.id,
        recipientNickname: recipient.nickname,
        amount: amountNum,
        themeId,
        message: message.trim(),
        sentAt: new Date().toISOString(),
        unlockAt: unlockIso,
        status: "pending",
      });
      setHistory(loadGifts());
      setAmount("");
      setMessage("");
      setUnlockDate("");
      notify(t("gift.notify.scheduled", { date: new Date(unlockIso).toLocaleString() }), "success");
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
        status: "sent",
      });
      setHistory(loadGifts());
      setAmount("");
      setMessage("");
      notify(t("gift.notify.sent", { nickname: recipient.nickname }), "success");
    }
    setBusy(false);
  };

  const cancelPending = (g: Gift) => {
    if (!canCancelGift(g)) {
      notify(t("gift.notify.commitLock"), "info");
      return;
    }
    if (!confirm(t("gift.confirm.cancel", { nickname: g.recipientNickname }))) return;
    updateGiftStatus(g.id, { status: "cancelled" });
    notify(t("gift.notify.cancelled"), "info");
  };

  const pending = history.filter((g) => g.status === "pending");

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
            {t("gift.heading")}
          </h2>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {t("gift.subtitle")}
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
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{t("gift.field.recipient")}</span>
            <select
              ref={recipientRef}
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              style={inputStyle}
            >
              {contacts.length === 0 ? <option value="">{t("gift.field.recipient.empty")}</option> : null}
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{t("gift.field.amount")}</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder={t("gift.field.amount.placeholder")}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{t("gift.field.message")}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("gift.field.message.placeholder")}
              maxLength={200}
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                fontFamily: "inherit",
              }}
            />
            <span style={{ fontSize: 10, color: "#64748b", textAlign: "right" as const }}>
              {message.length}/200
            </span>
          </label>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>
              {t("gift.field.theme")}
            </div>
            <div
              role="radiogroup"
              aria-label={t("gift.field.theme.aria")}
              style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              {GIFT_THEMES.map((gt) => {
                const active = gt.id === themeId;
                return (
                  <button
                    key={gt.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setThemeId(gt.id)}
                    title={gt.label}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: active ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.12)",
                      background: gt.gradient,
                      color: gt.textColor,
                      fontSize: 16,
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: active ? "0 2px 8px rgba(15,23,42,0.2)" : "none",
                    }}
                  >
                    {gt.icon}
                  </button>
                );
              })}
            </div>
          </div>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
              {t("gift.field.unlock")} <span style={{ color: "#64748b", fontWeight: 600 }}>{t("gift.field.unlock.optional")}</span>
            </span>
            <input
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              type="datetime-local"
              style={inputStyle}
            />
            <span style={{ fontSize: 10, color: "#64748b" }}>
              {t("gift.field.unlock.hint")}
            </span>
          </label>
          <button
            onClick={submit}
            disabled={busy || contacts.length === 0}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background:
                busy || contacts.length === 0
                  ? "#94a3b8"
                  : unlockDate && Date.parse(new Date(unlockDate).toISOString()) > Date.now()
                    ? "linear-gradient(135deg, #7c3aed, #0ea5e9)"
                    : "linear-gradient(135deg, #db2777, #9d174d)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: busy || contacts.length === 0 ? "default" : "pointer",
            }}
          >
            {busy
              ? t("gift.btn.sending")
              : contacts.length === 0
                ? t("gift.btn.addContactFirst")
                : unlockDate && Date.parse(new Date(unlockDate).toISOString()) > Date.now()
                  ? t("gift.btn.scheduleTimelock")
                  : t("gift.btn.send")}
          </button>
        </div>

        <GiftPreview
          theme={theme.id}
          amount={Number.isFinite(amountNum) ? amountNum : 0}
          message={message || t("gift.preview.placeholder")}
          recipientNickname={recipient?.nickname || "—"}
          currencyCode={code}
        />
      </div>

      {pending.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#7c3aed",
              marginBottom: 8,
            }}
          >
            {t("gift.section.pending")}
          </div>
          <div
            style={{
              display: "grid",
              gap: 6,
            }}
          >
            {pending.map((g) => (
              <PendingGiftRow
                key={g.id}
                g={g}
                now={nowTick}
                onCancel={() => cancelPending(g)}
                onShare={() => void copyShareLink(g, myAccountId, notify, t)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {history.filter((g) => g.status !== "pending" && g.status !== "cancelled").length > 0 ? (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#64748b",
              marginBottom: 8,
            }}
          >
            {t("gift.section.sent")}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            {history
              .filter((g) => g.status !== "pending" && g.status !== "cancelled")
              .slice(0, 6)
              .map((g) => (
                <MiniGift
                  key={g.id}
                  g={g}
                  code={code}
                  onShare={() => void copyShareLink(g, myAccountId, notify, t)}
                />
              ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PendingGiftRow({
  g,
  now,
  onCancel,
  onShare,
}: {
  g: Gift;
  now: number;
  onCancel: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const unlockMs = g.unlockAt ? Date.parse(g.unlockAt) : 0;
  const remainingMs = Math.max(0, unlockMs - now);
  const sec = Math.floor(remainingMs / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const countdown = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  const canCancel = canCancelGift(g, now);
  const theme = getTheme(g.themeId);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "36px 1fr auto auto auto",
        gap: 10,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid rgba(124,58,237,0.25)",
        background: "rgba(124,58,237,0.05)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: theme.gradient,
          color: theme.textColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        {theme.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
          }}
        >
          {g.amount.toFixed(2)} AEC → {g.recipientNickname}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
          {t("gift.row.unlocks", { date: new Date(unlockMs).toLocaleString(), message: g.message.slice(0, 60) })}
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "#7c3aed",
          fontFamily: "ui-monospace, monospace",
          whiteSpace: "nowrap",
        }}
      >
        {countdown}
      </span>
      <button
        type="button"
        onClick={onShare}
        title={t("gift.row.share.title")}
        aria-label={t("gift.row.share.title")}
        style={{
          padding: "4px 8px",
          borderRadius: 7,
          border: "1px solid rgba(124,58,237,0.3)",
          background: "rgba(124,58,237,0.08)",
          color: "#7c3aed",
          fontSize: 10,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {t("gift.row.share")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={!canCancel}
        aria-disabled={!canCancel}
        title={canCancel ? t("gift.row.cancel.title") : t("gift.row.locked.title")}
        style={{
          padding: "4px 8px",
          borderRadius: 7,
          border: "1px solid rgba(15,23,42,0.15)",
          background: "#fff",
          color: canCancel ? "#334155" : "#94a3b8",
          fontSize: 10,
          fontWeight: 800,
          cursor: canCancel ? "pointer" : "not-allowed",
        }}
      >
        {canCancel ? t("gift.row.cancel") : t("gift.row.locked")}
      </button>
    </div>
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
  const { t } = useI18n();
  const gt = getTheme(theme);
  return (
    <div
      aria-label={t("gift.preview.aria")}
      style={{
        padding: 18,
        borderRadius: 14,
        background: gt.gradient,
        color: gt.textColor,
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
          background: `radial-gradient(circle, ${gt.accent}44 0%, transparent 70%)`,
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
          {gt.icon}
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
          {t("gift.preview.brand", { label: gt.label })}
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
        <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>{t("gift.preview.to", { nickname: recipientNickname })}</div>
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
  onShare,
}: {
  g: Gift;
  code: "AEC" | "USD" | "EUR" | "KZT";
  onShare: () => void;
}) {
  const { t: tr } = useI18n();
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
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={onShare}
        aria-label={tr("gift.row.share.title")}
        title={tr("gift.row.share.title")}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 26,
          height: 26,
          padding: 0,
          borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.45)",
          background: "rgba(255,255,255,0.18)",
          color: t.textColor,
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(2px)",
        }}
      >
        ⤴
      </button>
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

