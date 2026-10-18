"use client";
import React, { useState } from "react";
import type { track as trackFn } from "@/lib/track";

/**
 * Отзыв одной строкой после результата: решённой задачи (панель «Решено!») и
 * конца партии (окно «Итог партии»).
 *
 * Повод 16.10.2026 (очередь оркестратора, неделя шахмат): к 20.10 нужны ≥ 3 отзыва
 * живых игроков, а пути оставить отзыв в шахматах не было вовсе (grep по
 * cyberchess: 0 полей, 0 ручек). Хранилище — журнал событий бэкенда (тот же,
 * что воронка): событие feature_use с meta.feature="otzyv" и meta.text (≤ 200
 * знаков — предел сервера на строку meta). Читать:
 *   число — funnel?days=N → byFeature["cyberchess/board|otzyv"] (пробы вычтены);
 *   тексты — GET /api/pricing/events/recent?limit=… с x-admin-token, поле meta.text.
 * Бэкенд не менялся: ручка уже принимает такие события.
 */
export const ОТЗЫВ_МАКС = 200;

export function tekstOtzyvaGoden(text: string): boolean {
  const t = text.trim();
  return t.length >= 2 && t.length <= ОТЗЫВ_МАКС;
}

export type KontekstOtzyva = "puzzle" | "game";

/** Тело события — то, что сложит воронка в строку cyberchess/board|otzyv. */
export function sobytieOtzyva(kontekst: KontekstOtzyva, text: string): Parameters<typeof trackFn>[0] {
  return {
    type: "feature_use",
    source: "cyberchess/board",
    meta: { feature: "otzyv", app: "cyberchess", kontekst, text: text.trim().slice(0, ОТЗЫВ_МАКС) },
  };
}

type Props = {
  kontekst: KontekstOtzyva;
  t: (key: string) => string;
  otpravit: typeof trackFn;
  /** Тёмный фон (окно «Итог партии») — поле и кнопка светлые на тёмном. */
  tyomnyy?: boolean;
  /** После «Отправить» — например, показать окно подписки, которое ждало отзыва. */
  onSent?: () => void;
};

export function OtzyvPosleRezultata({ kontekst, t, otpravit, tyomnyy, onSent }: Props) {
  const [text, sText] = useState("");
  const [sent, sSent] = useState(false);
  const fg = tyomnyy ? "#f5f5f4" : "#065f46";
  const border = tyomnyy ? "rgba(255,255,255,0.25)" : "#a7f3d0";
  const bg = tyomnyy ? "rgba(255,255,255,0.08)" : "#fff";
  if (sent) {
    return <div data-cc-otzyv="sent" style={{ width: "100%", fontSize: 13, fontWeight: 800, color: fg }}>{t("pz.otzyv.thanks")}</div>;
  }
  const goden = tekstOtzyvaGoden(text);
  return (
    <form data-cc-otzyv={kontekst} onSubmit={(e) => { e.preventDefault(); if (!goden) return; otpravit(sobytieOtzyva(kontekst, text)); sSent(true); onSent?.(); }}
      /* Плашка после партии лежит ВНУТРИ доски, а доска на pointerdown зовёт preventDefault
         (useBoardInput): без остановки всплытия тап по полю не даёт фокус, клик по кнопке
         висит (замер Playwright 16.10 на проде: locator.click не завершался). */
      onPointerDown={(e) => e.stopPropagation()}
      style={{ width: "100%", display: "flex", gap: 6, alignItems: "center" }}>
      <input value={text} onChange={(e) => sText(e.target.value)} maxLength={ОТЗЫВ_МАКС} placeholder={t("pz.otzyv.ask")} aria-label={t("pz.otzyv.ask")}
        style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color: tyomnyy ? "#fff" : "#1f2937", fontSize: 13 }} />
      <button type="submit" className="cc-touch" disabled={!goden} aria-label={t("pz.otzyv.send")}
        style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: goden ? "#059669" : "rgba(5,150,105,0.35)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: goden ? "pointer" : "default", flexShrink: 0 }}>
        {t("pz.otzyv.send")}
      </button>
    </form>
  );
}
