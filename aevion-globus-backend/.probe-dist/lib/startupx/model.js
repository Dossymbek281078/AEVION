"use strict";
/**
 * StartupX — listing model
 * ────────────────────────
 * The exchange sells three different things, and conflating them is what made
 * the first version useless: a one-line idea and a $200k-ARR product were the
 * same "idea" row with the same (absent) deal terms, so an investor could not
 * tell what was actually on offer.
 *
 * Three tiers, three different conversations:
 *
 *   idea    — nothing is built. The founder offers equity; the investor funds
 *             the build. Entry ticket is small, the risk is total.
 *   mvp     — something runs. The founder offers equity; the investor funds
 *             finishing it. Who does the remaining work is part of the deal.
 *   product — it works and (usually) earns. The conversation is a purchase:
 *             the whole company, or a stake in it.
 *
 * This file is the single source of truth for what a listing is. The route
 * validates against it; the assessor scores against it; the UI renders from it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_SPECS = exports.BUILD_BY = exports.DEAL_INTENTS = exports.LEGACY_STAGES = exports.TIERS = void 0;
exports.isTier = isTier;
exports.tierFromLegacyStage = tierFromLegacyStage;
exports.legacyStageForTier = legacyStageForTier;
exports.looksLikeEmail = looksLikeEmail;
exports.normalizeListing = normalizeListing;
exports.annualRevenueUsd = annualRevenueUsd;
exports.listingSignals = listingSignals;
exports.listingSectorDetection = listingSectorDetection;
exports.listingSector = listingSector;
const signals_1 = require("../qventure/signals");
const sectorDetect_1 = require("./sectorDetect");
// ── Tiers ────────────────────────────────────────────────────────────────────
exports.TIERS = ["idea", "mvp", "product"];
function isTier(v) {
    return typeof v === "string" && exports.TIERS.includes(v);
}
/** Legacy `stage` column values, kept so old rows keep rendering. */
exports.LEGACY_STAGES = ["idea", "prototype", "mvp", "scaling"];
/** Map a pre-tier row onto a tier. Used for the one-time backfill and for reads. */
function tierFromLegacyStage(stage) {
    switch (stage) {
        case "idea": return "idea";
        case "prototype":
        case "mvp": return "mvp";
        case "scaling": return "product";
        default: return "idea";
    }
}
/** The legacy column still has a CHECK constraint, so every write needs a value. */
function legacyStageForTier(tier) {
    return tier === "idea" ? "idea" : tier === "mvp" ? "mvp" : "scaling";
}
// ── Deal terms ───────────────────────────────────────────────────────────────
/** What the founder is actually proposing. Differs by tier — see TIER_SPECS. */
exports.DEAL_INTENTS = ["raise", "sell_stake", "sell_full"];
/** Who does the remaining engineering work once money is in. */
exports.BUILD_BY = ["founder", "investor", "shared"];
exports.TIER_SPECS = {
    idea: {
        id: "idea",
        label: "Только идея",
        offer: "Ничего не построено. Основатель отдаёт долю, инвестор финансирует разработку.",
        intents: ["raise"],
        ticketUsd: { low: 5000, high: 50000 },
        minDescription: 120,
        requiresDemoUrl: false,
    },
    mvp: {
        id: "mvp",
        label: "Идея + MVP",
        offer: "Рабочий прототип есть. Основатель отдаёт долю, инвестор финансирует доработку.",
        intents: ["raise", "sell_stake"],
        ticketUsd: { low: 25000, high: 250000 },
        minDescription: 200,
        requiresDemoUrl: true,
    },
    product: {
        id: "product",
        label: "Готовый продукт",
        offer: "Приложение работает. Разговор о покупке целиком или о выкупе доли.",
        intents: ["sell_full", "sell_stake", "raise"],
        ticketUsd: { low: 50000, high: 2000000 },
        minDescription: 200,
        requiresDemoUrl: true,
    },
};
const MAX = {
    title: 200,
    description: 6000,
    url: 500,
    notes: 1000,
    contact: 500,
    email: 200,
    geography: 120,
};
function num(v, opts = {}) {
    if (typeof v !== "number" || !Number.isFinite(v))
        return undefined;
    if (opts.min !== undefined && v < opts.min)
        return undefined;
    if (opts.max !== undefined && v > opts.max)
        return undefined;
    return v;
}
function str(v, max) {
    if (typeof v !== "string")
        return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : undefined;
}
/**
 * A deliberately loose email check: one @, something on each side, a dot in the
 * domain, no spaces. Not RFC-complete — the point is not to validate addresses
 * but to keep the exchange's promise. An investor's reply address is the only
 * way the founder can answer; "хочу обсудить" in that field looks like an offer
 * and is a dead end.
 */
function looksLikeEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
function isHttpUrl(v) {
    try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
    }
    catch {
        return false;
    }
}
function normalizeListing(body, opts = {}) {
    const requireDeal = opts.requireDeal !== false;
    const issues = [];
    const b = (body ?? {});
    const title = str(b.title, MAX.title);
    const description = str(b.description, MAX.description);
    const tier = isTier(b.tier) ? b.tier : null;
    if (!title)
        issues.push({ field: "title", message: "Название обязательно" });
    if (!tier)
        issues.push({ field: "tier", message: `Уровень обязателен: ${exports.TIERS.join(", ")}` });
    const spec = tier ? exports.TIER_SPECS[tier] : null;
    if (!description) {
        issues.push({ field: "description", message: "Описание обязательно" });
    }
    else if (spec && description.length < spec.minDescription) {
        issues.push({
            field: "description",
            message: `Для уровня «${spec.label}» нужно минимум ${spec.minDescription} символов — короче инвестор не поймёт, во что вкладывается`,
        });
    }
    const rawDeal = (b.deal ?? {});
    const intent = typeof rawDeal.intent === "string" && exports.DEAL_INTENTS.includes(rawDeal.intent)
        ? rawDeal.intent
        : null;
    if (!intent) {
        if (requireDeal)
            issues.push({ field: "deal.intent", message: `Тип сделки обязателен: ${exports.DEAL_INTENTS.join(", ")}` });
    }
    else if (spec && !spec.intents.includes(intent)) {
        issues.push({
            field: "deal.intent",
            message: `На уровне «${spec.label}» доступны только: ${spec.intents.join(", ")}`,
        });
    }
    const deal = {
        intent: intent ?? "raise",
        askUsd: num(rawDeal.askUsd, { min: 0, max: 1000000000 }),
        equityOfferedPct: num(rawDeal.equityOfferedPct, { min: 0, max: 100 }),
        buildBy: typeof rawDeal.buildBy === "string" && exports.BUILD_BY.includes(rawDeal.buildBy)
            ? rawDeal.buildBy
            : undefined,
        askingPriceUsd: num(rawDeal.askingPriceUsd, { min: 0, max: 1000000000 }),
        stakeForSalePct: num(rawDeal.stakeForSalePct, { min: 0, max: 100 }),
        stakePriceUsd: num(rawDeal.stakePriceUsd, { min: 0, max: 1000000000 }),
        notes: str(rawDeal.notes, MAX.notes),
    };
    // Each intent has its own required pair. Without both numbers there is no
    // deal to assess — the listing would be another "напишите мне" post.
    // Preview mode skips these entirely: terms are optional there, but anything
    // supplied is still parsed and checked, so the founder sees the same numbers
    // they will publish.
    if (requireDeal) {
        if (intent === "raise") {
            if (deal.askUsd === undefined || deal.askUsd <= 0) {
                issues.push({ field: "deal.askUsd", message: "Укажите, сколько денег нужно (USD)" });
            }
            if (deal.equityOfferedPct === undefined || deal.equityOfferedPct <= 0) {
                issues.push({ field: "deal.equityOfferedPct", message: "Укажите, какую долю отдаёте (%)" });
            }
        }
        if (intent === "sell_full" && (deal.askingPriceUsd === undefined || deal.askingPriceUsd <= 0)) {
            issues.push({ field: "deal.askingPriceUsd", message: "Укажите цену продажи (USD)" });
        }
        if (intent === "sell_stake") {
            if (deal.stakeForSalePct === undefined || deal.stakeForSalePct <= 0) {
                issues.push({ field: "deal.stakeForSalePct", message: "Укажите размер продаваемой доли (%)" });
            }
            if (deal.stakePriceUsd === undefined || deal.stakePriceUsd <= 0) {
                issues.push({ field: "deal.stakePriceUsd", message: "Укажите цену доли (USD)" });
            }
        }
    }
    const demoUrl = str(b.demoUrl, MAX.url);
    if (demoUrl && !isHttpUrl(demoUrl)) {
        issues.push({ field: "demoUrl", message: "Ссылка на демо должна начинаться с http(s)://" });
    }
    const repoUrl = str(b.repoUrl, MAX.url);
    if (repoUrl && !isHttpUrl(repoUrl)) {
        issues.push({ field: "repoUrl", message: "Ссылка на репозиторий должна начинаться с http(s)://" });
    }
    if (requireDeal && spec?.requiresDemoUrl && !demoUrl) {
        issues.push({
            field: "demoUrl",
            message: `На уровне «${spec.label}» нужна рабочая ссылка — инвестор должен увидеть продукт, а не поверить на слово`,
        });
    }
    const founderEmail = str(b.founderEmail, MAX.email);
    if (founderEmail && !looksLikeEmail(founderEmail)) {
        issues.push({ field: "founderEmail", message: "Похоже, это не email — по нему вам не смогут ответить" });
    }
    const rawMetrics = (b.metrics ?? {});
    const metrics = {
        mrrUsd: num(rawMetrics.mrrUsd, { min: 0, max: 1000000000 }),
        arrUsd: num(rawMetrics.arrUsd, { min: 0, max: 1000000000 }),
        users: num(rawMetrics.users, { min: 0, max: 1000000000 }),
        payingCustomers: num(rawMetrics.payingCustomers, { min: 0, max: 1000000000 }),
        growthMomPct: num(rawMetrics.growthMomPct, { min: -100, max: 1000 }),
        churnMonthlyPct: num(rawMetrics.churnMonthlyPct, { min: 0, max: 100 }),
        grossMarginPct: num(rawMetrics.grossMarginPct, { min: -100, max: 100 }),
        teamSize: num(rawMetrics.teamSize, { min: 0, max: 100000 }),
        monthsInDevelopment: num(rawMetrics.monthsInDevelopment, { min: 0, max: 600 }),
    };
    if (issues.length > 0 || !title || !description || !tier) {
        return { listing: null, issues };
    }
    return {
        listing: {
            title,
            description,
            tier,
            sector: str(b.sector, 80),
            geography: str(b.geography, MAX.geography),
            demoUrl,
            repoUrl,
            deal,
            metrics,
            founderEmail,
            contactMethod: str(b.contactMethod, MAX.contact),
        },
        issues,
    };
}
// ── Derived facts used by the assessor ───────────────────────────────────────
/** Annual revenue in USD from whatever the founder disclosed, or null. */
function annualRevenueUsd(metrics, parsed) {
    if (metrics?.arrUsd !== undefined && metrics.arrUsd > 0)
        return metrics.arrUsd;
    if (metrics?.mrrUsd !== undefined && metrics.mrrUsd > 0)
        return metrics.mrrUsd * 12;
    return parsed.revenueUsd;
}
/**
 * Signals for a listing: the founder's structured metrics take precedence over
 * whatever the text parser finds in the description, because typed numbers are
 * exact and parsed ones are a guess.
 */
function listingSignals(listing) {
    const text = [listing.description, listing.deal.notes ?? ""].join("\n");
    const parsed = text.trim() ? (0, signals_1.parsePlanSignals)(text) : (0, signals_1.emptySignals)();
    const m = listing.metrics;
    if (!m)
        return parsed;
    return (0, signals_1.mergeStructuredSignals)(parsed, {
        arrUsd: m.arrUsd,
        mrrUsd: m.mrrUsd,
        growthPct: m.growthMomPct,
        growthPeriod: m.growthMomPct !== undefined ? "MoM" : undefined,
        grossMarginPct: m.grossMarginPct,
        churnPct: m.churnMonthlyPct,
        churnPeriod: m.churnMonthlyPct !== undefined ? "monthly" : undefined,
        customers: m.payingCustomers ?? m.users,
    });
}
/**
 * The sector a listing is scored against, and where that choice came from.
 * The form's default is "определить автоматически", so this actually has to
 * determine something — see sectorDetect.ts for why that is not a given.
 */
function listingSectorDetection(listing) {
    // The title carries as much signal as a paragraph of the description — "AI-помощник
    // для юристов" says more about the market than three sentences about workflow — so
    // detection reads both.
    return (0, sectorDetect_1.detectSector)(listing.sector, `${listing.title}
${listing.description}`);
}
function listingSector(listing) {
    return listingSectorDetection(listing).sector;
}
