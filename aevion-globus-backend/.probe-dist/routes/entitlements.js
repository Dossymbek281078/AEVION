"use strict";
/**
 * Platform entitlements + paywall policy.
 *
 *   GET /api/me/entitlements  — per-module access map for the caller's plan.
 *       The frontend reads this to render locks/unlocks consistently with what
 *       the server actually enforces (same resolver as requireModule()).
 *
 *   GET /api/paywall/policy   — public, plan-independent: which tiers unlock
 *       each module and whether the paywall is currently enforced for it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.entitlementsRouter = void 0;
exports.minUnlockPriceUsd = minUnlockPriceUsd;
const express_1 = require("express");
const planGate_1 = require("../lib/planGate");
const pricing_1 = require("../data/pricing");
const lemonSqueezyVariants_1 = require("../data/lemonSqueezyVariants");
const paywallDenyLog_1 = require("../lib/paywallDenyLog");
exports.entitlementsRouter = (0, express_1.Router)();
/** Cheapest monthly USD price among the tiers that unlock a module (excluding
 *  free). This is what one denied caller would pay to get in — the unit for
 *  the funnel's revenue-opportunity estimate. Null when nothing paid unlocks
 *  it (shouldn't happen for a gated module, but stays honest if pricing is
 *  misconfigured). */
/**
 * Самый дешёвый способ открыть модуль — из тех, что РЕАЛЬНО можно купить.
 *
 * ⚠️ ПОПРАВКА 02.09.2026. Считался минимум по одним ТАРИФАМ, а у модуля есть
 * второй путь — добавка (`addonMonthly`). Имя обещало минимум, а отдавался
 * минимум по половине путей.
 *
 * Цена ошибки не косметическая: это число умножается на количество отказов и
 * даёт `mrrCeilingUsd` — «сколько денег на столе», по которому решают, что
 * чинить и что продвигать. Замер на живых данных: у `constitution` добавка
 * $9 против дешевейшего тарифа $49, то есть потолок завышался в 5.4 раза.
 *
 * ГРАНИЦА, и она решает: добавка учитывается ТОЛЬКО если её правда можно
 * купить, то есть у модуля есть ссылка варианта (`app_<id>`). Цена добавки
 * объявлена у 31 модуля, а купить можно 8 — для остальных дешевейший тариф
 * и есть настоящий минимум, и учитывать объявленную добавку значило бы
 * занижать потолок обещанием, которого мы не выполняем.
 *
 * Замер по восьми покупаемым: у четырёх добавка дешевле тарифа
 * (cyberchess 19/29, qventure 39/49, qcontract 19/49, constitution 9/49),
 * у одного равна, остальные вне сравнения.
 */
function minUnlockPriceUsd(moduleId) {
    const paidTiers = new Set((0, planGate_1.tiersForModule)(moduleId).map(planGate_1.normalizeTier).filter((t) => t !== "free"));
    const prices = pricing_1.TIERS
        .filter((t) => paidTiers.has((0, planGate_1.normalizeTier)(t.id)))
        .map((t) => t.priceMonthly)
        .filter((p) => typeof p === "number" && p > 0);
    // Добавка — второй путь, но только там, где у неё есть касса.
    if ((0, lemonSqueezyVariants_1.appSlugForModuleId)(moduleId)) {
        const addon = pricing_1.MODULES_PRICING.find((m) => m.id === moduleId)?.addonMonthly;
        if (typeof addon === "number" && addon > 0)
            prices.push(addon);
    }
    return prices.length ? Math.min(...prices) : null;
}
/** Caller-specific entitlements (resolves JWT / subscription). */
exports.entitlementsRouter.get("/me/entitlements", (req, res) => {
    res.json({ ...(0, planGate_1.getEntitlements)(req), generatedAt: new Date().toISOString() });
});
/** Public paywall policy — no auth, safe to cache on the edge. */
exports.entitlementsRouter.get("/paywall/policy", (_req, res) => {
    const modules = pricing_1.MODULES_PRICING.map((m) => ({
        module: m.id,
        requiredTiers: (0, planGate_1.tiersForModule)(m.id)
            .map(planGate_1.normalizeTier)
            .filter((t) => t !== "free"),
        enforced: (0, planGate_1.paywallEnabledFor)(m.id),
    }));
    res.json({
        modules,
        enforcedCount: modules.filter((m) => m.enforced).length,
        generatedAt: new Date().toISOString(),
    });
});
/** Public deny funnel — aggregate demand signal for paid modules.
 *  How many anonymous/free callers hit each module's 402 wall (module +
 *  tier counts only, никаких user ids). ?days=N clamped 1–90, default 30. */
exports.entitlementsRouter.get("/paywall/funnel", async (req, res) => {
    try {
        // `Number(x) || 30` не останавливает отрицательные: «zzz» даёт 30, а «-5»
        // проходит как есть и уезжает в окно выборки. Класс известный, поэтому
        // ограничиваем разумными пределами. Проверить ПОСЛЕДСТВИЕ в проекции
        // выручки нечем (в тестовой среде данных нет и всё равно ноль), но само
        // ограничение проверяемо и очевидно правильно.
        const запрошено = Math.floor(Number(req.query.days));
        const days = Number.isFinite(запрошено) ? Math.min(365, Math.max(1, запрошено)) : 30;
        const summary = await (0, paywallDenyLog_1.funnelSummary)(days);
        // Enrich each module with a revenue-opportunity ceiling: how many callers
        // hit the wall × the cheapest unlock price. It's a CEILING (denies are
        // requests, not unique would-be buyers, and not everyone converts) —
        // labeled as such in the UI — but it turns "N denials" into "up to $X/mo
        // if we convert this demand", which is the number that actually drives
        // which module to unblock/discount next.
        const byModule = summary.byModule.map((m) => {
            const unlockPriceUsd = minUnlockPriceUsd(m.module);
            // Второй потолок, посчитанный ТОЛЬКО по отказам от посетителей с
            // учётной записью. Первый считает все отказы подряд, и с 13.09.2026
            // известно, чем это плохо: запрос без учётной записи вовсе — обход
            // роботами, случайный заход — доходит до стены с тем же `free` и
            // попадает в ту же сумму (проверено на проде одним анонимным curl).
            //
            // Старое число НЕ трогаем и не переопределяем: по нему уже принимали
            // решения, и тихая смена смысла у числа с прежним именем — худшее из
            // возможных (см. правило про владельца числа). Рядом встаёт второе,
            // и разрыв между ними сам показывает, сколько в «спросе» шума.
            const registeredDenies = m.byAudience?.registered ?? 0;
            return {
                ...m,
                unlockPriceUsd,
                mrrCeilingUsd: unlockPriceUsd != null ? m.denies * unlockPriceUsd : null,
                mrrCeilingAccountUsd: unlockPriceUsd != null ? registeredDenies * unlockPriceUsd : null,
            };
        });
        const mrrCeilingUsd = byModule.reduce((s, m) => s + (m.mrrCeilingUsd ?? 0), 0);
        const mrrCeilingAccountUsd = byModule.reduce((s, m) => s + (m.mrrCeilingAccountUsd ?? 0), 0);
        res.json({
            ...summary,
            byModule,
            mrrCeilingUsd,
            mrrCeilingAccountUsd,
            generatedAt: new Date().toISOString(),
        });
    }
    catch {
        res.status(500).json({ error: "funnel failed" });
    }
});
