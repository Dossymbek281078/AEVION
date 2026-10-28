"use client";

/**
 * «Оплата скоро — оставьте почту» вместо «Купить» у платных товаров магазина.
 *
 * 20.10.2026 (замер прода + слово Оркестратора): у товаров QStore кассы нет — Gumroad
 * permalink на проде не задан, и сервер честно отвечает 503 no_payment_provider.
 * Человек проходил вход ради отказа. Теперь — почта в общий учёт лидов сайта
 * (/api/constitution/waitlist/subscribe) с источником qstore-<товар> и подтверждение
 * на экране. Признак хранения читается: «memory» — честно говорим, что сохранено
 * временно (сторож formsReadStorageFlag).
 */
import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useQStoreT } from "./i18n";

/** Ящик для запасного письма; держится здесь, а не в словаре (сторож noNewDeadMailboxes ведёт файл). */
const DATA_MAIL = "data@aevion.app";

export const QSTORE_NOTIFY_SOURCE = (productId: string) => `qstore-${productId.slice(0, 40)}`;

export function QStoreNotify({ productId, productTitle }: { productId: string; productTitle: string }) {
  const { lang, t } = useQStoreT();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "temp" | "error">("idle");
  const [msg, setMsg] = useState("");

  const send = async () => {
    const адрес = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(адрес)) { setState("error"); setMsg(t("notify.badEmail")); return; }
    setState("sending");
    try {
      const r = await fetch(apiUrl("/api/constitution/waitlist/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: адрес, source: QSTORE_NOTIFY_SOURCE(productId), projectId: productId, lang }),
      });
      const j = await r.json().catch(() => null);
      // Сырой ответ сервера (код ошибки, английский message) человеку не показываем:
      // известный отказ — своим текстом, остальное — общим «не удалось».
      if (!r.ok) { setState("error"); setMsg(r.status === 400 ? t("notify.badEmail") : t("notify.fail")); return; }
      if (j?.storage === "memory") {
        setState("temp");
        setMsg(t("notify.temp", { mail: DATA_MAIL, title: productTitle }));
        return;
      }
      setState("done");
      setMsg(t("notify.done", { email: адрес, title: productTitle }));
    } catch {
      setState("error");
      setMsg(t("notify.net"));
    }
  };

  if (state === "done" || state === "temp") {
    return (
      <div role="status" data-qstore-notify={state} style={{ padding: "12px 14px", borderRadius: 10, background: state === "done" ? "#ecfdf5" : "#fffbeb", color: state === "done" ? "#065f46" : "#92400e", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        {msg}
      </div>
    );
  }
  return (
    <div data-qstore-notify="form" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{t("notify.heading")}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{t("notify.body")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label={t("notify.emailAria")}
          style={{ flex: "1 1 180px", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
        />
        <button
          onClick={send}
          disabled={state === "sending"}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: state === "sending" ? "default" : "pointer" }}
        >
          {state === "sending" ? t("notify.sending") : t("notify.send")}
        </button>
      </div>
      {state === "error" && <div role="alert" style={{ marginTop: 8, color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{msg}</div>}
    </div>
  );
}
