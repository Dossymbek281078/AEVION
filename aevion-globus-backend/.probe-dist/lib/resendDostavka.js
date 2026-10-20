"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nuzhenPovtor = nuzhenPovtor;
exports.sostoyanieResend = sostoyanieResend;
exports.proveritIPovtorit = proveritIPovtorit;
exports.zaplanirovatProverkuDostavki = zaplanirovatProverkuDostavki;
const constitutionBrevo_1 = require("./constitutionBrevo");
/** События Resend, после которых письмо точно не дошло и его надо послать заново. */
function nuzhenPovtor(lastEvent) {
    return lastEvent === "bounced" || lastEvent === "failed";
}
async function sostoyanieResend(id, key, f = fetch) {
    const r = await f(`https://api.resend.com/emails/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok)
        return null;
    const j = (await r.json().catch(() => null));
    return j?.last_event ?? null;
}
async function proveritIPovtorit(a) {
    const lastEvent = await sostoyanieResend(a.id, a.key, a.f);
    if (!nuzhenPovtor(lastEvent))
        return { lastEvent, повтор: false };
    const b = await (a.brevo ?? constitutionBrevo_1.sendBrevoEmail)({
        to: [{ email: a.pismo.to }],
        subject: a.pismo.subject,
        htmlContent: a.pismo.html,
        textContent: a.pismo.text,
        tags: ["resend-bounce-retry"],
    });
    const строка = `[почта] Resend ${a.id} → ${lastEvent}; повтор через Brevo для ${a.pismo.to}: ${b.ok ? "ушёл" : "НЕ ушёл: " + (b.error ?? "без причины")}`;
    if (b.ok)
        console.log(строка);
    else
        console.error(строка);
    return { lastEvent, повтор: true, brevoOk: b.ok };
}
/** Через cherezMs проверить доставку; при отказе повторить через Brevo; `naItog` получает исход (143: чтобы недоставленное писалось в журнал, а не только в консоль). */
function zaplanirovatProverkuDostavki(a) {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!a.id || !key) {
        console.warn(`[почта] проверка доставки не запланирована для ${a.pismo.to}: ${!a.id ? "нет id письма" : "нет ключа Resend"}`);
        return false;
    }
    const id = a.id;
    const t = setTimeout(() => {
        proveritIPovtorit({ id, pismo: a.pismo, key })
            .then((итог) => { try {
            a.naItog?.(итог);
        }
        catch (e) {
            console.error("[почта] naItog упал:", e instanceof Error ? e.message : e);
        } })
            .catch((e) => console.error("[почта] проверка доставки не выполнена:", e instanceof Error ? e.message : e));
    }, a.cherezMs ?? 60000);
    t.unref?.();
    return true;
}
