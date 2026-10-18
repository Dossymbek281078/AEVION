"use client";
import React, { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/**
 * «Нашли ошибку?» у доски (волна 143, 18.10.2026 — заказ Продаж, слово оркестратора).
 *
 * Кнопка стоит в ряду под доской (не поверх клеток), форма раскрывается под рядом. Отчёт идёт тем же путём,
 * что отзыв 16.10, — событие feature_use через POST /api/pricing/events с meta.feature="oshibka", но прямым
 * fetch с проверкой ответа: бэкенд шлёт письмо на data@ и пишет строку в журнал заявок; пустой текст — 400.
 * Если ручка недоступна или ответила не 2xx — форма показывает адрес data@aevion.app, а не вид успеха (§16).
 * Авто-поля: FEN, id задачи, размер окна, метка ?c=, страница; браузер пишет сервер.
 */
export const ОШИБКА_ТЕКСТ_МАКС = 2000;
export const ОШИБКА_АДРЕС = "data@aevion.app";

export function tekstOshibkiGoden(text: string): boolean {
  const t = text.trim();
  return t.length >= 2 && t.length <= ОШИБКА_ТЕКСТ_МАКС;
}

export type DannyeOshibki = { fen: string; puzzleId: string | null; kontekst: "puzzle" | "game" | "setup" | "analysis" };

/** Тело события — то, что уйдёт в POST /api/pricing/events. */
export function sobytieOshibki(d: DannyeOshibki, text: string, email: string, tester: boolean, sid: string): Record<string, unknown> {
  const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/cyberchess";
  const tag = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("c") : null;
  const viewport = typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null;
  return {
    type: "feature_use", source: "cyberchess/board", sid, path,
    webdriver: typeof navigator !== "undefined" && (navigator as { webdriver?: boolean }).webdriver === true ? true : undefined,
    meta: { feature: "oshibka", app: "cyberchess", kontekst: d.kontekst, text: text.trim().slice(0, ОШИБКА_ТЕКСТ_МАКС), email: email.trim() || undefined, tester, fen: d.fen, puzzleId: d.puzzleId ?? undefined, viewport: viewport ?? undefined, tag: tag ?? undefined },
  };
}

function sessiya(): string {
  try {
    const k = "aevion_sid";
    let s = localStorage.getItem(k);
    if (!s) { s = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, s); }
    return s;
  } catch { return "s_anon"; }
}

type Props = {
  dannye: () => DannyeOshibki;
  t: (key: string) => string;
  /** Цвета оболочки (CC): текст, приглушённый, рамка, поверхность. */
  cc: { text: string; textMute: string; border: string; surface1: string; brand: string };
  /** Ширина формы = ширина ряда под доской. */
  width: number | string;
};

export function OshibkaForma({ dannye, t, cc, width }: Props) {
  const [open, sOpen] = useState(false);
  const [text, sText] = useState("");
  const [email, sEmail] = useState("");
  const [tester, sTester] = useState(false);
  const [state, sState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const goden = tekstOshibkiGoden(text);
  const отправить = async () => {
    if (!goden || state === "sending") return;
    sState("sending");
    try {
      const r = await fetch(apiUrl("/api/pricing/events"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sobytieOshibki(dannye(), text, email, tester, sessiya())), keepalive: true });
      sState(r.ok ? "sent" : "failed");
    } catch { sState("failed"); }
  };
  return (
    <>
      <button type="button" data-cc-oshibka-btn="1" className="cc-touch" onClick={() => sOpen((v) => !v)} aria-expanded={open}
        title={t("oshibka.btn")} style={{ marginLeft: "auto", padding: "4px 8px", borderRadius: 6, border: `1px solid ${cc.border}`, background: cc.surface1, color: cc.textMute, fontSize: 11, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
        {t("oshibka.btn")}
      </button>
      {open && (
        <form data-cc-oshibka-form="1" onSubmit={(e) => { e.preventDefault(); void отправить(); }} onPointerDown={(e) => e.stopPropagation()}
          style={{ flexBasis: "100%", width, marginTop: 6, padding: 10, borderRadius: 10, border: `1px solid ${cc.border}`, background: cc.surface1, display: "flex", flexDirection: "column", gap: 6, boxSizing: "border-box" }}>
          {state === "sent" ? (
            <div data-cc-oshibka-state="sent" style={{ fontSize: 13, fontWeight: 800, color: cc.text }}>{t("oshibka.thanks")}</div>
          ) : (
            <>
              <textarea value={text} onChange={(e) => sText(e.target.value)} maxLength={ОШИБКА_ТЕКСТ_МАКС} rows={3} required placeholder={t("oshibka.ask")} aria-label={t("oshibka.ask")}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${cc.border}`, background: "#fff", color: "#1f2937", fontSize: 13, resize: "vertical" }} />
              <input type="email" value={email} onChange={(e) => sEmail(e.target.value)} maxLength={200} placeholder={t("oshibka.email")} aria-label={t("oshibka.email")}
                style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${cc.border}`, background: "#fff", color: "#1f2937", fontSize: 13 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: cc.text }}>
                <input type="checkbox" checked={tester} onChange={(e) => sTester(e.target.checked)} /> {t("oshibka.tester")}
              </label>
              {state === "failed" && (
                <div data-cc-oshibka-state="failed" role="alert" style={{ fontSize: 12, color: "#b91c1c" }}>
                  {t("oshibka.failed")} <a href={`mailto:${ОШИБКА_АДРЕС}`} style={{ color: "#b91c1c" }}>{ОШИБКА_АДРЕС}</a>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="submit" className="cc-touch" disabled={!goden || state === "sending"} data-cc-oshibka-send="1"
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: goden ? cc.brand : cc.border, color: "#fff", fontWeight: 900, fontSize: 13, cursor: goden ? "pointer" : "default" }}>
                  {state === "sending" ? "…" : t("oshibka.send")}
                </button>
                <button type="button" onClick={() => sOpen(false)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${cc.border}`, background: "transparent", color: cc.textMute, fontSize: 12, cursor: "pointer" }}>{t("oshibka.close")}</button>
                <span style={{ fontSize: 11, color: cc.textMute, marginLeft: "auto" }}>{text.trim().length}/{ОШИБКА_ТЕКСТ_МАКС}</span>
              </div>
            </>
          )}
        </form>
      )}
    </>
  );
}
