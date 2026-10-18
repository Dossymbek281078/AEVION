import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Request } from "express";
import { leadsFile } from "./leadsFile";
import { sendEmail } from "../routes/provisioning";
import { zaplanirovatProverkuDostavki } from "./resendDostavka";

/**
 * Отчёт об ошибке из шахмат — кнопка «Нашли ошибку?» (волна 143, 18.10.2026, заказ Продаж, слово оркестратора).
 *
 * Путь тот же, что у отзыва 16.10: событие feature_use через POST /api/pricing/events с meta.feature="oshibka".
 * Но журнал событий — хвост с пределом (/recent ≤ 1000), отчёты в нём тонут за сутки, поэтому:
 *   • ОСНОВНОЕ хранилище — письмо на data@ (Resend, проверка доставки через 60 с; отскок → повтор через Brevo);
 *   • долговечная копия — строка в журнале заявок (leads.jsonl, kind "cyberchess_oshibka"), а в журнале событий
 *     остаётся само событие (meta.text там режется до 200, как у всех событий);
 *   • недоставленное письмо — отдельная строка kind "cyberchess_oshibka_undelivered", не молча (§16).
 * Пустой текст — 400, не 5xx; текст длиннее 2000 — 400.
 */
export const ОШИБКА_ТЕКСТ_МАКС = 2000;
export const ОШИБКА_КОМУ = (): string => process.env.OSHIBKA_NOTIFY_TO?.trim() || "data@aevion.app";

export type OtchetObOshibke = {
  text: string; email: string | null; tester: boolean; fen: string | null; puzzleId: string | null;
  kontekst: string | null; viewport: string | null; tag: string | null; path: string | null; ua: string | null; sid: string | null; ts: string;
};
export type RazborOtcheta = { otchet: OtchetObOshibke } | { status: number; error: string } | null;

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** null — это не отчёт об ошибке; {status,error} — отчёт негоден; {otchet} — принят. */
export function razobratOtchetObOshibke(body: Record<string, unknown>, req: Request): RazborOtcheta {
  const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? (body.meta as Record<string, unknown>) : null;
  if (!meta || meta.feature !== "oshibka") return null;
  const text = typeof meta.text === "string" ? meta.text.trim() : "";
  if (text.length < 2) return { status: 400, error: "empty_text" };
  if (text.length > ОШИБКА_ТЕКСТ_МАКС) return { status: 400, error: "text_too_long" };
  const email = str(meta.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, error: "bad_email" };
  const path = str(body.path, 200);
  const tag = str(meta.tag, 60) ?? (path ? (/[?&]c=([^&#]+)/.exec(path)?.[1] ?? null) : null);
  return {
    otchet: {
      text, email, tester: meta.tester === true, fen: str(meta.fen, 100), puzzleId: str(meta.puzzleId, 64), kontekst: str(meta.kontekst, 30),
      viewport: str(meta.viewport, 20), tag, path, ua: typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string).slice(0, 200) : null,
      sid: str(body.sid, 60), ts: new Date().toISOString(),
    },
  };
}

function строкаВЗаявки(запись: Record<string, unknown>): void {
  try {
    const f = leadsFile();
    mkdirSync(dirname(f), { recursive: true });
    appendFileSync(f, JSON.stringify(запись) + "\n", "utf8");
  } catch (e) {
    console.error("[oshibka] журнал заявок не записан:", e instanceof Error ? e.message : e);
  }
}

export function pismoObOshibke(o: OtchetObOshibke): { to: string; subject: string; text: string; html: string } {
  const кратко = o.text.replace(/\s+/g, " ").slice(0, 60);
  const subject = `CyberChess · ошибка от игрока: ${кратко}${o.puzzleId ? ` · ${o.puzzleId}` : ""}`;
  const строки = [
    `Что случилось:`, o.text, ``,
    `Почта: ${o.email ?? "не оставил"}`, `Хочет в тестировщики: ${o.tester ? "да" : "нет"}`, ``,
    `Задача: ${o.puzzleId ?? "—"}${o.kontekst ? ` (${o.kontekst})` : ""}`, `FEN: ${o.fen ?? "—"}`,
    `Страница: ${o.path ?? "—"}`, `Метка: ${o.tag ?? "—"}`, `Окно: ${o.viewport ?? "—"}`, `Браузер: ${o.ua ?? "—"}`, `Сессия: ${o.sid ?? "—"}`, `Время: ${o.ts}`,
  ];
  const text = строки.join("\n");
  return { to: ОШИБКА_КОМУ(), subject, text, html: `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>` };
}

/** Записать копию в заявки, послать письмо, проверить доставку; исход — в журнал, не в тишину. */
export async function otpravitOtchetObOshibke(o: OtchetObOshibke): Promise<{ mailed: boolean; id?: string }> {
  строкаВЗаявки({ kind: "cyberchess_oshibka", ...o });
  const письмо = pismoObOshibke(o);
  const r = await sendEmail(письмо);
  if (!r.ok) {
    console.error(`[oshibka] письмо на ${письмо.to} НЕ ушло:`, r.error ?? "failed");
    строкаВЗаявки({ ts: new Date().toISOString(), kind: "cyberchess_oshibka_undelivered", stage: "send", error: r.error ?? "failed", sid: o.sid, text: o.text.slice(0, 200) });
    return { mailed: false };
  }
  if (r.mode === "real") {
    zaplanirovatProverkuDostavki({
      id: r.id, pismo: письмо,
      naItog: (итог) => {
        if (итог.lastEvent === "delivered" || (итог.повтор && итог.brevoOk)) return;
        строкаВЗаявки({ ts: new Date().toISOString(), kind: "cyberchess_oshibka_undelivered", stage: "delivery", resendId: r.id, lastEvent: итог.lastEvent, повтор: итог.повтор, brevoOk: итог.brevoOk ?? null, sid: o.sid, text: o.text.slice(0, 200) });
      },
    });
  }
  return { mailed: true, id: r.id };
}
