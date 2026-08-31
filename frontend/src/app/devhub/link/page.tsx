"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { useDevhubT } from "../i18n";

/**
 * Подключение оплаченного доступа к браузеру гостя.
 *
 * Страница закрывает последнее звено цепочки прав: модуль намеренно
 * работает без входа, а магазин знает покупателя только по почте. Здесь
 * человек называет почту покупки, получает на неё письмо и переходом по
 * ссылке связывает покупку с браузером, в котором работает.
 *
 * Заголовок гостя ставится глобально (installDevhubGuestHeader), поэтому
 * запросы отсюда несут его сами — отдельной передачи не нужно.
 */
export default function DevHubLinkPage() {
  const t = useDevhubT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmState, setConfirmState] = useState<"none" | "working" | "done" | "failed">("none");

  const confirm = useCallback(async (id: string, token: string) => {
    setConfirmState("working");
    try {
      const r = await fetch(apiUrl("/api/devhub/guest/link-confirm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, token }),
      });
      const j = await r.json().catch(() => null);
      // Успех определяется ОТВЕТОМ, а не фактом, что запрос ушёл: fetch не
      // бросает на 400 и 503, и безусловное «готово» здесь было бы ложью,
      // выглядящей как успех.
      if (r.ok && j?.ok) {
        setConfirmState("done");
        /*
         * ⚠️ 31.08.2026: «сохранено» и «сохранено НАДЁЖНО» — разные вещи.
         *
         * Ручка при недоступной базе отвечает успехом и помечает ответ
         * storage: "memory" — запись живёт до перезапуска процесса. Здесь это
         * не мелочь: связывается ГОСТЬ со своей покупкой. Перезапуск — и
         * человек, заплативший $149, снова гость, а мы сказали ему «готово».
         *
         * Признак был в ответе, и его никто не читал: сервер честен, экран нет.
         * Формулировку беру из двух других мест DevHub, а не завожу третью.
         */
        const вПамяти = j?.storage === "memory";
        setNote(
          вПамяти
            ? t("link.confirmedButMemory")
            : typeof j.message === "string"
              ? j.message
              : t("link.confirmed"),
        );
      } else {
        setConfirmState("failed");
        setNote(typeof j?.message === "string" ? j.message : t("link.confirmFailed"));
      }
    } catch {
      setConfirmState("failed");
      setNote(t("link.confirmFailed"));
    }
  }, [t]);

  useEffect(() => {
    // Читаем из адреса, а не из пропсов: страница открывается по ссылке из
    // письма, и разбор параметров на сервере потребовал бы Suspense.
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const id = p.get("id");
    const token = p.get("token");
    if (id && token) void confirm(id, token);
  }, [confirm]);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setNote(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/guest/link-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setNote(typeof j.message === "string" ? j.message : t("link.sent"));
      } else {
        // Отказ показываем отказом. Молчаливое «письмо отправлено» заставило
        // бы человека ждать письма, которого не будет.
        setFailed(true);
        setNote(typeof j?.message === "string" ? j.message : t("link.requestFailed"));
      }
    } catch {
      setFailed(true);
      setNote(t("link.requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  const box: React.CSSProperties = {
    maxWidth: 560,
    margin: "0 auto",
    padding: "48px 20px 64px",
  };

  return (
    <main style={box}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>{t("link.title")}</h1>

      {confirmState === "working" && <p>{t("link.confirming")}</p>}

      {confirmState === "done" && (
        <div>
          <p style={{ marginBottom: 18 }}>{note}</p>
          <Link href="/devhub" style={{ fontWeight: 700 }}>
            {t("link.toModule")}
          </Link>
        </div>
      )}

      {confirmState !== "done" && (
        <>
          <p style={{ marginBottom: 22, lineHeight: 1.5 }}>{t("link.lead")}</p>

          <form onSubmit={request}>
            <label htmlFor="devhub-link-email" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              {t("link.emailLabel")}
            </label>
            <input
              id="devhub-link-email"
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "11px 13px",
                fontSize: 15,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                marginBottom: 14,
              }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "11px 20px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: busy ? "default" : "pointer",
              }}
            >
              {busy ? t("link.sending") : t("link.send")}
            </button>
          </form>

          {note && (
            <p role="status" style={{ marginTop: 18, lineHeight: 1.5, fontWeight: failed ? 700 : 400 }}>
              {note}
            </p>
          )}

          <p style={{ marginTop: 26, fontSize: 12.5, lineHeight: 1.5, color: "#64748b" }}>
            {t("link.privacy")}
          </p>
        </>
      )}
    </main>
  );
}
