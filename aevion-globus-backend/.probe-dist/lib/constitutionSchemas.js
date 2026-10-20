"use strict";
/**
 * Constitution — Zod schemas and validation middleware factory.
 *
 * Usage:
 *   router.post("/foo", validate(FooSchema), async (req, res) => {
 *     const body = req.body as z.infer<typeof FooSchema>;
 *     ...
 *   });
 *
 * On validation failure returns 400 with:
 *   { error: "validation_failed", fields: [{field, message_ru}] }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactPublishSchema = exports.CommentCreateSchema = exports.VoteSchema = exports.WaitlistSubscribeSchema = exports.AiSuggestSchema = exports.ScenarioCreateSchema = exports.SlidersSchema = exports.SliderValue = void 0;
exports.validate = validate;
const zod_1 = require("zod");
/* ───── Human-readable RU messages ─────────────────────────────── */
/**
 * Сообщение Zod → человеческий русский текст.
 *
 * ⚠️ 19.08.2026: прежняя версия была написана под формулировки Zod v3, при том
 * что в зависимостях стоит v4 (комментарий утверждал обратное). Разошлись они
 * молча — тип возврата остался строкой, ничего не падало, — и наружу поехал
 * сырой английский в поле, которое НАЗЫВАЕТСЯ message_ru:
 *
 *   POST /api/constitution/waitlist/subscribe  {}
 *   → {"field":"email","message_ru":"Invalid input: expected string, received undefined"}
 *
 * Проверено на живом проде. Ловушек было две: v4 сменил формулировку
 * («Required» → «Invalid input: expected …»), а проверка искала слово
 * «Expected» с большой буквы, тогда как в v4 оно строчное. Поэтому теперь
 * сравнение регистронезависимое, и разбор идёт по КОДУ ошибки, а не по её
 * тексту: код — часть контракта библиотеки, текст меняется от версии к версии.
 *
 * Это форма подписки на /go — единственной ссылке из соцсетей. Английская
 * ошибка в русской форме отпугивает ровно того человека, ради которого
 * снимается ролик.
 */
function zodErrorToRu(iss) {
    const code = iss.code;
    const msg = (iss.message ?? "").toLowerCase();
    // Разбор по коду — устойчив к смене формулировок в новых версиях Zod.
    if (code === "invalid_type") {
        const received = iss.received;
        if (received === "undefined" || received === undefined)
            return "обязательное поле";
        return "неверный тип данных";
    }
    if (code === "too_small") {
        const min = iss.minimum;
        return min === undefined ? "значение слишком маленькое" : `минимум ${String(min)}`;
    }
    if (code === "too_big") {
        const max = iss.maximum;
        return max === undefined ? "значение слишком большое" : `максимум ${String(max)}`;
    }
    if (code === "invalid_format") {
        const fmt = iss.format;
        if (fmt === "email")
            return "неверный формат email";
        if (fmt === "url")
            return "неверная ссылка";
        return "неверный формат";
    }
    if (code === "invalid_value")
        return "недопустимое значение";
    if (code === "unrecognized_keys")
        return "лишнее поле";
    // Запасной разбор по тексту — на случай кодов, которых мы ещё не знаем.
    // Регистронезависимо: в v4 слова пишутся со строчной.
    if (msg.includes("invalid email"))
        return "неверный формат email";
    if (msg.includes("required"))
        return "обязательное поле";
    if (msg.includes("expected") && msg.includes("received"))
        return "неверный тип данных";
    // Последний рубеж: наружу не должен уйти английский текст библиотеки.
    // Лучше общее русское сообщение, чем developer-facing строка в форме.
    return "неверное значение";
}
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (result.success) {
            req.body = result.data;
            next();
            return;
        }
        const fields = result.error.issues.map((iss) => ({
            field: iss.path.join(".") || "body",
            message_ru: zodErrorToRu(iss),
        }));
        res.status(400).json({ error: "validation_failed", fields });
    };
}
/* ───── Slider schema ─────────────────────────────────────────── */
exports.SliderValue = zod_1.z.number().int().min(0).max(100);
exports.SlidersSchema = zod_1.z.object({
    floor: exports.SliderValue,
    ruleOfLaw: exports.SliderValue,
    rotation: exports.SliderValue,
    transparency: exports.SliderValue,
    multiStatus: exports.SliderValue,
    skinInGame: exports.SliderValue,
    polycentricity: exports.SliderValue,
    positiveSum: exports.SliderValue,
});
/* ───── Endpoint schemas ─────────────────────────────────────── */
exports.ScenarioCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(160),
    sliders: exports.SlidersSchema,
    regime: zod_1.z.string().max(120).optional(),
    metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
    tags: zod_1.z.array(zod_1.z.string().max(40)).max(20).optional(),
});
exports.AiSuggestSchema = zod_1.z.object({
    description: zod_1.z.string().min(8, "описание слишком короткое (мин. 8 символов)").max(4000),
});
exports.WaitlistSubscribeSchema = zod_1.z.object({
    email: zod_1.z.string().email("неверный формат email").max(120),
    source: zod_1.z.string().max(60).optional(),
    /** 132б (13.10.2026): гость DevHub оставляет почту после живого адреса — id проекта для письма на data@. */
    projectId: zod_1.z.string().max(64).regex(/^[A-Za-z0-9_-]+$/, "неверный id проекта").optional(),
    /** 135: язык гостя и его адреса — для письма гостю на его языке с обеими ссылками. */
    lang: zod_1.z.enum(["ru", "en", "kk"]).optional(),
    siteUrl: zod_1.z.string().max(200).regex(/^https:\/\/[a-z0-9.-]+\.pages\.dev\/?$/, "неверный адрес сайта").optional(),
    domain: zod_1.z.string().max(120).regex(/^[a-z0-9-]+\.aevion\.app$/, "неверный домен").optional(),
    /*
     * Канал привлечения — ОТДЕЛЬНО от source.
     *
     * source отвечает «с какой страницы», channel — «кто привёл». Раньше был
     * только первый, и на вопрос «какой канал приносит подписчиков» ответить
     * было нечем, хотя у покупок такой ответ с 30.08 есть. Список для запуска —
     * главный наш актив, и знать, чем он набран, важнее, чем по покупкам.
     *
     * Дописывать канал в source нельзя: его разбирает рассылка (метки через
     * запятую), и лишнее значение развело бы письма не туда.
     */
    channel: zod_1.z.string().max(24).regex(/^[a-z0-9-]+$/, "канал: только строчные латиница, цифры и дефис").optional(),
});
exports.VoteSchema = zod_1.z.object({
    vote: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(-1)]),
});
exports.CommentCreateSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, "текст обязателен").max(800, "максимум 800 символов"),
    authorName: zod_1.z.string().max(60).optional(),
});
const EnvelopeBase = zod_1.z.object({
    spec: zod_1.z.string().optional(),
    algo: zod_1.z.string().optional(),
    signedAt: zod_1.z.string().optional(),
    signature: zod_1.z.string().min(8),
    payload: zod_1.z.object({
        title: zod_1.z.string().min(1).max(160).optional(),
        sliders: exports.SlidersSchema.optional(),
        regime: zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), era: zod_1.z.string().optional() }).optional(),
        metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
        issuedAt: zod_1.z.string().optional(),
    }).passthrough(),
}).passthrough();
exports.ArtifactPublishSchema = zod_1.z.union([
    zod_1.z.object({ envelope: EnvelopeBase }).passthrough(),
    EnvelopeBase,
]);
