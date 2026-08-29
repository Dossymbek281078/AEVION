"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, INTENT_LABEL, dealHeadline, startupxApi, usd, type DealIntent, type Listing } from "../lib";

/**
 * An investor's response. The old version collected an email and a message,
 * which made every reply a "let's talk" — the founder learned nothing and had
 * nothing to compare. This one asks for terms: what you want, how much you put
 * in, and for what share. A founder can rank those.
 */
export function InterestModal({
  listing,
  onClose,
  onSubmitted,
}: {
  listing: Listing;
  onClose: () => void;
  onSubmitted: (id: number) => void;
}) {
  const suggested = listing.assessment?.deal.ticket;
  const defaultIntent: DealIntent = listing.deal?.intent ?? "raise";

  const [intent, setIntent] = useState<DealIntent>(defaultIntent);
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState(suggested ? String(suggested.low) : "");
  const [equity, setEquity] = useState(
    listing.deal?.equityOfferedPct ? String(listing.deal.equityOfferedPct) : "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Диалог, который нельзя закрыть с клавиатуры, — ловушка: мышь есть не у
  // всех, а фокус после открытия оставался на кнопке под затемнением.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Фокус должен ходить по кругу внутри диалога: иначе Tab уводит на
      // страницу под затемнением, где всё видно, но ничего не нажимается —
      // человек, работающий с клавиатуры, оказывается в никуда.
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Стартовый фокус — ровно один раз на открытие. Раньше он стоял в эффекте с
  // зависимостью [onClose], а onClose приходит из родителя новой функцией на
  // каждый его рендер: всплывший тост или обновление ленты перебрасывали бы
  // курсор в поле почты посреди набора суммы.
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function submit() {
    if (!email.trim()) {
      setError("Укажите email — иначе основатель не сможет ответить.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await startupxApi.interest(listing.id, {
        investorEmail: email.trim(),
        message: message.trim() || undefined,
        intent,
        ticketUsd: Number(ticket) > 0 ? Number(ticket) : undefined,
        equityPct: Number(equity) > 0 ? Number(equity) : undefined,
      });
      onSubmitted(listing.id);
    } catch (e) {
      // Сервер присылает человеческий текст в issues (например, про адрес, по
      // которому нельзя ответить); показывать вместо него код ошибки —
      // значит заставлять инвестора гадать.
      const human = e instanceof ApiError ? e.issues[0]?.message ?? null : null;
      setError(human ?? (e instanceof ApiError ? e.message : "Не удалось отправить отклик."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Предложение по заявке «${listing.title}»`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 22,
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
          Предложение по «{listing.title}»
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#64748b" }}>
          Основатель просит: {dealHeadline(listing.deal)}
          {suggested && ` · ориентир чека ${usd(suggested.low)} – ${usd(suggested.high)}`}
        </p>

        <SmallLabel>Что предлагаете</SmallLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(["raise", "sell_stake", "sell_full"] as DealIntent[]).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIntent(i)}
              style={{
                padding: "6px 11px",
                borderRadius: 8,
                border: `1px solid ${intent === i ? "#0f172a" : "#e2e8f0"}`,
                background: intent === i ? "#0f172a" : "#fff",
                color: intent === i ? "#fff" : "#475569",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {i === "raise" ? "Вложить за долю" : i === "sell_stake" ? "Выкупить долю" : "Купить целиком"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <SmallLabel>Ваш чек, USD</SmallLabel>
            <input aria-label="Ваш чек в долларах" value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="30000" style={input} inputMode="numeric" />
          </div>
          <div>
            <SmallLabel>Ожидаемая доля, %</SmallLabel>
            <input aria-label="Ожидаемая доля в процентах" value={equity} onChange={(e) => setEquity(e.target.value)} placeholder="15" style={input} inputMode="decimal" />
          </div>
        </div>

        <SmallLabel>Ваш email</SmallLabel>
        <input ref={emailRef} aria-label="Ваш email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="investor@fund.com" style={input} type="email" />

        <SmallLabel>Сообщение (необязательно)</SmallLabel>
        <textarea
          aria-label="Сообщение основателю"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Что вам понравилось и что хотите уточнить"
          style={{ ...input, resize: "vertical" }}
        />

        {error && <p style={{ color: "#dc2626", fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>}

        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "#64748b", lineHeight: 1.5 }}>
          Отклик — не оферта и не обязательство. Это заявка на разговор с названными условиями, чтобы
          основатель понимал, о чём речь, до первого письма. {INTENT_LABEL[intent]}.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: busy ? "#64748b" : "#0f172a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: busy ? "wait" : "pointer" }}
          >
            {busy ? "Отправляю…" : "Отправить основателю"}
          </button>
        </div>
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid #e2e8f0",
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "#0f172a",
  marginBottom: 10,
  boxSizing: "border-box",
};

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{children}</div>;
}
