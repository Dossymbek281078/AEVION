"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaTrenera = exports.denAlmaty = exports.ССЫЛКА_НА_ТАРИФ = exports.ПЕРЕМЕННАЯ_НОРМЫ = void 0;
exports.normaTreneraVDen = normaTreneraVDen;
exports.klyuchiNormy = klyuchiNormy;
exports.ostatokNormy = ostatokNormy;
exports.zaschitatNormu = zaschitatNormu;
exports.sbrositNormu = sbrositNormu;
const rateLimit_1 = require("./rateLimit");
const denPoMestnomu_1 = require("./denPoMestnomu");
/**
 * Спящая дневная норма ИИ-тренера CyberChess (решение оркестратора 13.10.2026,
 * по образцу гостевого пропуска Мультичата).
 *
 * Пока переменная FREE_COACH_PER_DAY не задана — поведение прежнее, ручки её
 * не замечают. Задана (целое ≥ 0) — каждый гость (по IP и по устройству) и
 * каждый вошедший (по sub) получает столько ответов тренера в день; сверх —
 * 402 с upgradeUrl на тариф CyberChess. Так решение основателя «тренер N в
 * день» включается одной переменной, без выкатки.
 *
 * День — календарный по Алматы (как у воронки), а не UTC: иначе норма
 * «обновлялась» бы в 05:00 утра по месту (класс bd, 13.10: день по UTC).
 * Счёт живёт в памяти процесса (как у Мультичата): перезапуск обнуляет —
 * граница честно названа, это норма вежливости, а не касса.
 */
exports.ПЕРЕМЕННАЯ_НОРМЫ = "FREE_COACH_PER_DAY";
exports.ССЫЛКА_НА_ТАРИФ = "/pricing?app=cyberchess";
/** null — норма спит (переменная не задана или не число). */
function normaTreneraVDen() {
    const raw = process.env[exports.ПЕРЕМЕННАЯ_НОРМЫ];
    if (raw === undefined || raw.trim() === "")
        return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
/** День нормы — общий помощник платформы (волна 109); имя оставлено ради вызывающих. */
exports.denAlmaty = denPoMestnomu_1.denPoMestnomu;
const счёт = new Map();
function устройство(req) {
    return String(req.get("x-aevion-device") || req.body?.deviceId || "").trim().slice(0, 64);
}
/** Ключи, по которым один человек считается одним: вошедший — по sub, гость — по IP и устройству. */
function klyuchiNormy(req, день = (0, exports.denAlmaty)()) {
    const sub = req.auth?.sub;
    if (sub)
        return [`u:${sub}:${день}`];
    const out = [`ip:${(0, rateLimit_1.clientIp)(req)}:${день}`];
    const dev = устройство(req);
    if (dev)
        out.push(`dev:${dev}:${день}`);
    return out;
}
/** Ничего не тратит. null — норма спит. */
function ostatokNormy(req) {
    const лимит = normaTreneraVDen();
    if (лимит === null)
        return null;
    const использовано = Math.max(0, ...klyuchiNormy(req).map((k) => счёт.get(k) ?? 0));
    return { лимит, использовано, осталось: Math.max(0, лимит - использовано) };
}
/** Тратит одну единицу. Зовётся, когда человека ПУСКАЮТ. */
function zaschitatNormu(req) {
    for (const k of klyuchiNormy(req))
        счёт.set(k, (счёт.get(k) ?? 0) + 1);
}
/** Для тестов: новый день. */
function sbrositNormu() {
    счёт.clear();
}
/**
 * Слой перед ручками тренера. Спит — пропускает без следа. Проснулся —
 * при исчерпании отвечает 402 с адресом тарифа, иначе списывает и пропускает.
 */
const normaTrenera = (req, res, next) => {
    const о = ostatokNormy(req);
    if (о === null)
        return next();
    if (о.осталось <= 0) {
        res.status(402).json({
            error: "coach_quota_exhausted",
            message: `Бесплатная норма тренера на сегодня исчерпана (${о.лимит} в день). Подписка CyberChess снимает ограничение.`,
            limit: о.лимит,
            used: о.использовано,
            resetsAt: "полночь по Алматы",
            upgradeUrl: exports.ССЫЛКА_НА_ТАРИФ,
        });
        return;
    }
    zaschitatNormu(req);
    next();
};
exports.normaTrenera = normaTrenera;
