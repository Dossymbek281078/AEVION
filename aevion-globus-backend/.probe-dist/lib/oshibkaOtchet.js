"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ОШИБКА_КОМУ = exports.ОШИБКА_ТЕКСТ_МАКС = void 0;
exports.razobratOtchetObOshibke = razobratOtchetObOshibke;
exports.pismoObOshibke = pismoObOshibke;
exports.otpravitOtchetObOshibke = otpravitOtchetObOshibke;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const leadsFile_1 = require("./leadsFile");
const provisioning_1 = require("../routes/provisioning");
const resendDostavka_1 = require("./resendDostavka");
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
exports.ОШИБКА_ТЕКСТ_МАКС = 2000;
const ОШИБКА_КОМУ = () => process.env.OSHIBKA_NOTIFY_TO?.trim() || "data@aevion.app";
exports.ОШИБКА_КОМУ = ОШИБКА_КОМУ;
const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
/** null — это не отчёт об ошибке; {status,error} — отчёт негоден; {otchet} — принят. */
function razobratOtchetObOshibke(body, req) {
    const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : null;
    if (!meta || meta.feature !== "oshibka")
        return null;
    const text = typeof meta.text === "string" ? meta.text.trim() : "";
    if (text.length < 2)
        return { status: 400, error: "empty_text" };
    if (text.length > exports.ОШИБКА_ТЕКСТ_МАКС)
        return { status: 400, error: "text_too_long" };
    const email = str(meta.email, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { status: 400, error: "bad_email" };
    const path = str(body.path, 200);
    const tag = str(meta.tag, 60) ?? (path ? (/[?&]c=([^&#]+)/.exec(path)?.[1] ?? null) : null);
    return {
        otchet: {
            text, email, tester: meta.tester === true, fen: str(meta.fen, 100), puzzleId: str(meta.puzzleId, 64), kontekst: str(meta.kontekst, 30),
            viewport: str(meta.viewport, 20), tag, path, ua: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 200) : null,
            sid: str(body.sid, 60), ts: new Date().toISOString(),
        },
    };
}
function строкаВЗаявки(запись) {
    try {
        const f = (0, leadsFile_1.leadsFile)();
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(f), { recursive: true });
        (0, node_fs_1.appendFileSync)(f, JSON.stringify(запись) + "\n", "utf8");
    }
    catch (e) {
        console.error("[oshibka] журнал заявок не записан:", e instanceof Error ? e.message : e);
    }
}
function pismoObOshibke(o) {
    const кратко = o.text.replace(/\s+/g, " ").slice(0, 60);
    const subject = `CyberChess · ошибка от игрока: ${кратко}${o.puzzleId ? ` · ${o.puzzleId}` : ""}`;
    const строки = [
        `Что случилось:`, o.text, ``,
        `Почта: ${o.email ?? "не оставил"}`, `Хочет в тестировщики: ${o.tester ? "да" : "нет"}`, ``,
        `Задача: ${o.puzzleId ?? "—"}${o.kontekst ? ` (${o.kontekst})` : ""}`, `FEN: ${o.fen ?? "—"}`,
        `Страница: ${o.path ?? "—"}`, `Метка: ${o.tag ?? "—"}`, `Окно: ${o.viewport ?? "—"}`, `Браузер: ${o.ua ?? "—"}`, `Сессия: ${o.sid ?? "—"}`, `Время: ${o.ts}`,
    ];
    const text = строки.join("\n");
    return { to: (0, exports.ОШИБКА_КОМУ)(), subject, text, html: `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>` };
}
/** Записать копию в заявки, послать письмо, проверить доставку; исход — в журнал, не в тишину. */
async function otpravitOtchetObOshibke(o) {
    строкаВЗаявки({ kind: "cyberchess_oshibka", ...o });
    const письмо = pismoObOshibke(o);
    const r = await (0, provisioning_1.sendEmail)(письмо);
    if (!r.ok) {
        console.error(`[oshibka] письмо на ${письмо.to} НЕ ушло:`, r.error ?? "failed");
        строкаВЗаявки({ ts: new Date().toISOString(), kind: "cyberchess_oshibka_undelivered", stage: "send", error: r.error ?? "failed", sid: o.sid, text: o.text.slice(0, 200) });
        return { mailed: false };
    }
    if (r.mode === "real") {
        (0, resendDostavka_1.zaplanirovatProverkuDostavki)({
            id: r.id, pismo: письмо,
            naItog: (итог) => {
                if (итог.lastEvent === "delivered" || (итог.повтор && итог.brevoOk))
                    return;
                строкаВЗаявки({ ts: new Date().toISOString(), kind: "cyberchess_oshibka_undelivered", stage: "delivery", resendId: r.id, lastEvent: итог.lastEvent, повтор: итог.повтор, brevoOk: итог.brevoOk ?? null, sid: o.sid, text: o.text.slice(0, 200) });
            },
        });
    }
    return { mailed: true, id: r.id };
}
