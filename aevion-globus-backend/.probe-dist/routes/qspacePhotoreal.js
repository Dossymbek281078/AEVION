"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ЦЕНА_КАДРА_USD = exports.qspacePhotorealRouter = void 0;
exports.свежийОтказ = свежийОтказ;
exports.забытьОтказ = забытьОтказ;
exports.ключНастроен = ключНастроен;
exports.расходЗаСутки = расходЗаСутки;
/**
 * QSpace — фотореалистичный вид помещения.
 *
 * Модель квартиры мы строим сами из чертежа, и это наша сильная сторона:
 * планировка настоящая, а не выдуманная. Но браузерный движок даёт
 * визуализацию, а решение о ремонте человек принимает по ФОТОГРАФИИ. Здесь
 * кадр из нашей сцены отправляется в генеративный сервис и возвращается
 * снимком готового ремонта — с той же планировкой и того же ракурса.
 *
 * Почему это на СЕРВЕРЕ, а не в браузере: ключ доступа к сервису нельзя
 * отдавать странице ни при каких условиях — его вынут из запроса в первый же
 * день и потратят наши деньги. Браузер присылает картинку, ключ остаётся тут.
 *
 * Стоимость замерена 28.09.2026: 0.25 кредита за кадр. Поэтому здесь есть
 * ограничитель темпа — не «на всякий случай», а потому что каждый вызов
 * стоит денег.
 */
const express_1 = require("express");
const denPoMestnomu_1 = require("../lib/denPoMestnomu");
const rateLimit_1 = require("../lib/rateLimit");
const sentry_1 = require("../lib/sentry");
exports.qspacePhotorealRouter = (0, express_1.Router)();
/** Кадры живут ДЕСЯТЬ МИНУТ: их забирает сервис генерации и больше никто. */
const ЖИЗНЬ_КАДРА_МС = 10 * 60 * 1000;
/** Больше 6 МБ страница не пришлёт: кадр холста 1600×1100 весит около 2 МБ. */
const ПРЕДЕЛ_БАЙТ = 6 * 1024 * 1024;
const кадры = new Map();
function убратьПросроченные(сейчас = Date.now()) {
    for (const [id, к] of кадры)
        if (к.до <= сейчас)
            кадры.delete(id);
}
/**
 * Настроен ли доступ к сервису.
 *
 * Отвечает ТРЕМЯ исходами, а не двумя: настроено, не настроено, и «задано, но
 * пусто» — последнее выглядит как настроенное и молча ломает выдачу
 * (см. «задана ≠ непустая», замер 31.08.2026).
 */
/**
 * Цена одного кадра — из кабинета поставщика, а не из памяти.
 *
 * 🔴 Здесь стояло `costCredits: 0.25`. Такого числа не существует: замер
 * 29.09–05.10.2026 показал, что у REST-API поставщика ОТДЕЛЬНЫЙ кошелёк (его
 * не пополняет подписка Ultra), и кадр стоит $0.04. Выдуманная единица
 * «кредиты» делала цифру непроверяемой — её нельзя было ни сверить с
 * кабинетом, ни сложить в смету.
 */
exports.ЦЕНА_КАДРА_USD = 0.04;
/** Адрес модели: нужен, чтобы отказ поставщика называл, ЧТО именно отказало. */
const АДРЕС_МОДЕЛИ = "https://api.higgsfield.ai/xai/grok-imagine-image-2.0";
/**
 * Последний отказ поставщика по доступу (401/403).
 *
 * Живёт в памяти процесса: это подсказка интерфейсу, а не учёт.
 *
 * 🔴 Повод, замер 30.09.2026 на проде: ключ ИСПРАВЕН — ручка статуса с теми же
 * данными отвечает 404, значит авторизация проходит, — а генерация отвечает
 * 403: модель нашему ключу не открыта. `healthz` при этом говорил
 * «Фотореалистичный вид доступен», кнопку видел каждый посетитель, и каждое
 * нажатие уходило в отказ. Признак «ключ задан» отвечал на ДРУГОЙ вопрос, чем
 * «этим ключом можно нарисовать» — тот же класс, что «ключ годен» против
 * «можно тратить» у поставщиков ИИ.
 */
let отказПоставщика = null;
/** Отказ считается свежим 30 минут: доступ могут открыть в любой момент. */
const ЖИЗНЬ_ОТКАЗА_МС = 30 * 60 * 1000;
function свежийОтказ(сейчас = Date.now()) {
    if (!отказПоставщика)
        return null;
    if (сейчас - отказПоставщика.когда > ЖИЗНЬ_ОТКАЗА_МС)
        return null;
    return { код: отказПоставщика.код, адрес: отказПоставщика.адрес };
}
/** Только для тестов: вернуть модуль в исходное состояние. */
function забытьОтказ() { отказПоставщика = null; }
function ключНастроен(env = process.env) {
    const id = env.HIGGSFIELD_KEY_ID;
    const secret = env.HIGGSFIELD_KEY_SECRET;
    return typeof id === "string" && id.trim() !== ""
        && typeof secret === "string" && secret.trim() !== "";
}
const лимит = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 6,
    message: "Слишком много запросов фотореалистичного вида. Подождите минуту.",
});
/**
 * СУТОЧНЫЙ предел кадров — защита кошелька, а не вежливость.
 *
 * Кредиты у нас ОБЩИЕ с пайплайном DevHub: баланс 278.82 на 29.09.2026, кадр
 * стоит 0.25, то есть весь остаток это 1115 кадров. Ограничитель на минуту от
 * слива не спасает: шесть кадров в минуту это 8640 в сутки, вдесятеро больше
 * всего баланса. Предел по умолчанию 60 кадров в сутки = 15 кредитов, при
 * нынешнем живом трафике (137 визитов платформы за 14 дней, около 10 в день)
 * это с запасом, а кошелёк переживёт 18 дней даже при полной выборке.
 *
 * Меняется переменной QSPACE_PHOTOREAL_DAILY_MAX без правки кода.
 */
function суточныйПредел(env = process.env) {
    const сырое = Number(env.QSPACE_PHOTOREAL_DAILY_MAX);
    return Number.isFinite(сырое) && сырое > 0 ? Math.floor(сырое) : 60;
}
let деньСчёта = "";
let кадровЗаДень = 0;
/** Сколько кадров уже нарисовано сегодня (по UTC-дате). */
function расходЗаСутки(сейчас = new Date()) {
    const день = (0, denPoMestnomu_1.denPoMestnomu)(сейчас);
    if (день !== деньСчёта) {
        деньСчёта = день;
        кадровЗаДень = 0;
    }
    return { день, кадров: кадровЗаДень, предел: суточныйПредел() };
}
function учестьКадр() {
    расходЗаСутки();
    кадровЗаДень += 1;
}
/**
 * Состояние канала — чтобы страница спрашивала, а не догадывалась.
 * Обещать кнопку, за которой ничего нет, нельзя: это «доступность против
 * пригодности» (§15), от которой человек уходит навсегда.
 */
exports.qspacePhotorealRouter.get("/healthz", (_req, res) => {
    // «Ключ задан» и «этим ключом можно нарисовать» — РАЗНЫЕ утверждения.
    // Раньше здесь отвечало первое, а страница спрашивала второе.
    const отказ = свежийОтказ();
    const доступно = ключНастроен() && !отказ;
    res.json({
        ok: true,
        configured: доступно,
        keySet: ключНастроен(),
        upstreamRefusal: отказ ? { code: отказ.код, model: отказ.адрес } : null,
        costUsd: exports.ЦЕНА_КАДРА_USD,
        dailyUsed: расходЗаСутки().кадров,
        dailyMax: расходЗаСутки().предел,
        note: отказ
            ? `Фотореалистичный вид временно недоступен: сервис генерации ответил ${отказ.код}.`
            : ключНастроен()
                ? "Фотореалистичный вид доступен."
                : "Фотореалистичный вид выключен: на сервере не задан ключ доступа к сервису генерации.",
    });
});
/** Отдаёт кадр сервису генерации по временной ссылке. */
exports.qspacePhotorealRouter.get("/frame/:id.png", (req, res) => {
    убратьПросроченные();
    const к = кадры.get(String(req.params.id));
    if (!к)
        return res.status(404).json({ error: "not_found", message: "Кадр устарел или не найден." });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.send(к.png);
});
exports.qspacePhotorealRouter.post("/", лимит, async (req, res) => {
    if (!ключНастроен()) {
        // Отказ НАЗЫВАЕТ себя: молчаливая заглушка здесь означала бы, что человек
        // жмёт кнопку и не понимает, почему ничего не происходит.
        return res.status(503).json({
            error: "not_configured",
            message: "Фотореалистичный вид пока выключен: на сервере не задан ключ доступа к сервису генерации.",
        });
    }
    const расход = расходЗаСутки();
    if (расход.кадров >= расход.предел) {
        // Отказ НАЗЫВАЕТ число: «попробуйте позже» без цифры человек читает как поломку.
        return res.status(429).json({
            error: "daily_limit",
            message: `Сегодня уже нарисовано ${расход.кадров} кадров из ${расход.предел}. Предел суточный, он вернётся завтра.`,
        });
    }
    const body = (req.body ?? {});
    const base64 = typeof body.imageBase64 === "string" ? body.imageBase64.replace(/^data:image\/png;base64,/, "") : "";
    if (!base64) {
        return res.status(400).json({ error: "no_image", message: "Не пришёл кадр сцены." });
    }
    let png;
    try {
        png = Buffer.from(base64, "base64");
    }
    catch {
        return res.status(400).json({ error: "bad_image", message: "Кадр не разобрался как PNG." });
    }
    if (png.length === 0 || png.length > ПРЕДЕЛ_БАЙТ) {
        return res.status(400).json({
            error: "bad_size",
            message: `Кадр весит ${png.length} байт, а принимаются от 1 до ${ПРЕДЕЛ_БАЙТ}.`,
        });
    }
    убратьПросроченные();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    кадры.set(id, { png, до: Date.now() + ЖИЗНЬ_КАДРА_МС });
    const основа = process.env.PUBLIC_API_BASE || "https://api.aevion.app";
    const ссылкаКадра = `${основа}/api/qspace/photoreal/frame/${id}.png`;
    const подсказка = typeof body.prompt === "string" && body.prompt.trim()
        ? body.prompt.trim().slice(0, 1200)
        : "Фотореалистичный интерьерный снимок готовой квартиры после ремонта.";
    const соотношение = typeof body.aspectRatio === "string" ? body.aspectRatio : "3:2";
    try {
        const ответ = await fetch("https://api.higgsfield.ai/xai/grok-imagine-image-2.0", {
            method: "POST",
            headers: {
                Authorization: `Key ${process.env.HIGGSFIELD_KEY_ID}:${process.env.HIGGSFIELD_KEY_SECRET}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: `${подсказка} СТРОГО сохрани планировку, геометрию, ракурс и расположение предметов `
                    + "исходного изображения: те же стены, проёмы, окна и мебель на тех же местах, те же "
                    + "пропорции помещения. Реалистичные материалы, мягкие тени, естественный свет, "
                    + "плинтусы, розетки и выключатели. Без людей, без текста, без водяных знаков.",
                image_urls: [ссылкаКадра],
                resolution: "1k",
                quality: "medium",
                aspect_ratio: соотношение,
            }),
        });
        const данные = (await ответ.json().catch(() => null));
        if (!ответ.ok || !данные) {
            // Отказ ПО ДОСТУПУ запоминаем: иначе healthz продолжит обещать кадр,
            // а кнопку увидит каждый посетитель и каждое нажатие уйдёт в 403.
            // Прочие коды (таймаут, 5xx у поставщика) кнопку не гасят — они
            // проходят, а доступ либо есть, либо нет.
            if (ответ.status === 401 || ответ.status === 403) {
                отказПоставщика = { когда: Date.now(), код: ответ.status, адрес: АДРЕС_МОДЕЛИ };
            }
            return res.status(502).json({
                error: "upstream",
                message: `Сервис генерации ответил ${ответ.status}.`,
                detail: данные?.message ?? null,
            });
        }
        // Кадр получен — значит доступ есть, и прежний отказ больше не актуален.
        отказПоставщика = null;
        учестьКадр();
        return res.json({
            ok: true,
            requestId: данные.request_id ?? null,
            statusUrl: данные.status_url ?? null,
            frameUrl: ссылкаКадра,
            costUsd: exports.ЦЕНА_КАДРА_USD,
        });
    }
    catch (e) {
        (0, sentry_1.captureException)(e);
        return res.status(502).json({ error: "upstream_unreachable", message: "Сервис генерации недоступен." });
    }
});
/** Опрос готовности: страница спрашивает нас, а не сервис — ключ не светится. */
exports.qspacePhotorealRouter.get("/status/:requestId", async (req, res) => {
    if (!ключНастроен()) {
        return res.status(503).json({ error: "not_configured", message: "Фотореалистичный вид выключен." });
    }
    const id = String(req.params.requestId).replace(/[^A-Za-z0-9_-]/g, "");
    if (!id)
        return res.status(400).json({ error: "bad_request", message: "Не указан запрос." });
    try {
        const ответ = await fetch(`https://api.higgsfield.ai/requests/${id}/status`, {
            headers: {
                Authorization: `Key ${process.env.HIGGSFIELD_KEY_ID}:${process.env.HIGGSFIELD_KEY_SECRET}`,
            },
        });
        const данные = (await ответ.json().catch(() => null));
        if (!ответ.ok || !данные) {
            return res.status(502).json({ error: "upstream", message: `Сервис ответил ${ответ.status}.` });
        }
        return res.json({
            ok: true,
            status: данные.status ?? "unknown",
            imageUrl: данные.images?.[0]?.url ?? null,
        });
    }
    catch (e) {
        (0, sentry_1.captureException)(e);
        return res.status(502).json({ error: "upstream_unreachable", message: "Сервис генерации недоступен." });
    }
});
