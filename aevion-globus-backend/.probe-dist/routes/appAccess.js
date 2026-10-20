"use strict";
/**
 * /api/apps/access — какие поштучные подписки активны У ЗАПРОСИВШЕГО.
 *
 * GET /api/apps/access              (Bearer)  -> { apps: ["qventure", ...] }
 * GET /api/apps/access/check?app=…  (Bearer)  -> { active: true|false }
 *
 * ⚠️ 28.08.2026: РАНЬШЕ ОБЕ РУЧКИ БЫЛИ ПУБЛИЧНЫМИ И БРАЛИ ПОЧТУ ИЗ ЗАПРОСА.
 *
 * То есть кто угодно, зная чужой адрес, узнавал, за что человек платит:
 *
 *     GET /api/apps/access?email=someone@example.com
 *     -> {"apps":["healthai","qmelanin"]}
 *
 * Это персональные данные, и среди наших товаров есть связанные со здоровьем
 * («Анти-седина», HealthAI, QMelanin). Ограничителя частоты на маршруте не
 * было, то есть список адресов можно было проверить целиком.
 *
 * В прежнем комментарии решение объяснялось так: «same pattern as
 * /api/pricing/subscription/me». Проверил — это НЕВЕРНО: сосед отвечает 401
 * без токена. Обоснование ссылалось на образец, который ведёт себя обратно.
 *
 * Теперь почта берётся ИЗ ТОКЕНА и параметр `email` не читается вовсе:
 * подделать чужой ответ нельзя даже случайно. Единственный клиент — личный
 * кабинет — уже авторизован, ему добавлен заголовок.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appAccessRouter = void 0;
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbPool_1 = require("../lib/dbPool");
const ensureAppSubscriptionTable_1 = require("../lib/ensureAppSubscriptionTable");
const authJwt_1 = require("../lib/authJwt");
const planGate_1 = require("../lib/planGate");
const lemonSqueezyVariants_1 = require("../data/lemonSqueezyVariants");
exports.appAccessRouter = (0, express_1.Router)();
/**
 * Почта запросившего — только из токена. Возвращает null, если токена нет
 * или он не разбирается; вызывающий отвечает 401.
 *
 * Параметр `email` из запроса СОЗНАТЕЛЬНО не читается: пока он читался,
 * ручка была оракулом «за что платит вот этот человек».
 */
function emailFromToken(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(auth.slice(7), (0, authJwt_1.getJwtSecret)(), {
            algorithms: ["HS256"],
        });
        // Проверяем ТИП, а не только истинность. Подделать такой токен нельзя —
        // он подписан нашим секретом, — но нестроковое поле (объект, число)
        // уронило бы `.toLowerCase()` и дало 500 вместо честного 401. Отказ
        // должен выглядеть отказом, а не поломкой сервера.
        return typeof payload.email === "string" && payload.email.length > 0
            ? payload.email.toLowerCase()
            : null;
    }
    catch {
        return null;
    }
}
/**
 * Список ПОШТУЧНЫХ покупок — и он намеренно НЕ включает модули, открытые
 * платформенным тарифом. Это ответ на другой вопрос: «за что вы платите
 * отдельно», а не «что вам доступно». Следующему, кто заметит расхождение с
 * /check: оно осознанное, а не забытое.
 */
exports.appAccessRouter.get("/", async (req, res) => {
    const email = emailFromToken(req);
    if (!email)
        return res.status(401).json({ error: "unauthorized" });
    try {
        const pool = (0, dbPool_1.getPool)();
        await (0, ensureAppSubscriptionTable_1.ensureAppSubscriptionTable)(pool);
        const result = await pool.query(`SELECT "appSlug" FROM "AppSubscription" WHERE "email"=$1 AND "status"='active'`, [email]);
        return res.json({ apps: result.rows.map((r) => r.appSlug) });
    }
    catch (err) {
        console.error("[appAccess] query error:", err instanceof Error ? err.message : err);
        return res.status(500).json({ error: "db error" });
    }
});
/**
 * 🔴 28.09.2026. У ПРАВ ДВА ИСТОЧНИКА, А ЭТА РУЧКА СМОТРЕЛА В ОДИН.
 *
 * Модуль открывается либо поштучной подпиской (строка AppSubscription), либо
 * платформенным тарифом. С 15.09 любой платный тариф даёт всю платформу. Здесь
 * же спрашивалась только таблица поштучных покупок — значит подписчик Full,
 * открыв «Глубокий анализ» в шахматах, получал `active:false`, замок «🔒
 * Открыть Pro» и предложение заплатить второй раз за то, что уже оплачено.
 *
 * Канонический гейт `requireModule` (planGate.ts) спрашивает ОБА источника —
 * расходились не права, а две двери в одну комнату. Порядок здесь тот же, что
 * у него: сперва тариф (он резолвится из токена и хранилища подписок, без
 * запроса в базу), потом база. Обычный путь платящего по тарифу базу вообще не
 * трогает.
 *
 * ТРИ ИСХОДА, А НЕ ДВА. «Спросить не удалось» — это НЕ «не куплено»: показать
 * «купите» тому, чей статус мы не выяснили, значит предложить заплатить дважды.
 * Поэтому если один источник сломался, а второй прав не дал, отвечаем 503, и
 * фронт (`checkAppAccess`) читает это как `unknown`, а не как отказ.
 */
exports.appAccessRouter.get("/check", async (req, res) => {
    const email = emailFromToken(req);
    if (!email)
        return res.status(401).json({ error: "unauthorized" });
    const app = String(req.query.app ?? "").trim().toLowerCase();
    if (!app)
        return res.status(400).json({ error: "app required" });
    // ── Источник 1: платформенный тариф ──────────────────────────────────
    // Слаг кассы и id модуля — РАЗНЫЕ имена одной вещи (`ip_bureau` против
    // `aevion-ip-bureau`), перевод живёт в одном месте и здесь только зовётся.
    let тарифОтветил = true;
    try {
        const план = (0, planGate_1.resolveUserPlan)(req);
        if ((0, planGate_1.isModuleEntitled)(план, (0, lemonSqueezyVariants_1.moduleIdForAppSlug)(app))) {
            return res.json({ active: true, source: "plan" });
        }
    }
    catch (err) {
        тарифОтветил = false;
        console.error("[appAccess] тариф не прочитан:", err instanceof Error ? err.message : err);
    }
    // ── Источник 2: поштучная подписка ───────────────────────────────────
    try {
        const pool = (0, dbPool_1.getPool)();
        await (0, ensureAppSubscriptionTable_1.ensureAppSubscriptionTable)(pool);
        const result = await pool.query(`SELECT 1 FROM "AppSubscription" WHERE "email"=$1 AND "appSlug"=$2 AND "status"='active' LIMIT 1`, [email, app]);
        if (result.rowCount > 0)
            return res.json({ active: true, source: "app" });
        if (!тарифОтветил) {
            // Прав не нашли, но один источник молчал — честное «не знаю».
            return res.status(503).json({ error: "entitlement_check_failed" });
        }
        return res.json({ active: false });
    }
    catch (err) {
        console.error("[appAccess] check error:", err instanceof Error ? err.message : err);
        return res.status(500).json({ error: "db error" });
    }
});
