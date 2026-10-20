"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestGuestLink = requestGuestLink;
exports.confirmGuestLink = confirmGuestLink;
const node_crypto_1 = __importDefault(require("node:crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dbPool_1 = require("./dbPool");
const email_1 = require("./build/email");
/**
 * Связывание анонимного гостя DevHub с его покупкой.
 *
 * ЗАЧЕМ. Модуль намеренно работает без входа, а магазин знает покупателя
 * только по почте. Вебхук пишет тариф в DevHubEmailTier и, если аккаунт с
 * такой почтой есть, сразу выдаёт доступ. У гостя аккаунта нет — и человек,
 * заплативший $149, видел бы «Free plan».
 *
 * ПОЧЕМУ НЕ ПРОСТО ФОРМА «вот мой адрес». Адрес покупателя знает любой, кому
 * он его называл. Форма без подтверждения была бы способом присвоить чужую
 * покупку. Поэтому связывание подтверждается письмом НА ТОТ ЖЕ адрес.
 *
 * ПОЧЕМУ ОТВЕТ ВСЕГДА ОДИНАКОВ. Если отвечать «письмо отправлено» только
 * когда покупка есть, форма превращается в способ узнать, кто у нас покупал.
 * Наружу уходит одна фраза при любом исходе.
 */
const TTL_MINUTES = 30;
function normalize(email) {
    return String(email || "").trim().toLowerCase();
}
/** Разрешён ли адрес к связыванию: у него должна быть НЕ бесплатная покупка. */
async function paidTierFor(email) {
    const pool = (0, dbPool_1.getPool)();
    const r = await pool.query(`SELECT "tier" FROM "DevHubEmailTier" WHERE "email" = $1 LIMIT 1`, [email]);
    const tier = r.rows[0]?.tier ?? null;
    return tier && tier !== "free" ? String(tier) : null;
}
async function requestGuestLink(guestId, emailRaw, siteBase) {
    const email = normalize(emailRaw);
    if (!email || !email.includes("@"))
        return "no_purchase";
    let tier;
    try {
        tier = await paidTierFor(email);
    }
    catch (err) {
        // Упавшее чтение — это НЕ «покупки нет». Молчаливое превращение отказа
        // базы в отрицательный ответ оставило бы платящего без доступа, и никто
        // бы не узнал: снаружи это неотличимо от честного «такой покупки нет».
        console.error("[devhub/link] чтение тарифа не удалось:", err instanceof Error ? err.message : err);
        return "storage_down";
    }
    if (!tier)
        return "no_purchase";
    if (!(0, email_1.canSendEmail)()) {
        // Делать вид, что письмо ушло, нельзя: человек будет ждать его вечно.
        console.error("[devhub/link] транспорт почты не настроен — письмо не отправлено");
        return "transport_down";
    }
    const plaintext = node_crypto_1.default.randomBytes(24).toString("base64url");
    const hash = await bcryptjs_1.default.hash(plaintext, 10);
    const id = node_crypto_1.default.randomUUID();
    const expires = new Date(Date.now() + TTL_MINUTES * 60000);
    try {
        const pool = (0, dbPool_1.getPool)();
        await pool.query(`INSERT INTO "DevHubGuestLinkToken" ("id","guestId","email","tokenHash","expiresAt")
       VALUES ($1,$2,$3,$4,$5)`, [id, guestId, email, hash, expires]);
    }
    catch (err) {
        console.error("[devhub/link] токен не сохранён:", err instanceof Error ? err.message : err);
        return "storage_down";
    }
    const url = siteBase.replace(/[/]+$/, "") +
        "/devhub/link?id=" + encodeURIComponent(id) + "&token=" + encodeURIComponent(plaintext);
    const ok = await (0, email_1.send)(email, "Доступ к DevHub Studio Pro", [
        "<h2>Подключаем вашу покупку</h2>",
        "<p>Вы попросили связать эту покупку с браузером, в котором работаете.</p>",
        "<p><a href=" + JSON.stringify(url) + ">Подтвердить</a></p>",
        "<p>Ссылка действует " + TTL_MINUTES + " минут и работает только в том браузере, откуда её запросили.</p>",
        "<p style=\"font-size:12px;color:#64748b\">Если вы этого не просили — просто не открывайте ссылку. Без перехода ничего не изменится.</p>",
    ].join(""));
    if (!ok) {
        console.error("[devhub/link] отправка письма не удалась, адрес:", email);
        return "transport_down";
    }
    return "sent";
}
async function confirmGuestLink(id, token, guestId) {
    if (!id || !token || !guestId)
        return "invalid";
    const pool = (0, dbPool_1.getPool)();
    let row;
    try {
        const r = await pool.query(`SELECT "guestId","email","tokenHash","expiresAt","usedAt"
         FROM "DevHubGuestLinkToken" WHERE "id" = $1 LIMIT 1`, [id]);
        row = r.rows[0];
    }
    catch (err) {
        console.error("[devhub/link] чтение токена не удалось:", err instanceof Error ? err.message : err);
        return "storage_down";
    }
    if (!row)
        return "invalid";
    if (row.usedAt)
        return "invalid";
    if (new Date(row.expiresAt).getTime() < Date.now())
        return "invalid";
    // Ссылка действительна только в том браузере, откуда её запросили: иначе
    // письмо, попавшее к постороннему, привязало бы покупку к ЕГО гостю.
    if (row.guestId !== guestId)
        return "invalid";
    if (!(await bcryptjs_1.default.compare(token, row.tokenHash)))
        return "invalid";
    try {
        await pool.query(`INSERT INTO "DevHubGuestEmail" ("guestId","email") VALUES ($1,$2)
       ON CONFLICT ("guestId") DO UPDATE SET "email" = $2, "linkedAt" = NOW()`, [guestId, row.email]);
        await pool.query(`UPDATE "DevHubGuestLinkToken" SET "usedAt" = NOW() WHERE "id" = $1`, [id]);
    }
    catch (err) {
        console.error("[devhub/link] связывание не сохранено:", err instanceof Error ? err.message : err);
        return "storage_down";
    }
    return "linked";
}
