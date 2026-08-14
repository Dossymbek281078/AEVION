"use client";

/**
 * Приём почты на публичных страницах платформы.
 *
 * Зачем отдельный компонент: замер 14.08.2026 показал, что на главной, на /go
 * и на /pricing не было НИ ОДНОГО поля для адреса — весь пришедший трафик
 * уходил, не оставляя следа, и во всей системе накопилось 3 подписчика.
 *
 * Пишет в уже работающую на проде ручку `POST /api/constitution/waitlist/subscribe`
 * (таблица `constitution_waitlist`, дедупликация по адресу, подтверждающее
 * письмо через Brevo). Своего хранилища НЕ заводит: второй способ делать то же
 * самое стоит дороже, чем поле `source`, по которому потом видно, с какой
 * страницы пришёл человек.
 *
 * Отказ показывается отказом. Форма бюро до 11.08 писала адрес в localStorage,
 * ждала 600 мс и печатала зелёное «You're on the waitlist!» — человек уходил
 * уверенным, что подписался, а адреса не было нигде. Здесь успех показывается
 * только на ответ сервера, и у каждого класса отказа свой текст.
 */

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type Status = "idle" | "sending" | "done" | "error";

export type WaitlistCaptureProps = {
  /** Помечает страницу-источник: видно в выгрузке, максимум 60 символов (схема сервера). */
  source: string;
  title?: string;
  description?: string;
  /** Что человек получит. Пустая строка убирает строку целиком. */
  promise?: string;
  buttonLabel?: string;
  /** Тёмная плашка для светлых страниц, светлая — для тёмных секций. */
  tone?: "dark" | "light";
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

export function WaitlistCapture({
  source,
  title = "Забрать ранний доступ к модулям AEVION",
  description = "Платформа выпускает модули по одному. Оставьте адрес — напишем в день запуска того, что вам ближе, и пришлём условия раннего доступа.",
  promise = "Письмо приходит на запуск модуля. Отписка — одной ссылкой в каждом письме.",
  buttonLabel = "Получить ранний доступ",
  tone = "dark",
}: WaitlistCaptureProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const dark = tone === "dark";
  const fg = dark ? "#f8fafc" : "#0f172a";
  const muted = dark ? "rgba(226,232,240,0.75)" : "#475569";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setMessage("Похоже, в адресе опечатка. Проверьте — и отправьте ещё раз.");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const r = await fetch(apiUrl("/api/constitution/waitlist/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source: source.slice(0, 60) }),
      });
      if (r.ok) {
        setStatus("done");
        setMessage("Готово — адрес записан. Напишем, когда будет что показать.");
        setEmail("");
        return;
      }
      // Отдельный текст на каждый класс отказа: «что-то пошло не так» не говорит
      // человеку, повторять ему попытку или исправлять адрес.
      if (r.status === 429) {
        setStatus("error");
        setMessage("Слишком много попыток подряд. Подождите минуту и повторите.");
      } else if (r.status === 400) {
        setStatus("error");
        setMessage("Сервер не принял адрес. Проверьте написание.");
      } else {
        setStatus("error");
        setMessage("Не смогли сохранить адрес — это на нашей стороне. Попробуйте ещё раз через минуту.");
      }
    } catch {
      setStatus("error");
      setMessage("Не дозвонились до сервера. Проверьте связь и повторите.");
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        padding: "24px 20px",
        borderRadius: 16,
        background: dark ? "linear-gradient(135deg, #0f172a, #1e293b)" : "#fff",
        border: dark ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(15,23,42,0.12)",
        color: fg,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em", color: fg }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 16px", color: muted, maxWidth: 620 }}>
        {description}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <label htmlFor={`waitlist-email-${source}`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Адрес электронной почты
        </label>
        <input
          id={`waitlist-email-${source}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="вы@почта.рф"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "sending"}
          aria-invalid={status === "error"}
          aria-describedby={message ? `waitlist-msg-${source}` : undefined}
          style={{
            flex: "1 1 260px",
            minWidth: 0,
            padding: "12px 14px",
            fontSize: 16, // 16px — иначе Safari на телефоне зумит форму при фокусе
            borderRadius: 10,
            border: dark ? "1px solid rgba(226,232,240,0.25)" : "1px solid rgba(15,23,42,0.18)",
            background: dark ? "rgba(15,23,42,0.6)" : "#fff",
            color: fg,
          }}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          style={{
            padding: "12px 20px",
            fontSize: 15,
            fontWeight: 800,
            borderRadius: 10,
            border: "none",
            cursor: status === "sending" ? "wait" : "pointer",
            background: dark ? "#d4af37" : "#0f172a",
            color: dark ? "#0f172a" : "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {status === "sending" ? "Отправляем…" : buttonLabel}
        </button>
      </div>

      {message ? (
        <p
          id={`waitlist-msg-${source}`}
          role="status"
          aria-live="polite"
          style={{
            margin: "12px 0 0",
            fontSize: 14,
            fontWeight: 600,
            color: status === "done" ? (dark ? "#4ade80" : "#15803d") : dark ? "#fca5a5" : "#b91c1c",
          }}
        >
          {message}
        </p>
      ) : null}

      {promise ? (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.5, color: muted }}>{promise}</p>
      ) : null}
    </form>
  );
}

export default WaitlistCapture;
