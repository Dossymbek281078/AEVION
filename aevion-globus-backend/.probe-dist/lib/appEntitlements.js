"use strict";
/**
 * Права, купленные ОТДЕЛЬНОЙ подпиской на модуль (`AppSubscription`).
 *
 * Зачем это появилось. Замер 13.08.2026: девять модулей продаются отдельными
 * подписками ($19–$149/мес), вебхук честно пишет покупку в `AppSubscription` —
 * и дальше строка лежит мёртвым грузом. `planGate` брал права только из тарифа
 * (`data/subscriptions.jsonl`) и из JWT, про эту таблицу не знал. То есть при
 * включении платного доступа купивший модуль остался бы снаружи наравне с
 * гостем: заплатил и не пустили.
 *
 * ВАЖНО про сегодняшнее поведение: ни один из продаваемых модулей сейчас не
 * закрыт платным доступом, поэтому подключение этого источника прав НИЧЕГО не
 * меняет на проде — оно только добавляет права, никогда не отнимает. Это
 * недостающее звено, которое нужно при любом решении о витрине.
 *
 * Стоимость. Запрос к базе делается ТОЛЬКО тогда, когда проверка по тарифу уже
 * отказала, то есть для тех, кого вот-вот развернут. Обычный путь (доступ есть
 * либо пейволл выключен) в базу не ходит вовсе.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAppEntitlementsCache = resetAppEntitlementsCache;
exports.appSubscriptionState = appSubscriptionState;
exports.podpiskaNaSlag = podpiskaNaSlag;
exports.findAppSubscriptionByIntent = findAppSubscriptionByIntent;
exports.upsertAppSubscription = upsertAppSubscription;
const dbPool_1 = require("./dbPool");
const ensureAppSubscriptionTable_1 = require("./ensureAppSubscriptionTable");
const lemonSqueezyVariants_1 = require("../data/lemonSqueezyVariants");
/** Короткий кэш: покупка применится не позже этого срока после оплаты. */
const TTL_MS = 60000;
const cache = new Map();
/** Для тестов: сбросить кэш между случаями. */
function resetAppEntitlementsCache() {
    cache.clear();
}
async function activeAppsFor(email) {
    const key = email.trim().toLowerCase();
    if (!key)
        return new Set();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now())
        return hit.apps;
    try {
        const pool = (0, dbPool_1.getPool)();
        await (0, ensureAppSubscriptionTable_1.ensureAppSubscriptionTable)(pool);
        const r = await pool.query(`SELECT "appSlug" FROM "AppSubscription" WHERE "email"=$1 AND "status"='active'`, [key]);
        const apps = new Set(r.rows.map((row) => String(row.appSlug).trim().toLowerCase()));
        cache.set(key, { apps, expiresAt: Date.now() + TTL_MS });
        return apps;
    }
    catch (err) {
        // Упавшее чтение НЕ становится фактом «подписки нет»: возвращаем null,
        // чтобы вызывающий отличал «проверено, не куплено» от «проверить не вышло».
        // Ответ пустым множеством молча лишил бы прав заплатившего человека.
        console.error("[appEntitlements] query failed:", err instanceof Error ? err.message : err);
        return null;
    }
}
async function appSubscriptionState(email, moduleId) {
    const slug = (0, lemonSqueezyVariants_1.appSlugForModuleId)(moduleId);
    if (!slug)
        return "none"; // модуль не продаётся отдельно — и спрашивать нечего
    return podpiskaNaSlag(email, slug);
}
/**
 * То же, но по СЛАГУ подписки напрямую.
 *
 * Понадобилось тарифу DevHub «Старт» (12.10.2026): он продаётся слагом
 * `devhub_start`, которому не соответствует никакой модуль — это не отдельное
 * приложение, а другой объём того же DevHub. Отдельную копию чтения заводить
 * нельзя: читать подписки надо ОДНИМ способом, иначе две копии разойдутся
 * молча, и расхождение будет видно только там, куда никто не смотрит.
 */
async function podpiskaNaSlag(email, slug) {
    if (!email)
        return "none";
    const apps = await activeAppsFor(email);
    if (apps === null)
        return "unknown"; // чтение не удалось, а не «не куплено»
    return apps.has(slug) ? "active" : "none";
}
/**
 * Записать/снять подписку на отдельный модуль.
 *
 * Живёт здесь, а не в вебхуке: её нужны ОБА рельса — Lemon Squeezy и Gumroad.
 * Копия в каждом вебхуке разошлась бы молча, а расхождение видно только при
 * сравнении, то есть там, куда никто не смотрит.
 */
/**
 * Покупка ОТДЕЛЬНОГО приложения по нашему номеру намерения оплаты.
 *
 * Зачем отдельная функция. Экран после оплаты спрашивает /checkout/status по
 * номеру, который сам же получил в адресе возврата. Для тарифа ответ находится
 * в платформенных подписках; покупка приложения туда не пишется вовсе — своя
 * ветка вебхука, своё хранилище. Замер 22.09.2026: поэтому у купившего
 * приложение подтверждение не наступало НИКОГДА, и он навсегда видел «оплата
 * принята» вместо «доступ открыт», хотя доступ был выдан.
 *
 * null — «не нашли» (это не отказ и не ошибка). Исключение НЕ глотаем: у
 * вызывающего должно быть право отличить «не нашли» от «спросить не удалось».
 */
async function findAppSubscriptionByIntent(bureauIntentId) {
    const id = bureauIntentId.trim();
    if (!id)
        return null;
    const pool = (0, dbPool_1.getPool)();
    await (0, ensureAppSubscriptionTable_1.ensureAppSubscriptionTable)(pool);
    const r = await pool.query(`SELECT "appSlug","status" FROM "AppSubscription" WHERE "bureauIntentId"=$1 LIMIT 1`, [id]);
    const row = r.rows?.[0];
    return row ? { appSlug: String(row.appSlug), status: String(row.status) } : null;
}
async function upsertAppSubscription(email, appSlug, status, externalSubId, 
/** Наш номер намерения оплаты — им спрашивает экран после оплаты. */
bureauIntentId) {
    const pool = (0, dbPool_1.getPool)();
    try {
        // Создание таблицы нужно и на ЗАПИСИ, а не только на чтении: покупка
        // приходит вебхуком, и он вполне может быть первым, кто трогает таблицу.
        await (0, ensureAppSubscriptionTable_1.ensureAppSubscriptionTable)(pool);
        await pool.query(`INSERT INTO "AppSubscription" ("id","email","appSlug","lsSubId","status","bureauIntentId","createdAt","updatedAt")
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT ("email","appSlug") DO UPDATE
         SET "status"=$4, "lsSubId"=COALESCE($3,"AppSubscription"."lsSubId"),
             "bureauIntentId"=COALESCE($5,"AppSubscription"."bureauIntentId"), "updatedAt"=NOW()`, [email.trim().toLowerCase(), appSlug, externalSubId ?? null, status, bureauIntentId ?? null]);
    }
    catch (err) {
        console.error("[appEntitlements] upsert failed:", err instanceof Error ? err.message : err);
        // Не глотаем: молчаливый 200 при неудавшейся записи означает «заплатил,
        // доступа нет, следов нет».
        throw err;
    }
    // Кэш прав держит до минуты — после записи он обязан устареть немедленно,
    // иначе только что купивший упрётся в отказ.
    cache.delete(email.trim().toLowerCase());
}
