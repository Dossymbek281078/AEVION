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
import { channelFrom } from "@/lib/products";

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
  /** Язык подсказки и сообщений об отказе. По умолчанию русский. */
  lang?: "ru" | "en";
  /**
   * Текст подтверждения после успешной подписки.
   *
   * Зачем настраивается. Общий текст — «напишем, когда будет что показать»:
   * он верен для страниц без даты. Но на странице запуска, где прямо сказано
   * «Открываем 30 августа», такое подтверждение звучит расплывчатее самого
   * обещания, и человек уходит с меньшей уверенностью, чем пришёл. Замер
   * 28.08.2026: страница обещает «напишем в день запуска», письмо называет
   * дату, а подтверждение на экране — нет.
   */
  doneText?: string;
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

/**
 * Тексты, которые НЕЛЬЗЯ передать пропом: подсказка в поле, сообщения об
 * отказах и надпись во время отправки. Заголовок и кнопка уже настраиваются
 * снаружи, а эти строки были зашиты по-русски — и на английских страницах
 * (/en/go, /en/longevity, заведены 28.08.2026) человек видел кириллицу ровно в
 * той точке, где оставляет контакт.
 *
 * По умолчанию русский: ни одна существующая страница не меняет поведения.
 */
const COPY = {
  ru: {
    placeholder: "вы@почта.рф",
    sending: "Отправляем…",
    emailLabel: "Адрес электронной почты",
    typo: "Похоже, в адресе опечатка. Проверьте — и отправьте ещё раз.",
    done: "Готово — адрес записан. Напишем, когда будет что показать.",
    tooMany: "Слишком много попыток подряд. Подождите минуту и повторите.",
    rejected: "Сервер не принял адрес. Проверьте написание.",
    ourFault: "Не смогли сохранить адрес — это на нашей стороне. Попробуйте ещё раз через минуту.",
    offline: "Не дозвонились до сервера. Проверьте связь и повторите.",
  },
  en: {
    placeholder: "you@example.com",
    sending: "Sending…",
    emailLabel: "Email address",
    typo: "That address looks like a typo. Check it and send again.",
    done: "Done — the address is saved. We write when there is something to show.",
    tooMany: "Too many attempts in a row. Wait a minute and try again.",
    rejected: "The server did not accept the address. Check the spelling.",
    ourFault: "We could not save the address — that is on our side. Try again in a minute.",
    offline: "Could not reach the server. Check the connection and try again.",
  },
} as const;

export function WaitlistCapture({
  source,
  title = "Забрать ранний доступ к модулям AEVION",
  description = "Платформа выпускает модули по одному. Оставьте адрес — напишем в день запуска того, что вам ближе, и пришлём условия раннего доступа.",
  promise = "Письмо приходит на запуск модуля. Отписка — одной ссылкой в каждом письме.",
  buttonLabel = "Получить ранний доступ",
  tone = "dark",
  lang = "ru",
  doneText,
}: WaitlistCaptureProps) {
  const copy = COPY[lang];
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
      setMessage(copy.typo);
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const канал =
        typeof window === "undefined"
          ? null
          : channelFrom(new URLSearchParams(window.location.search).get("c") ?? undefined);
      const r = await fetch(apiUrl("/api/constitution/waitlist/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          source: source.slice(0, 60),
          // Канал привлечения — ОТДЕЛЬНО от source. source отвечает «с какой
          // страницы», channel — «кто привёл». До 31.08.2026 второго не было
          // вовсе: про покупки мы знали канал, а про подписчиков — нет, хотя
          // список для запуска и есть главный актив воронки.
          //
          // Через channelFrom, а не сырым значением: чужое ?c= из посторонней
          // ссылки в учёт не поедет, и словарь останется тот же, что у покупок.
          ...(канал ? { channel: канал } : {}),
        }),
      });
      if (r.ok) {
        setStatus("done");
        setMessage(doneText || copy.done);
        setEmail("");
        return;
      }
      // Отдельный текст на каждый класс отказа: «что-то пошло не так» не говорит
      // человеку, повторять ему попытку или исправлять адрес.
      if (r.status === 429) {
        setStatus("error");
        setMessage(copy.tooMany);
      } else if (r.status === 400) {
        setStatus("error");
        setMessage(copy.rejected);
      } else {
        setStatus("error");
        setMessage(copy.ourFault);
      }
    } catch {
      setStatus("error");
      setMessage(copy.offline);
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
          {copy.emailLabel}
        </label>
        <input
          id={`waitlist-email-${source}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.placeholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            // Ответ прошлой отправки убираем, как только человек начал вводить
            // следующий адрес. Иначе зелёное «Готово» висит над пустым полем и
            // подписывает собой ввод, к которому не относится.
            if (status !== "idle") {
              setStatus("idle");
              setMessage("");
            }
          }}
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
          {status === "sending" ? copy.sending : buttonLabel}
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
        // 13.5px, а не 12.5: замер в браузере при ширине 390 (iPhone) показал, что
        // это САМЫЙ мелкий содержательный текст на странице — и при этом он объясняет,
        // на что человек подписывается («письмо на запуск», «отписка одной ссылкой»).
        // Мельче только надзаголовки в 11px, но те — три слова заглавными, их читают
        // взглядом, а не построчно. Мелкое условие подписки — плохая мелочь.
        <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.55, color: muted }}>{promise}</p>
      ) : null}
    </form>
  );
}

export default WaitlistCapture;
