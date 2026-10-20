"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PILOT_DESCRIPTION = exports.PILOT_PRODUCT = exports.PILOT_TO = exports.PILOT_USD = exports.proofPilotRouter = void 0;
exports.pismoNam = pismoNam;
exports.pismoPokupatelyu = pismoPokupatelyu;
exports.kassaPilotaGotova = kassaPilotaGotova;
exports.pismoObOplate = pismoObOplate;
exports.obrabotatZakazPilota = obrabotatZakazPilota;
/**
 * POST /api/proof/pilot-order — заказ пилота $490 с /proof (волна 129, 13.10.2026).
 *
 * До этого единственный путь к пилоту был mailto: тупик там, где нет почтового
 * клиента, и 0 нажатий за 14 дней. Форма пишет заявку в таблицу и в журнал
 * заявок (leads.jsonl), шлёт письмо на data@aevion.app и автоответ покупателю тем
 * же отправителем, что у форм (Resend, см. /api/health emailSender). Ничего не
 * списывается: счёт — после согласования объёма, как написано на странице.
 *
 * Отказы НЕ молчат (§16): каждая неудача отправки/записи названа в теле ответа.
 */
const express_1 = require("express");
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const dbPool_1 = require("../lib/dbPool");
const rateLimit_1 = require("../lib/rateLimit");
const provisioning_1 = require("./provisioning");
const leadsFile_1 = require("../lib/leadsFile");
const lemonSqueezyProvider_1 = require("../lib/payment/lemonSqueezyProvider");
const lemonSqueezyVariants_1 = require("../data/lemonSqueezyVariants");
const paymentConfirmedEvent_1 = require("../lib/payment/paymentConfirmedEvent");
exports.proofPilotRouter = (0, express_1.Router)();
exports.PILOT_USD = 490;
exports.PILOT_TO = "data@aevion.app";
const limiter = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 5,
    keyPrefix: "proof:pilot-order",
    message: "Too many requests. Please wait a minute and try again.",
});
let tableReady = false;
let dbAvailable = false;
async function ensureTable() {
    if (tableReady)
        return;
    try {
        await (0, dbPool_1.getPool)().query(`
      CREATE TABLE IF NOT EXISTS proof_pilot_order (
        "id"        TEXT PRIMARY KEY,
        "email"     TEXT NOT NULL,
        "records"   INTEGER NOT NULL,
        "days"      INTEGER NOT NULL,
        "data"      TEXT,
        "channel"   TEXT,
        "post"      TEXT,
        "path"      TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        dbAvailable = true;
    }
    catch (err) {
        dbAvailable = false;
        console.error("[proof/pilot-order] таблица недоступна:", err instanceof Error ? err.message : err);
    }
    tableReady = true;
}
const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v, dflt, min, max) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[\s,_]/g, ""));
    if (!Number.isFinite(n))
        return dflt;
    return Math.min(max, Math.max(min, Math.round(n)));
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function pismoNam(z) {
    const text = [
        `Pilot request — $${exports.PILOT_USD}`,
        ``,
        `Email:   ${z.email}`,
        `Records: ${z.records.toLocaleString("en-US")}`,
        `Days:    ${z.days}`,
        `Data:    ${z.data ?? "—"}`,
        `Channel: ${z.channel ?? "—"} · post: ${z.post ?? "—"}`,
        `Path:    ${z.path ?? "—"}`,
        `Id:      ${z.id}`,
        ``,
        `Next: reply with the format we need and a fixed date; the invoice comes after the scope is agreed.`,
    ].join("\n");
    return { to: exports.PILOT_TO, subject: `Pilot request — $${exports.PILOT_USD} — ${z.email}`, text, html: `<pre style="font:14px/1.5 ui-monospace,monospace">${esc(text)}</pre>` };
}
function pismoPokupatelyu(z) {
    // Только то, что обещает страница /proof: scope → format and a fixed date → invoice → manifest + verify kit.
    const text = [
        `Thank you — we received your pilot request ($${exports.PILOT_USD}, up to ${z.records.toLocaleString("en-US")} records, ${z.days} days).`,
        ``,
        `What happens next:`,
        `1. We reply from ${exports.PILOT_TO} with the record format we need and a fixed delivery date.`,
        `2. Once the scope is agreed, we send the invoice. Nothing has been charged yet.`,
        `3. After payment you receive a download link to the signed manifest (Ed25519 over RFC 8785 canonical JSON) and the verify kit — your client checks it on their own machine, calling nothing of ours.`,
        ``,
        `What it is not: we do not certify the author's identity, there is no notary co-signature, no SOC 2 or ISO 27001.`,
        ``,
        `Reply to this email to add details. — AEVION`,
    ].join("\n");
    return { to: z.email, subject: `AEVION pilot — we received your request`, text, html: `<pre style="font:14px/1.5 ui-monospace,monospace">${esc(text)}</pre>` };
}
function zapisatVZhurnal(lead) {
    try {
        const f = (0, leadsFile_1.leadsFile)();
        const d = (0, node_path_1.dirname)(f);
        if (!(0, node_fs_1.existsSync)(d))
            (0, node_fs_1.mkdirSync)(d, { recursive: true });
        (0, node_fs_1.appendFileSync)(f, JSON.stringify(lead) + "\n", "utf8");
        return null;
    }
    catch (err) {
        return err instanceof Error ? err.message : String(err);
    }
}
exports.proofPilotRouter.post("/pilot-order", limiter, async (req, res) => {
    try {
        // Honeypot: людям поле не показывается; заполнено — молча «ok» для робота, но честно в журнале.
        if (str(req.body?.website, 200)) {
            console.warn("[proof/pilot-order] honeypot заполнен — заявка отброшена");
            return res.status(200).json({ ok: true, stored: false, honeypot: true });
        }
        const email = String(req.body?.email ?? "").trim().toLowerCase();
        if (email.length < 5 || email.length > 254 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
            return res.status(400).json({ ok: false, error: "valid_email_required" });
        }
        const z = {
            id: node_crypto_1.default.randomUUID(),
            email,
            records: int(req.body?.records, 10000, 1, 1000000),
            days: int(req.body?.days, 7, 1, 60),
            data: str(req.body?.data, 500),
            channel: str(req.body?.channel, 60),
            post: str(req.body?.post, 60),
            path: str(req.body?.path, 300),
        };
        const errors = [];
        await ensureTable();
        let stored = false;
        if (dbAvailable) {
            try {
                await (0, dbPool_1.getPool)().query(`INSERT INTO proof_pilot_order ("id","email","records","days","data","channel","post","path") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [z.id, z.email, z.records, z.days, z.data, z.channel, z.post, z.path]);
                stored = true;
            }
            catch (err) {
                tableReady = false;
                dbAvailable = false;
                errors.push("storage: " + (err instanceof Error ? err.message : String(err)));
            }
        }
        else {
            errors.push("storage: unavailable");
        }
        const журнал = zapisatVZhurnal({ ts: new Date().toISOString(), kind: "pilot_490", ...z });
        if (журнал)
            errors.push("leads: " + журнал);
        const нам = await (0, provisioning_1.sendEmail)(pismoNam(z));
        const покупателю = await (0, provisioning_1.sendEmail)(pismoPokupatelyu(z));
        if (!нам.ok)
            errors.push("mail-us: " + (нам.error ?? "failed"));
        if (!покупателю.ok)
            errors.push("mail-buyer: " + (покупателю.error ?? "failed"));
        for (const e of errors)
            console.error("[proof/pilot-order]", z.id, e);
        const принято = stored || !журнал || нам.ok;
        return res.status(принято ? 201 : 503).json({ ok: принято, id: z.id, stored, journaled: !журнал, mailed: { us: нам.ok, buyer: покупателю.ok, mode: нам.mode }, errors });
    }
    catch (err) {
        console.error("[proof/pilot-order] failed:", err instanceof Error ? err.message : err);
        return res.status(500).json({ ok: false, error: "pilot_order_failed" });
    }
});
/* ───────────── 129б (13.10.2026): оплата $490 картой через кассу, не вместо формы ───────────── */
exports.PILOT_PRODUCT = lemonSqueezyVariants_1.PILOT_490_REFERENCE; // "pilot_490" — единственный товар этой страницы
exports.PILOT_DESCRIPTION = `AEVION proof pilot — signed delivery, up to 10,000 records, 7 days ($${exports.PILOT_USD})`;
const checkoutLimiter = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 10,
    keyPrefix: "proof:pilot-checkout",
    message: "Too many requests. Please wait a minute and try again.",
});
/** Касса готова, когда есть ключ, магазин, секрет вебхука (иначе оплата пришла бы в пустоту) и товар. */
function kassaPilotaGotova() {
    const missing = [];
    for (const k of ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_WEBHOOK_SECRET"]) {
        if (!process.env[k]?.trim())
            missing.push(k);
    }
    if (!(0, lemonSqueezyVariants_1.resolveLemonSqueezyVariant)(exports.PILOT_PRODUCT))
        missing.push("variant:" + exports.PILOT_PRODUCT);
    return { ready: missing.length === 0, missing };
}
/**
 * POST /api/proof/pilot-checkout → ссылка кассы LemonSqueezy на товар pilot_490.
 * Тот же провайдер и тот же вебхук, что у подписок; выдуманный товар — 400, касса не
 * настроена — 503 словами «ничего не списано, пользуйтесь формой».
 */
exports.proofPilotRouter.post("/pilot-checkout", checkoutLimiter, async (req, res) => {
    try {
        const product = str(req.body?.product, 40) ?? exports.PILOT_PRODUCT;
        if (product !== exports.PILOT_PRODUCT) {
            return res.status(400).json({ ok: false, error: "invalid_product", message: `No such product. The only product on this page is the $${exports.PILOT_USD} pilot.` });
        }
        const email = str(req.body?.email, 254)?.toLowerCase() ?? null;
        if (email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
            return res.status(400).json({ ok: false, error: "valid_email_required" });
        }
        const channel = str(req.body?.channel, 60);
        const post = str(req.body?.post, 60);
        const path = str(req.body?.path, 300);
        const готова = kassaPilotaGotova();
        if (!готова.ready) {
            console.error("[proof/pilot-checkout] касса не настроена:", готова.missing.join(", "));
            return res.status(503).json({
                ok: false,
                error: "checkout_unavailable",
                missing: готова.missing,
                message: "Online payment is not available right now. Nothing was charged — send the request form and we invoice you after the scope is agreed.",
            });
        }
        const customData = { module: exports.PILOT_PRODUCT };
        if (channel)
            customData.channel = channel;
        if (post)
            customData.post = post;
        const intent = await lemonSqueezyProvider_1.lemonSqueezyPaymentProvider.createIntent({
            reference: exports.PILOT_PRODUCT,
            amountCents: exports.PILOT_USD * 100,
            currency: "USD",
            description: exports.PILOT_DESCRIPTION,
            email,
            customData,
            locale: "en",
            successAppId: exports.PILOT_PRODUCT,
        });
        const журнал = zapisatVZhurnal({ ts: new Date().toISOString(), kind: "pilot_490_checkout", intentId: intent.intentId, email, channel, post, path });
        if (журнал)
            console.error("[proof/pilot-checkout] журнал:", журнал);
        return res.json({ ok: true, url: intent.checkoutUrl, provider: "lemonsqueezy", mode: "real", intentId: intent.intentId, product: exports.PILOT_PRODUCT, amountCents: exports.PILOT_USD * 100, currency: "USD", journaled: !журнал });
    }
    catch (err) {
        console.error("[proof/pilot-checkout] failed:", err instanceof Error ? err.message : err);
        return res.status(503).json({ ok: false, error: "checkout_failed", message: "The checkout could not be opened. Nothing was charged — send the request form instead." });
    }
});
function pismoObOplate(z) {
    const сумма = z.totalCents == null ? "—" : `$${(z.totalCents / 100).toFixed(2)}`;
    const text = [
        `Pilot $${exports.PILOT_USD} — ${z.revoke ? "REFUNDED" : "PAID"}${z.testMode ? " (LemonSqueezy test mode)" : ""}`,
        ``,
        `Email:   ${z.email || "—"}`,
        `Total:   ${сумма}`,
        `Order:   ${z.orderId ?? "—"} (${z.event})`,
        `Channel: ${z.channel ?? "—"} · post: ${z.post ?? "—"}`,
        ``,
        z.revoke
            ? `The order was refunded: stop the pilot if it has started.`
            : `Promised on the thank-you page: email the buyer within 24 hours with the record format we need and a fixed delivery date.`,
    ].join("\n");
    return { to: exports.PILOT_TO, subject: `Pilot ${z.revoke ? "REFUNDED" : "PAID"} — $${exports.PILOT_USD} — ${z.email || "no email"}`, text, html: `<pre style="font:14px/1.5 ui-monospace,monospace">${esc(text)}</pre>` };
}
/** Заказ пилота из вебхука кассы: журнал + письмо нам + событие оплаты. Отказы названы, не проглочены. */
async function obrabotatZakazPilota(z) {
    const errors = [];
    const журнал = zapisatVZhurnal({ ts: new Date().toISOString(), kind: z.revoke ? "pilot_490_refunded" : "pilot_490_paid", ...z });
    if (журнал)
        errors.push("leads: " + журнал);
    const нам = await (0, provisioning_1.sendEmail)(pismoObOplate(z));
    if (!нам.ok)
        errors.push("mail-us: " + (нам.error ?? "failed"));
    if (!z.revoke) {
        try {
            await Promise.resolve((0, paymentConfirmedEvent_1.записатьПодтверждённуюОплату)({ source: "lemonsqueezy", tier: exports.PILOT_PRODUCT, reference: exports.PILOT_PRODUCT, event: z.event, email: z.email || null, value: z.totalCents == null ? exports.PILOT_USD : z.totalCents / 100 }));
        }
        catch (err) {
            errors.push("event: " + (err instanceof Error ? err.message : String(err)));
        }
    }
    for (const e of errors)
        console.error("[proof/pilot-paid]", z.orderId ?? "", e);
    return { journaled: !журнал, mailed: нам.ok, errors };
}
