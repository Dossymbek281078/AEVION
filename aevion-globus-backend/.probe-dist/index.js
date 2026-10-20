"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const buildInfo_1 = require("./lib/buildInfo");
const gracefulShutdown_1 = require("./lib/gracefulShutdown");
const dbPool_1 = require("./lib/dbPool");
const pricing_1 = require("./routes/pricing");
const dilithium_1 = require("./lib/qsignV2/dilithium");
const events_1 = require("./routes/events");
const provisioning_1 = require("./routes/provisioning");
const provisioning_2 = require("./routes/provisioning");
const providerGuard_1 = require("./lib/providerGuard");
const lemonSqueezyVariants_1 = require("./data/lemonSqueezyVariants");
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const qright_1 = require("./routes/qright");
const qsign_1 = require("./routes/qsign");
const qspacePhotoreal_1 = require("./routes/qspacePhotoreal");
const qsignV2_1 = require("./routes/qsignV2");
const webhooks_1 = require("./lib/qsignV2/webhooks");
const upgradeWorker_1 = require("./lib/opentimestamps/upgradeWorker");
const sentry_1 = require("./lib/qsignV2/sentry");
const qtrade_1 = require("./routes/qtrade");
const auth_1 = require("./routes/auth");
const authOauth_1 = require("./routes/authOauth");
const tiktok_1 = require("./routes/tiktok");
const planetCompliance_1 = require("./routes/planetCompliance");
const modules_1 = require("./routes/modules");
const helpContact_1 = require("./routes/helpContact");
const proofPilot_1 = require("./routes/proofPilot");
const status_1 = require("./routes/status");
const entitlements_1 = require("./routes/entitlements");
const planGate_1 = require("./lib/planGate");
const paywallHealth_1 = require("./lib/paywallHealth");
const awards_1 = require("./routes/awards");
const qcoreai_1 = require("./routes/qcoreai");
const agentRuntime_1 = require("./routes/agentRuntime");
const mcpDemo_1 = require("./routes/mcpDemo");
const wsServer_1 = require("./services/qcoreai/wsServer");
const collab_1 = require("./services/constitution/collab");
const quantum_shield_1 = require("./routes/quantum-shield");
const pipeline_1 = require("./routes/pipeline");
const bureau_1 = require("./routes/bureau");
const coach_1 = require("./routes/coach");
const pricing_2 = require("./routes/pricing");
const publicStats_1 = require("./routes/publicStats");
const checkout_1 = require("./routes/checkout");
const provisioning_3 = require("./routes/provisioning");
const lemonSqueezyWebhook_1 = require("./routes/lemonSqueezyWebhook");
const appAccess_1 = require("./routes/appAccess");
const gumroadWebhook_1 = require("./routes/gumroadWebhook");
const payboxWebhook_1 = require("./routes/payboxWebhook");
const paypalWebhook_1 = require("./routes/paypalWebhook");
const healthai_1 = require("./routes/healthai");
const events_2 = require("./routes/events");
const projects_1 = require("./data/projects");
const moduleRuntime_1 = require("./data/moduleRuntime");
const multichat_1 = require("./routes/multichat");
const multichatGuestPass_1 = require("./lib/multichatGuestPass");
const aev_1 = require("./routes/aev");
const ecosystem_1 = require("./routes/ecosystem");
const cyberchess_1 = require("./routes/cyberchess");
const cyberchessPuzzles_1 = __importDefault(require("./routes/cyberchessPuzzles"));
const cyberchessTournaments_1 = __importDefault(require("./routes/cyberchessTournaments"));
const cyberchessDaily_1 = __importDefault(require("./routes/cyberchessDaily"));
const cyberchessVoiceCoach_1 = __importDefault(require("./routes/cyberchessVoiceCoach"));
const cyberchessSpectator_1 = __importDefault(require("./routes/cyberchessSpectator"));
const cyberchessMatchmaking_1 = __importDefault(require("./routes/cyberchessMatchmaking"));
const cyberchessAnticheat_1 = __importDefault(require("./routes/cyberchessAnticheat"));
const cyberchessOpening_1 = __importDefault(require("./routes/cyberchessOpening"));
const puzzles_1 = require("./routes/puzzles");
const build_1 = require("./routes/build");
const aevion_hub_1 = require("./routes/aevion-hub");
const i18n_1 = require("./routes/i18n");
const qrightRoyalties_1 = require("./routes/qrightRoyalties");
const planetPayouts_1 = require("./routes/planetPayouts");
const planetConstitution_1 = require("./routes/planetConstitution");
const constitutionAi_1 = require("./routes/constitutionAi");
const constitutionPublic_1 = require("./routes/constitutionPublic");
const constitutionPdf_1 = require("./routes/constitutionPdf");
const constitutionPro_1 = require("./routes/constitutionPro");
const constitutionAdmin_1 = require("./routes/constitutionAdmin");
const constitutionFunnel_1 = require("./routes/constitutionFunnel");
const constitutionWaitlist_1 = require("./routes/constitutionWaitlist");
const agencyLead_1 = require("./routes/agencyLead");
const constitutionStatus_1 = require("./routes/constitutionStatus");
const constitutionCheckout_1 = require("./routes/constitutionCheckout");
const planetConstitutionSocial_1 = require("./routes/planetConstitutionSocial");
const bankTest_1 = require("./routes/bankTest");
const metrics_1 = require("./routes/metrics");
const smeta_trainer_1 = require("./routes/smeta-trainer");
const qcontract_1 = require("./routes/qcontract");
const qfusionai_1 = require("./routes/qfusionai");
const veilnetx_1 = require("./routes/veilnetx");
const shadownet_1 = require("./routes/shadownet");
const psyappDeps_1 = require("./routes/psyappDeps");
const lifebox_1 = require("./routes/lifebox");
const planningStubs_1 = require("./routes/planningStubs");
const mvpConcepts_1 = require("./routes/mvpConcepts");
const qpaynet_1 = require("./routes/qpaynet");
const qtradeoffline_1 = require("./routes/qtradeoffline");
const apiQuotas_1 = require("./routes/apiQuotas");
const apiKeys_1 = require("./routes/apiKeys");
const qgood_1 = require("./routes/qgood");
const qmaskcard_1 = require("./routes/qmaskcard");
const veilnetxLedger_1 = require("./routes/veilnetxLedger");
const ztide_1 = require("./routes/ztide");
const qchaingov_1 = require("./routes/qchaingov");
const openapiFintechSpec_1 = require("./lib/openapiFintechSpec");
const openapiNewWaveSpec_1 = require("./lib/openapiNewWaveSpec");
const sentry_2 = require("./lib/sentry");
const httpErrorHandler_1 = require("./lib/httpErrorHandler");
const bodyLimitByPath_1 = require("./lib/bodyLimitByPath");
const rawBodyPolicy_1 = require("./lib/rawBodyPolicy");
const devhub_1 = require("./routes/devhub");
const qmedia_1 = require("./routes/qmedia");
const payments_1 = require("./routes/payments");
const qai_1 = require("./routes/qai");
const channelsHealth_1 = require("./routes/channelsHealth");
const qstore_1 = require("./routes/qstore");
const qlearn_1 = require("./routes/qlearn");
const qmelanin_1 = require("./routes/qmelanin");
const qrenew_1 = require("./routes/qrenew");
const longevity_1 = require("./routes/longevity");
const qsocial_1 = require("./routes/qsocial");
const qnews_1 = require("./routes/qnews");
const qjobs_1 = require("./routes/qjobs");
const mapReality_1 = require("./routes/mapReality");
const startupExchange_1 = require("./routes/startupExchange");
const ventures_1 = require("./routes/ventures");
const kidsAiContent_1 = require("./routes/kidsAiContent");
const voiceOfEarth_1 = require("./routes/voiceOfEarth");
// qventure / qskyway / qevents routers are mounted via routes/moduleManifest.ts
const moduleManifest_1 = require("./routes/moduleManifest");
const deepsan_1 = require("./routes/deepsan");
const qpersona_1 = require("./routes/qpersona");
const qlife_1 = require("./routes/qlife");
const revenue_1 = require("./routes/revenue");
const search_1 = require("./routes/search");
const corsOrigins_1 = require("./lib/corsOrigins");
// Подключаем ТОЛЬКО QRight (он реально существует)
// (qrightRouter already imported above)
// Optional Sentry. No-op when SENTRY_DSN is unset OR @sentry/node missing.
(0, sentry_1.initSentry)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4001;
// Railway sits behind a reverse proxy — trust the first hop so that
// express-rate-limit reads the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);
// CORS_ALLOWED_ORIGINS: comma-separated allow-list (e.g. "https://aevion.app,https://aevion.vercel.app").
// Falls back to permissive (reflect any origin) when unset, matching prior
// behavior for local dev / environments that haven't configured it yet.
const corsAllowedOrigins = (0, corsOrigins_1.разрешённыеИсточники)(process.env.CORS_ALLOWED_ORIGINS);
app.use((0, cors_1.default)(corsAllowedOrigins.length > 0
    ? { origin: corsAllowedOrigins }
    : undefined));
// 10mb to accommodate base64-encoded resume scans posted to /api/build/ai/parse-resume.
// Plain JSON payloads everywhere else stay tiny — limit is just a ceiling.
//
// Узкие пределы по путям — ОБЯЗАТЕЛЬНО до общего разбора: после него тело уже
// прочитано, и меньший предел ставить поздно. Список и замеры — в модуле.
app.use(bodyLimitByPath_1.bodyLimitByPath);
// `verify` сохраняет сырые байты на req.rawBody для обработчиков, которые
// проверяют подпись побайтно (платёжные вебхуки: /api/qpaynet/deposit/webhook,
// /api/paypal/webhook и ещё семь — полный список и замеры в lib/rawBodyPolicy).
//
// Сохраняется НЕ на всех путях: ссылка на буфер продлевает ему жизнь до конца
// запроса, и на медиа-путях (тела в мегабайтах) это стоит десятков мегабайт при
// небольшой параллельности. Правило двойное — «мало ИЛИ вебхук» — чтобы
// устаревший список путей не сломал проверку подписи молча.
//
// Прежний комментарий здесь называл читателем /api/checkout/webhook — тот
// обработчик rawBody не читает вовсе (проверено грепом по src/).
// Управляющие байты в АДРЕСЕ — ошибка запроса, а не наша авария.
//
// Замер прода 08.09.2026 (зонд враждебного входа, 42 пробы с контролями):
// «%00» в пути доезжает до параметра, Postgres такую строку не принимает, и
// catch объявляет это отказом ХРАНИЛИЩА. Наружу шло 500 у /api/qright/objects,
// /api/planet/artifacts, /api/bureau/notaries (контроль «abc» у них честные
// 404), а у devhub — 503 плюс ложно красная полоса здоровья: чужой кривой
// запрос красил НАШ сигнал. Каждая такая ссылка бесплатно рождает тревогу в
// Sentry, среди которых потом не видно настоящих аварий (§15г: 4xx — про
// запрос, 5xx — «у нас сломалось»).
//
// Проверка стоит ДО роутеров, поэтому лечит все модули разом. Два условия
// написаны буквально так, как проверены на этой машине:
//   • charCodeAt, а не регулярка с экранированием — юникод-класс через
//     границу вызова однажды положил в исходник сырой NUL-байт;
//   • битая процентная последовательность (decodeURIComponent бросает) —
//     тоже клиентская ошибка, а не наша.
app.use((req, res, next) => {
    const raw = req.url || "";
    let decoded = raw;
    try {
        decoded = decodeURIComponent(raw);
    }
    catch {
        return res.status(400).json({ error: "bad request path: broken percent-encoding" });
    }
    for (const ch of decoded) {
        const code = ch.charCodeAt(0);
        if (code < 32 || code === 127) {
            return res.status(400).json({ error: "bad request path: control characters are not allowed" });
        }
    }
    next();
});
app.use(express_1.default.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
        const r = req;
        if ((0, rawBodyPolicy_1.needsRawBody)(r.originalUrl ?? r.url, buf.length)) {
            req.rawBody = buf;
        }
    },
}));
// Gumroad pings arrive as application/x-www-form-urlencoded. express.json
// ignores that content-type, so without this parser req.rawBody is never
// populated for form posts and /api/gumroad/webhook reads an empty body
// (→ every real ping silently ignored as no_email). Same verify hook stashes
// the raw bytes for the provider's optional HMAC signature check.
app.use(express_1.default.urlencoded({
    extended: false,
    limit: "1mb",
    // Та же политика, что у JSON: путь Gumroad в списке, поэтому его пинг получит
    // байты при любом размере, а прочие form-посты — только пока они малы.
    verify: (req, _res, buf) => {
        const r = req;
        if ((0, rawBodyPolicy_1.needsRawBody)(r.originalUrl ?? r.url, buf.length)) {
            req.rawBody = buf;
        }
    },
}));
// Health-check. Both /health (legacy) and /api/health (the path the
// frontend + diagnostics page have always probed against) return the
// same shape so existing callers don't break.
// Build/version marker so a post-deploy check can confirm exactly which commit
// is live instead of guessing from a 200. Railway injects RAILWAY_GIT_COMMIT_SHA
// at build time; falls back to GIT_SHA / SOURCE_VERSION, or "unknown" in local dev.
/**
 * Развёрнутый коммит. Переменных окружения оказалось недостаточно: проверено на
 * живом проде 13.08.2026 — /health отдавал "unknown", потому что
 * RAILWAY_GIT_COMMIT_SHA подставляется при сборке из подключённого репозитория, а
 * тот недоступен с 27.07. Поэтому сборка дополнительно пишет dist/build-info.json
 * (scripts/write-build-info.js), и он читается, когда переменных нет.
 *
 * Читаем синхронно и один раз при старте: файл рядом с dist/index.js, размером в
 * несколько строк, и цена — доли миллисекунды на запуск против невозможности
 * узнать, какой код работает.
 */
/**
 * builtAt отвечает на вопрос, который bootedAt не покрывает: контейнер Railway
 * перезапускается сам по себе, и тогда «поднялся 10 минут назад» относится к
 * образу недельной давности. Проверка выкатки (aevion-deploy-check.mjs) поле
 * уже печатает — и до 14.08.2026 печатала «собрана ?», потому что отдавать его
 * было некому.
 */
// Читатель отметки живёт в lib/buildInfo — его использует и routes/qreal.
const BUILD_INFO = (0, buildInfo_1.readBuildInfo)();
const BUILD_COMMIT = BUILD_INFO.commit;
const BOOT_TIME = new Date().toISOString();
function healthPayload() {
    return {
        status: "ok",
        service: "AEVION Globus Backend",
        timestamp: new Date().toISOString(),
        commit: BUILD_COMMIT,
        // Откуда взят коммит и какая ветка: "unknown" при source "none" значит
        // «маркер не собрался», а при source "env" — «переменная пустая». Разные
        // неисправности, и различать их надо не догадками.
        commitSource: BUILD_INFO.source,
        branch: BUILD_INFO.branch,
        // Когда СОБРАН образ. Не то же, что bootedAt: Railway перезапускает
        // контейнер сам, и «поднялся 10 минут назад» бывает у образа недельной
        // давности. null — честнее выдуманного времени.
        builtAt: BUILD_INFO.builtAt,
        // Ручка, по которой выкатку видно в панели, когда коммита нет. Появилась
        // 21.09.2026: прод отвечал commit "unknown", и опознать сборку было нечем —
        // выкатка встала у всех окон. Коммит она НЕ заменяет (см. buildInfo.ts).
        deploymentId: BUILD_INFO.deploymentId,
        // Настроена ли выдача купленного — ответ одной ручкой, без Railway и без
        // печати значений. Устройство и повод — в lib/paywallHealth.ts.
        paywall: (0, paywallHealth_1.сводкаПейволла)(),
        // Заявки — единственный след человека, который хотел купить, но не смог
        // (сегодня это четыре модуля запуска: касса отвечает 503 и отправляет его
        // на страницу «напишите нам»). Спрашиваем хранилище тем же вопросом, что
        // события и подписки: попадает ли файл под смонтированный том.
        leadsStore: (0, pricing_1.leadsStoreStatus)(),
        // Метка проверки конвейера 24.09.2026: три выкатки подряд приезжали без
        // последних коммитов, хотя сборка компилировала. Если этого поля нет на
        // проде после выкатки — значит уезжает не наш снимок, и искать надо в
        // конвейере, а не в коде.
        pipelineProbe: "2026-09-24",
        bootedAt: BOOT_TIME,
        uptimeSec: Math.floor((Date.now() - Date.parse(BOOT_TIME)) / 1000),
        // Аналитика пишется в файл. Если её самое старое событие всегда моложе
        // bootedAt выше — значит хранилище не переживает перезапуск, и метки
        // utm из рассылки теряются на каждом деплое. Раньше это было видно
        // только из переменных окружения; теперь видно отсюда. Счётчики и одна
        // метка времени, без единого поля самих событий.
        eventsStore: safeEventsStoreStatus(),
        // Рядом с событиями и той же формы: «переживут ли записи о покупках выкатку».
        // Поле, а не рассуждение о путях — см. subsStoreStatus в provisioning.ts.
        subsStore: safeSubsStoreStatus(),
        // Какой режим подписи реально активен. Письма партнёрам утверждают
        // «post-quantum signatures (ML-DSA-65, FIPS 204)», а это включается ключом:
        // без него прод отдаёт SHA-512, который наше же описание API называет
        // «NOT a cryptographic signature». Теперь проверяется одним запросом.
        qsign: safeDilithiumStatus(),
        // Письмо после покупки. Без ключа отправка «успешна» и молча уходит в лог:
        // покупатель не получает ни что он купил, ни как этим пользоваться, а
        // снаружи это неотличимо от исправной работы. Признак и адрес отправителя,
        // ключ не отдаём.
        emailSender: safeEmailSenderStatus(),
        // Какие товары магазина реально можно выдать. Товар в продаже с `false`
        // здесь — это будущий отказ на живом покупателе. Только признаки, без
        // самих идентификаторов вариантов.
        lsVariants: safeLsVariantStatus(),
        // Кем на самом деле делается проверка личности и платёж в бюро.
        // Переменные в проде НЕ заданы, и код молча берёт заглушку: проверка
        // паспорта отвечает «успех», не посмотрев паспорт, а платёжная заглушка
        // сама помечает платёж оплаченным. Сам сторож это уже ловит и пишет в
        // лог, но лог никто не читает снаружи — значит состояние надо отдавать
        // тем же способом, что режимы подписи, почты и вариантов кассы.
        // Имя поля узкое намеренно: это провайдеры БЮРО, а не всей платформы.
        bureauProviders: safeBureauProviders(),
    };
}
/** health не должен падать из-за диагностики. */
function safeDilithiumStatus() {
    try {
        return (0, dilithium_1.dilithiumStatus)();
    }
    catch {
        return { mode: null, reason: null };
    }
}
/** health не должен падать из-за диагностики. */
function safeLsVariantStatus() {
    try {
        return (0, lemonSqueezyVariants_1.lemonSqueezyVariantStatus)();
    }
    catch {
        return null;
    }
}
/**
 * health не должен падать из-за диагностики.
 *
 * При отказе отдаём null, а не «заглушки нет»: неотвеченный вопрос не равен
 * благополучию, и читатель обязан отличить «не знаю» от «всё настроено».
 */
function safeBureauProviders() {
    try {
        // Состояние считает bureauProvidersHealth(): ручка и её сторож обязаны
        // смотреть на один код. Почему поле не может считать «настроено» как
        // «переменная непустая» — объяснено там же.
        return (0, providerGuard_1.bureauProvidersHealth)();
    }
    catch {
        return { kyc: null, payment: null };
    }
}
/** health не должен падать из-за диагностики. */
function safeEmailSenderStatus() {
    try {
        return (0, provisioning_2.emailSenderStatus)();
    }
    catch {
        return { configured: null, from: null, mode: null };
    }
}
/** health не должен падать из-за диагностики. */
function safeSubsStoreStatus() {
    try {
        return (0, provisioning_1.subsStoreStatus)();
    }
    catch {
        return { persistedByEnv: null, onVolume: null, exists: null, count: null, oldest: null };
    }
}
/** health не должен падать из-за диагностики. */
function safeEventsStoreStatus() {
    try {
        return (0, events_1.eventsStoreStatus)();
    }
    catch {
        return { persistedByEnv: null, exists: null, count: null, oldest: null };
    }
}
app.get("/health", (_req, res) => res.json(healthPayload()));
app.get("/api/health", (_req, res) => res.json(healthPayload()));
// Deep health: aggregates ops-relevant counts so /bank/diagnostics +
// oncall don't have to compose multiple endpoints. No auth — counts
// only, no per-user data. If you need access control, gate via your
// load balancer or use METRICS_TOKEN on /api/metrics for richer detail.
const STARTED_AT = Date.now();
app.get("/api/health/deep", async (_req, res) => {
    // Lazy imports so this module's load order doesn't fight with
    // ecosystem persistence. Errors are caught and surfaced.
    try {
        const { getQtradeMetrics } = await Promise.resolve().then(() => __importStar(require("./routes/qtrade")));
        const { getEcosystemMetrics, ensureEcosystemLoaded } = await Promise.resolve().then(() => __importStar(require("./routes/ecosystem")));
        await ensureEcosystemLoaded();
        const q = getQtradeMetrics();
        const e = getEcosystemMetrics();
        // Проверка ПРОДУКТА, а не только процесса. До 20.08.2026 эта ручка
        // отвечала "ok", измеряя время работы, память и флаги — ни одного поля
        // про то, работает ли хоть что-нибудь. За ту же неделю три ручки отдавали
        // 500 на каждый запрос, и проверка не могла покраснеть в принципе.
        // Запросы с LIMIT 0 стоят ноль строк, но падают, если колонки нет.
        const { checkQueriedSchemas } = await Promise.resolve().then(() => __importStar(require("./lib/schemaHealth")));
        const schema = await checkQueriedSchemas();
        const mem = process.memoryUsage();
        res.json({
            status: schema.ok ? "ok" : "degraded",
            service: "AEVION Globus Backend",
            timestamp: new Date().toISOString(),
            uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
            sentry: (0, sentry_2.isSentryEnabled)(),
            schema,
            tokenRevocation: (await Promise.resolve().then(() => __importStar(require("./lib/tokenVersion")))).tokenVersionStatus(),
            ledger: {
                accounts: q.accounts,
                transfers: q.transfers,
                operations: q.operations,
                idempotencyCacheSize: q.idemCache,
                royaltyEvents: e.royaltyEvents,
                chessPrizes: e.chessPrizes,
                planetCerts: e.planetCerts,
                backend: e.backend,
            },
            memory: {
                heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                rssMb: Math.round(mem.rss / 1024 / 1024),
            },
            env: {
                nodeEnv: process.env.NODE_ENV || "development",
                bankDailyTopupCap: Number(process.env.BANK_DAILY_TOPUP_CAP || 5000),
                bankDailyTransferCap: Number(process.env.BANK_DAILY_TRANSFER_CAP || 2000),
                corsRestricted: !!process.env.CORS_ALLOWED_ORIGINS,
                metricsTokenSet: !!process.env.METRICS_TOKEN,
                // Два предела кошельков QPayNet названы ЗДЕСЬ, чтобы их можно было проверить на проде
                // чтением, а не попыткой зачислить себе деньги или завести пятый кошелёк.
                // Берём ТОТ ЖЕ источник, что и сами ручки, а не свою копию правила.
                qpaynetFundingConnected: (0, qpaynet_1.приёмДенегПодключён)(),
                qpaynetMaxWallets: qpaynet_1.MAX_WALLETS_PER_OWNER,
                // Пустой список админов вне production делает админом ЛЮБОГО вошедшего
                // (KYC, отказ выплат). Печатаем только ФАКТ заданности, не значение —
                // ровно так, как рядом сделано для metricsTokenSet.
                qpaynetAdminEmailsSet: !!(process.env.QPAYNET_ADMIN_EMAILS ?? "").trim(),
            },
        });
    }
    catch (err) {
        res.status(500).json({
            status: "error",
            message: err instanceof Error ? err.message : "deep health failed",
        });
    }
});
// Состояние ОБЕЩАННЫХ каналов одним запросом: может ли человек
// зарегистрироваться и заплатить. Отдельные ручки были у двух каналов из
// шести, про остальные снаружи нельзя было сказать ничего — и 19.08.2026
// это стоило нам неработающей регистрации, которую не видела ни одна
// проверка (сайт 200, /health ok, Sentry молчит).
app.use("/api/health", channelsHealth_1.channelsHealthRouter);
// Проверка соединения
app.get("/api/globus/ping", (_req, res) => {
    res.json({
        message: "AEVION Globus is online",
    });
});
// ==========================
// Globus Projects
// ==========================
app.get("/api/globus/projects", (_req, res) => {
    const items = (0, moduleRuntime_1.enrichProjects)(projects_1.projects);
    res.json({
        items,
        total: items.length,
    });
});
app.get("/api/globus/projects/:id", (req, res) => {
    const project = projects_1.projects.find((p) => p.id === req.params.id);
    if (!project) {
        return res.status(404).json({ error: "Project not found" });
    }
    res.json((0, moduleRuntime_1.enrichProject)(project));
});
app.use("/api/modules", modules_1.modulesRouter);
// Приём обращений со страницы помощи. Ручка вызывалась формой с 12.08 и
// отвечала 404; запасная ветка (открыть почтовый клиент) срабатывала ВСЕГДА
// и вела на домен без записей MX. Теперь обращение сохраняется, и «принято»
// говорится только по факту записи.
app.use("/api/help", helpContact_1.helpContactRouter);
app.use("/api/proof", proofPilot_1.proofPilotRouter);
app.use("/api/status", status_1.statusRouter);
// Module paywall — dormant unless the module id is listed in PAYWALL_MODULES
// (see lib/planGate.ts). qcoreai is the flagship AI-compute module (real
// OPEX) but is in planGate's UNSAFE_TO_GATE list: its free tier promises
// 100k tokens/mo with no metering yet to enforce that before falling back
// to a paid gate, so requireModule() strips it from enforcement regardless
// of PAYWALL_MODULES until that's built — see docs/PAYWALL_FLIP_READINESS.md.
app.use("/api/qcoreai", (0, planGate_1.requireModule)("qcoreai", qcoreai_1.qcoreaiRouter), qcoreai_1.qcoreaiRouter);
// Our own agent runtime — a real provider tool-use loop, kept separate from
// qcoreai (owned by another work stream). Ungated: no module id in the registry.
app.use("/api/agent-runtime", agentRuntime_1.agentRuntimeRouter);
// First-party MCP server (AEVION registry tools) — lets the agent-runtime MCP
// bridge prove the full runtime→bridge→MCP-server→tool path in our own zone.
app.use("/api/mcp-demo", mcpDemo_1.mcpDemoRouter);
// Public share-link route mounted BEFORE the auth-gated multichat router so
// /api/multichat/shared/:token bypasses requireAuth.
app.use("/api/multichat", multichat_1.multichatPublicRouter);
// 🔴 28.09.2026: ГОСТЮ — ДВА ЖИВЫХ ЗАПРОСА БЕЗ ВХОДА.
//
// Замер того дня живым браузером: у гостя кнопка «Спросить консилиум»
// выключена, работает только пример с записанными заранее ответами. Человек с
// ролика видел чужой опыт и уходил, не попробовав своего вопроса, — а продаём
// мы $40 в месяц. Цена называлась раньше, чем показана польза.
//
// Пропускаем МИМО платного гейта ровно две вещи и ровно два раза в сутки:
// создание разговора и один веер по нему. Всё остальное в мультичате
// по-прежнему за стеной. Счёт ведётся по паре «адрес + устройство»
// (lib/multichatGuestPass), трата засчитывается в момент пропуска.
// Гостевой слой Мультичата: правило целиком живёт в lib/multichatGuestPass
// (`гостевойСлой`), здесь только монтирование. Так сделано намеренно: сторож
// `guestReachesMultichatThroughTheRealMount` зовёт ТУ ЖЕ функцию, а не собирает
// свою копию цепочки — копия не ловила мутаций, проверено 30.09.2026 (обе
// мутации, «списывать при входе» и «не списывать никогда», проходили зелёными).
//
// Что делает слой: пропускает мимо платной стены ровно два вызова (создание
// разговора и один веер по нему) в пределах дневной нормы, даёт гостю устойчивую
// личность и списывает норму ПОСЛЕ ответа, не за отказы.
app.use("/api/multichat", (0, multichatGuestPass_1.гостевойСлой)(multichat_1.multichatRouter, (0, planGate_1.requireModule)("multichat-engine", multichat_1.multichatRouter)));
// Остаток бесплатной нормы — публично, чтобы страница знала, что показать
// гостю: кнопку или приглашение войти. Личных данных не отдаёт.
app.get("/api/multichat-guest/allowance", multichatGuestPass_1.ручкаОстатка);
/** OpenAPI 3.1 spec — full schemas + examples for bank-track routes,
 *  summary-only for legacy globus / qsign. See lib/openapiSpec.ts. */
app.get("/api/openapi.json", (_req, res) => {
    res.json({
        openapi: "3.1.0",
        info: {
            title: "AEVION Globus Backend",
            version: "0.8.0",
        },
        paths: {
            "/health": { get: { summary: "Service health" } },
            "/api/globus/projects": { get: { summary: "All Globus projects + runtime" } },
            "/api/globus/projects/{id}": { get: { summary: "Single project + runtime" } },
            "/api/modules/status": { get: { summary: "Modules dashboard payload" } },
            "/api/modules/{id}/health": { get: { summary: "Per-module health stub" } },
            "/api/qright/objects": {
                get: { summary: "List QRight (optional ?mine=1 + Bearer)" },
                post: { summary: "Create QRight object" },
            },
            "/api/qright/objects/{id}": { get: { summary: "Get one QRight object (ETag/304)" } },
            "/api/qright/objects/{id}/stats": {
                get: { summary: "Owner-only fetch counter + revoke metadata (Bearer required)" },
            },
            "/api/qright/objects.csv": { get: { summary: "Download QRight registry as CSV" } },
            "/api/qright/objects/search": {
                get: { summary: "Search by title (ILIKE), optional ?kind, ?limit≤50" },
            },
            "/api/qright/embed/{id}": {
                get: { summary: "Public sanitized JSON for embeds (CORS, ETag/304)" },
            },
            "/api/qright/badge/{id}.svg": {
                get: { summary: "Embeddable SVG trust badge — ?theme=dark|light, red on revoke" },
            },
            "/api/qright/revoke/{id}": {
                post: { summary: "Revoke a QRight object (owner only, Bearer required)" },
            },
            "/api/qright/admin/objects": {
                get: { summary: "Admin: list all (filters: status, q, limit)" },
            },
            "/api/qright/admin/revoke/{id}": {
                post: { summary: "Admin: force-revoke any object regardless of ownership" },
            },
            "/api/qright/admin/whoami": {
                get: { summary: "Probe — returns isAdmin for the current Bearer" },
            },
            "/api/qright/transparency": {
                get: { summary: "Public aggregate counts (totals, by-reason-code, by-kind) — no PII" },
            },
            "/api/qsign/sign": { post: { summary: "[v1] Sign payload (HMAC, no persistence)" } },
            "/api/qsign/verify": { post: { summary: "[v1] Stateless verify" } },
            "/api/qsign/v2/health": { get: { summary: "[v2] QSign health + active kids" } },
            "/api/qsign/v2/stats": {
                get: {
                    summary: "[v2] Public aggregate metrics (totals, last 24h, unique issuers, top countries, keys by status)",
                },
            },
            "/api/qsign/v2/recent": {
                get: {
                    summary: "[v2] Sanitized recent signatures feed (id, kids, country, createdAt, revoked) · ?limit=1..20",
                },
            },
            "/api/qsign/v2/sign": {
                post: {
                    summary: "[v2] Sign payload (HMAC+Ed25519, RFC 8785, persisted, Bearer required)",
                },
            },
            "/api/qsign/v2/verify": { post: { summary: "[v2] Stateless verify by canonical payload" } },
            "/api/qsign/v2/verify/{id}": { get: { summary: "[v2] Verify persisted signature by id" } },
            "/api/qsign/v2/{id}/public": { get: { summary: "[v2] Public shareable JSON view" } },
            "/api/qsign/v2/keys": { get: { summary: "[v2] Key registry (JWKS-like; no secret material)" } },
            "/api/qsign/v2/keys/{kid}": { get: { summary: "[v2] Single key detail by kid" } },
            "/api/qsign/v2/keys/rotate": {
                post: { summary: "[v2] Rotate active key for algo (admin only, overlap window)" },
            },
            "/api/qsign/v2/revoke/{id}": {
                post: { summary: "[v2] Revoke signature (issuer or admin, causal link optional)" },
            },
            "/api/auth/register": { post: {} },
            "/api/auth/login": { post: {} },
            "/api/auth/me": { get: {} },
            "/api/qcoreai/chat": { post: { summary: "Single-shot chat (one provider)" } },
            "/api/qcoreai/providers": { get: { summary: "List LLM providers + configured flag" } },
            "/api/qcoreai/health": { get: { summary: "QCoreAI config probe" } },
            "/api/qcoreai/agents": { get: { summary: "Multi-agent role defaults" } },
            "/api/qcoreai/multi-agent": {
                post: {
                    summary: "Multi-agent pipeline (Analyst+Writer+Critic), SSE stream",
                },
            },
            "/api/qcoreai/sessions": {
                get: { summary: "List sessions (mine if Bearer, else anonymous)" },
            },
            "/api/qcoreai/sessions/{id}": {
                get: { summary: "Session + all runs" },
                delete: { summary: "Delete session and its runs" },
            },
            "/api/qcoreai/runs/{id}": {
                get: { summary: "Run + all agent messages in order" },
            },
            "/api/planet/stats": {
                get: {
                    summary: "Planet public stats (participants Y, votes, optional productKeyPrefix scope)",
                },
            },
            "/api/planet/artifacts/recent": {
                get: {
                    summary: "Recent certified artifact versions (optional productKeyPrefix, artifactType, limit 1..50, sort=created|rating|votes)",
                },
            },
            "/api/planet/artifacts/{artifactVersionId}/public": {
                get: { summary: "Public artifact + votes + voteStatsByCategory" },
            },
            "/api/qtrade/accounts": {
                get: { summary: "List accounts (persisted)" },
                post: { summary: "Create account" },
            },
            "/api/qtrade/accounts.csv": { get: { summary: "Download accounts snapshot as CSV" } },
            "/api/qtrade/transfers": { get: { summary: "Transfer history" } },
            "/api/qtrade/transfers.csv": { get: { summary: "Download transfer history as CSV" } },
            "/api/qtrade/operations": { get: { summary: "Operation history (topup + transfer)" } },
            "/api/qtrade/operations.csv": { get: { summary: "Download operation history as CSV" } },
            "/api/qtrade/summary": { get: { summary: "QTrade summary metrics" } },
            "/api/qtrade/topup": { post: { summary: "Top up balance" } },
            "/api/qtrade/transfer": { post: { summary: "P2P transfer" } },
            "/api/pricing": { get: { summary: "Full pricing payload (tiers + modules + bundles)" } },
            "/api/pricing/tiers": { get: { summary: "List pricing tiers" } },
            "/api/pricing/tiers/{id}": { get: { summary: "Single tier detail" } },
            "/api/pricing/modules": { get: { summary: "Per-module add-on prices" } },
            "/api/pricing/modules/{id}": { get: { summary: "Single module pricing" } },
            "/api/pricing/bundles": { get: { summary: "Bundled module suites" } },
            "/api/pricing/quote": {
                post: { summary: "Build a price quote: tier + modules + seats + period" },
            },
            "/api/pricing/lead": {
                post: { summary: "Submit a sales lead (Enterprise / industry contact form)" },
            },
            "/api/pricing/leads/count": {
                get: { summary: "Total leads count (no content exposed)" },
            },
            "/api/pricing/checkout/session": {
                post: { summary: "Create Stripe Checkout session (or stub if no STRIPE_SECRET_KEY)" },
            },
            "/api/pricing/checkout/webhook": {
                post: { summary: "Stripe webhook receiver (verifies stripe-signature in real mode)" },
            },
            "/api/pricing/checkout/healthz": {
                get: { summary: "Checkout mode probe: real/stub + webhook readiness" },
            },
            "/api/pricing/events": {
                post: { summary: "Ingest analytics event (page_view, cta_click, etc)" },
            },
            "/api/pricing/events/summary": {
                get: { summary: "Aggregated metrics — admin token required" },
            },
            "/api/pricing/events/recent": {
                get: { summary: "Last N events — admin token required (CSV filters: source,type,tier,industry,sid)" },
            },
            "/api/pricing/events/aggregate": {
                get: { summary: "Time-bucketed counts (period=hour|day, groupBy=source|type|tier|industry) — admin token required" },
            },
            "/api/pricing/leads": {
                get: { summary: "List recent leads — admin token required" },
            },
            "/api/pricing/promo": {
                get: { summary: "Public list of active promo codes" },
            },
            "/api/pricing/promo/validate": {
                post: { summary: "Validate a promo code against a tier (no charge)" },
            },
            "/api/pricing/testimonials": {
                get: { summary: "Public customer testimonials (filterable)" },
            },
            "/api/pricing/trust": {
                get: { summary: "Trust signals: numbers + compliance badges" },
            },
            "/api/pricing/newsletter": {
                post: { summary: "Newsletter signup (email only)" },
            },
            "/api/pricing/newsletter/count": {
                get: { summary: "Total newsletter subscribers count" },
            },
            "/api/pricing/checkout/subscriptions/count": {
                get: { summary: "Total provisioned subscriptions count" },
            },
            "/api/pricing/roadmap": {
                get: { summary: "Public roadmap for all 27 modules with phases and progress" },
            },
            "/api/pricing/provisioning/history": {
                get: { summary: "Subscription history by email (?email=...) — masked PII, capped at 100" },
            },
            "/api/pricing/provisioning/stats": {
                get: { summary: "Aggregate provisioning stats: total, byTier, last7d, trialsActive, recent" },
            },
            "/api/pricing/provisioning/healthz": {
                get: { summary: "Provisioning subsystem health: storage path, email mode" },
            },
            // Revenue Hub
            "/api/revenue/health": { get: { summary: "Revenue Hub health — Gumroad (primary)/Paddle/YouTube/Twitch config status" } },
            "/api/revenue/apps": { get: { summary: "List 12 AEVION apps with monetization channels" } },
            "/api/revenue/apps/{appId}": { get: { summary: "Single app revenue config + channel stubs" } },
            "/api/revenue/overview": { get: { summary: "Global monetization overview — channel coverage, app counts" } },
            "/api/revenue/gumroad/balance": { get: { summary: "Gumroad net balance (gross - fees, USD) — live processor" } },
            "/api/revenue/gumroad/recent": { get: { summary: "Recent Gumroad sales grouped by AEVION app" } },
            "/api/revenue/youtube/{channelId}": { get: { summary: "YouTube AdSense stats for channel" } },
            "/api/revenue/twitch/{login}": { get: { summary: "Twitch affiliate stats for streamer" } },
            "/api/revenue/snapshot": { post: { summary: "Freeze current combined live totals into a RevenueSnapshot (history/trend). Optional x-revenue-token guard." } },
            "/api/revenue/snapshots": { get: { summary: "Revenue snapshot time-series, newest first (?limit=&sinceDays=)" } },
            "/api/revenue/trend": { get: { summary: "Revenue trend — latest vs oldest in window + % growth + sparkline series (?windowDays=)" } },
            "/api/revenue/env-guide": { get: { summary: "Setup guide for Revenue Hub env vars" } },
            // QLearn — courses + quizzes + progress
            "/api/qlearn/health": { get: { summary: "QLearn health probe", security: [] } },
            "/api/qlearn/courses": {
                get: { summary: "List published courses (filter by category, level, lang)", security: [] },
            },
            "/api/qlearn/courses/{id}": {
                get: { summary: "Get single course with modules + quizzes", security: [] },
            },
            "/api/qlearn/progress": {
                get: { summary: "User course progress (Bearer required)" },
            },
            // QEvents — events platform
            "/api/qevents/health": { get: { summary: "QEvents health + service marker", security: [] } },
            "/api/qevents/events": {
                get: { summary: "List events (filter by category, when, location)", security: [] },
                post: { summary: "Create event (Bearer required)" },
            },
            "/api/qevents/events/{id}": {
                get: { summary: "Single event with attendee count", security: [] },
            },
            "/api/qevents/categories": {
                get: { summary: "List event categories", security: [] },
            },
            // QMedia — music + video + playlists
            "/api/qmedia/health": { get: { summary: "QMedia health + table count", security: [] } },
            "/api/qmedia/tracks": {
                get: { summary: "List music tracks", security: [] },
                post: { summary: "Upload track (Bearer required)" },
            },
            "/api/qmedia/videos": {
                get: { summary: "List videos", security: [] },
            },
            "/api/qmedia/playlists": {
                get: { summary: "List playlists", security: [] },
            },
            // QReal Studio — fully-alive AI video (no actor), realism QC, provenance
            "/api/qreal/health": { get: { summary: "QReal health + pipeline stages", security: [] } },
            "/api/qreal/engines": { get: { summary: "Direct render engines + $/s unit economics", security: [] } },
            "/api/qreal/realism-criteria": {
                get: { summary: "14 weighted realism QC criteria + 1/3/5 anchors + acceptance threshold", security: [] },
            },
            "/api/qreal/demo": { get: { summary: "Seeded demo project (steppe morning)", security: [] } },
            "/api/qreal/projects": {
                get: { summary: "List my projects (Bearer required)" },
                post: { summary: "Create project from a text brief", security: [] },
            },
            "/api/qreal/projects/{id}/characters": {
                get: { summary: "Scene cast: one canonical description per character (kills face drift between shots)", security: [] },
            },
            "/api/qreal/projects/{id}/characters/{cid}": {
                patch: { summary: "Edit a character's canon or reference frames — render prompts are rebuilt", security: [] },
            },
            "/api/qreal/projects/{id}/shots/{sid}/qc": {
                post: { summary: "Score a shot against the 14 criteria; {judge:true} runs the paid VLM judge", security: [] },
            },
            "/api/qreal/projects/{id}/continuity": {
                post: { summary: "Character continuity across shots, judged on the assembled film (409 if nobody recurs)", security: [] },
            },
            // QAI — universal AI assistant (personas + sessions + chat)
            "/api/qai/health": { get: { summary: "QAI health + session count", security: [] } },
            "/api/qai/personas": {
                get: { summary: "List built-in personas (id, name, emoji, description)", security: [] },
            },
            "/api/qai/sessions": {
                get: { summary: "List user chat sessions (Bearer required)" },
            },
            "/api/qai/chat": {
                post: { summary: "Send a chat message (Bearer required)" },
            },
            // QJobs — job board
            "/api/qjobs/health": { get: { summary: "QJobs health + service marker", security: [] } },
            "/api/qjobs/jobs": {
                get: { summary: "List job postings (filter by type, location)", security: [] },
                post: { summary: "Create job posting (Bearer required)" },
            },
            "/api/qjobs/jobs/{id}": {
                get: { summary: "Single job posting with application count", security: [] },
            },
            "/api/qjobs/stats": {
                get: { summary: "Aggregate stats — postings, applications, by type", security: [] },
            },
            // QNews — news aggregator
            "/api/qnews/health": { get: { summary: "QNews health + service marker", security: [] } },
            "/api/qnews/articles": {
                get: { summary: "List news articles (filter by category, since)", security: [] },
                post: { summary: "Create article (Bearer required)" },
            },
            "/api/qnews/articles/{id}": {
                get: { summary: "Single article with full body + comments", security: [] },
            },
            "/api/qnews/categories": {
                get: { summary: "Categories with counts (id + count)", security: [] },
            },
            "/api/qnews/rss": {
                get: { summary: "RSS 2.0 feed for the news catalog (application/rss+xml)", security: [] },
            },
            // Coach — AI coaching / goal-tracking
            "/api/coach/health": { get: { summary: "Coach health + provider config", security: [] } },
            "/api/coach/chat": {
                post: { summary: "Anthropic chat proxy — stateless coaching reply (public)", security: [] },
            },
            "/api/coach/chat/stream": {
                post: { summary: "Anthropic chat proxy — streamed SSE coaching reply (public)", security: [] },
            },
            "/api/coach/sessions": {
                get: { summary: "List user coaching sessions (Bearer required)" },
            },
            "/api/coach/sessions/start": {
                post: { summary: "Start a coaching session (Bearer required)" },
            },
            "/api/coach/sessions/{id}": {
                get: { summary: "Get a single coaching session (Bearer required)" },
            },
            "/api/coach/sessions/{id}/end": {
                post: { summary: "End an active coaching session (Bearer required)" },
            },
            "/api/coach/goals": {
                get: { summary: "List user coaching goals (Bearer required)" },
                post: { summary: "Create a coaching goal (Bearer required)" },
            },
            "/api/coach/goals/{id}/complete": {
                post: { summary: "Mark a coaching goal complete (Bearer required)" },
            },
            "/api/coach/goals/{id}": {
                delete: { summary: "Delete a coaching goal (Bearer required)" },
            },
            // Multichat — multi-agent chat (fully Bearer-gated on prod)
            "/api/multichat/health": { get: { summary: "Multichat health (Bearer required)" } },
            "/api/multichat/conversations/{id}/dispatch": {
                post: { summary: "Fan out one prompt to N agents; returns replies, dissent map and a signed receipt" },
            },
            "/api/multichat/receipt/verify": {
                post: { summary: "PUBLIC — recompute a receipt's RFC8785/sha256 hash and check its ed25519 signature", security: [] },
            },
            "/api/multichat/dissent/preview": {
                post: {
                    summary: "PUBLIC — dissent map for answers you already have (max 8). Free because it makes no model call: " +
                        "similarity, outlier, numeric conflicts and hedges are derived from the answer text alone",
                    security: [],
                },
            },
            "/api/multichat/rooms": {
                get: { summary: "List user chat rooms (Bearer required)" },
                post: { summary: "Create new room (Bearer required)" },
            },
            "/api/multichat/rooms/{id}/messages": {
                get: { summary: "Get room message history (Bearer required)" },
                post: { summary: "Post message to room (Bearer required)" },
            },
            // DevHub — code snippets + tooling
            "/api/devhub/health": { get: { summary: "DevHub health + DB status", security: [] } },
            "/api/devhub/snippets": {
                get: { summary: "List code snippets (filter by lang, tag)", security: [] },
                post: { summary: "Create snippet (Bearer required)" },
            },
            "/api/devhub/snippets/{id}": {
                get: { summary: "Single snippet with code + metadata", security: [] },
            },
            "/api/devhub/snippets/{id}/star": {
                post: { summary: "Toggle star on snippet (Bearer required)" },
            },
            // QFusionAI — multi-model fusion orchestrator
            "/api/qfusionai/health": { get: { summary: "QFusionAI health + model count", security: [] } },
            "/api/qfusionai/stats": {
                get: { summary: "Fusion stats — runs, by-model, totals", security: [] },
            },
            "/api/qfusionai/fusions": {
                get: { summary: "List fusion runs", security: [] },
                post: { summary: "Create fusion run (Bearer required)" },
            },
            // QPersona — persona profile pages (with waitlist + unsubscribe)
            "/api/qpersona/health": { get: { summary: "QPersona health + persona count", security: [] } },
            "/api/qpersona/personas": {
                get: { summary: "List public personas", security: [] },
            },
            "/api/qpersona/personas/{slug}": {
                get: { summary: "Single persona by slug — public profile", security: [] },
            },
            "/api/qpersona/waitlist": {
                post: { summary: "Join early-access waitlist (HMAC unsubscribe link emailed)", security: [] },
            },
            "/api/qpersona/unsubscribe": {
                get: { summary: "Unsubscribe via signed HMAC token from email link", security: [] },
            },
            // QLife — life-prompts catalog
            "/api/qlife/health": { get: { summary: "QLife health + prompt count", security: [] } },
            "/api/qlife/prompts": {
                get: { summary: "List daily life prompts (filter by mood, category)", security: [] },
            },
            "/api/qlife/prompts/{id}": {
                get: { summary: "Single prompt with full content", security: [] },
            },
            // LifeBox — time-capsule messages to future-self
            "/api/lifebox/health": { get: { summary: "LifeBox health + capsule count", security: [] } },
            "/api/lifebox/capsules": {
                get: { summary: "List public capsules (filter by year, theme)", security: [] },
                post: { summary: "Create capsule (Bearer required)" },
            },
            "/api/lifebox/capsules/{id}": {
                get: { summary: "Single capsule (public or owner only)", security: [] },
            },
            // ShadowNet — anonymous threat/whistleblower posts
            "/api/shadownet/health": { get: { summary: "ShadowNet health + post count", security: [] } },
            "/api/shadownet/posts": {
                get: { summary: "List anonymous posts (filter by category)", security: [] },
                post: { summary: "Submit anonymous post (no auth — by design)", security: [] },
            },
            "/api/shadownet/posts/{id}": {
                get: { summary: "Single post with comments", security: [] },
            },
            // DeepSan — long-running deep-sanity AI runs
            "/api/deepsan/health": { get: { summary: "DeepSan health + run count", security: [] } },
            "/api/deepsan/runs": {
                get: { summary: "List deep-sanity runs", security: [] },
                post: { summary: "Start new run (Bearer required)" },
            },
            "/api/deepsan/runs/{id}": {
                get: { summary: "Single run with output + timing", security: [] },
            },
            // PsyApp-Deps — addiction-recovery streak + assessments
            "/api/psyapp-deps/health": { get: { summary: "PsyApp-Deps health + assessment count", security: [] } },
            "/api/psyapp-deps/assessments": {
                get: { summary: "List standard assessments (PHQ-9, GAD-7, etc.)", security: [] },
            },
            "/api/psyapp-deps/assessments/{id}": {
                get: { summary: "Single assessment with questions", security: [] },
            },
            // AEVION Hub — central registry + SDK presence + ecosystem stats
            "/api/aevion/version": { get: { summary: "Hub service version + uptime + node version", security: [] } },
            "/api/aevion/stats": {
                get: { summary: "Registry stats: total modules, byTier, coverage matrix, recent activity", security: [] },
            },
            "/api/aevion/catalog": {
                get: { summary: "Unified module catalog with health/openapi/badges links", security: [] },
            },
            "/api/aevion/catalog/{id}": {
                get: { summary: "Single module catalog entry with health probe + related modules", security: [] },
            },
            "/api/aevion/registry-stats": {
                get: { summary: "Lightweight registry stats (count + tier breakdown only)", security: [] },
            },
            "/api/aevion/badges/{moduleId}.svg": {
                get: { summary: "SVG status badge for embedding (image/svg+xml)", security: [] },
            },
            "/api/aevion/module-of-the-day": {
                get: { summary: "Deterministic daily module rotation + related + tomorrow preview", security: [] },
            },
            "/api/aevion/sdks": {
                get: { summary: "Published AEVION npm SDK packages (4 packages with versions, install commands, npmjs registry URLs)", security: [] },
            },
            "/api/aevion/openapi.json": {
                get: { summary: "Composite OpenAPI spec aggregating sub-module specs", security: [] },
            },
            "/api/aevion/sitemap.xml": {
                get: { summary: "XML sitemap of all live module endpoints (application/xml)", security: [] },
            },
            // QTradeOffline
            "/api/qtradeoffline/health": { get: { summary: "QTradeOffline health + wallet/transfer counts" } },
            "/api/qtradeoffline/wallet/register": { post: { summary: "Register ECDSA P-256 wallet — 100 AEV airdrop on first call" } },
            "/api/qtradeoffline/wallet/{id}": { get: { summary: "Wallet balance" } },
            "/api/qtradeoffline/history/{id}": { get: { summary: "Wallet ledger history" } },
            "/api/qtradeoffline/leaderboard": { get: { summary: "Top 10 wallets by balance" } },
            "/api/qtradeoffline/stats": { get: { summary: "Global stats — wallets, totalSupply, transfers, volume" } },
            "/api/qtradeoffline/sync": { post: { summary: "Batch-apply offline-signed transfers (atomic, idempotent via nonce)" } },
            // QStore enhanced
            "/api/qstore/products": {
                get: { summary: "List marketplace products" },
            },
            "/api/qstore/products/{id}/purchase": {
                post: { summary: "Purchase product — returns Stripe Checkout URL if Stripe configured, else direct" },
            },
            // QMaskCard
            "/api/qmaskcard/health": { get: { summary: "QMaskCard health" } },
            "/api/qmaskcard/stats": { get: { summary: "Global stats — active masks, authorized charges, volume" } },
            "/api/qmaskcard/masks": {
                get: { summary: "List user virtual cards (Bearer required)" },
                post: { summary: "Issue new virtual card with spend limits (Bearer required)" },
            },
            "/api/qmaskcard/charges": {
                get: { summary: "List charges for user's masks (Bearer required)" },
                post: { summary: "Authorize a charge against a mask (Bearer required)" },
            },
            // HealthAI
            "/api/healthai/health": { get: { summary: "HealthAI health — persistence mode + profile count" } },
            "/api/healthai/profile": { post: { summary: "Create/update health profile" } },
            "/api/healthai/profile/{id}": { get: { summary: "Get health profile" } },
            "/api/healthai/log": { post: { summary: "Daily wellness log (sleep, mood, weight, water, exercise)" } },
            "/api/healthai/plan/{profileId}": {
                get: { summary: "Generate AI wellness plan — rule-based + LLM-enhanced (Anthropic/OpenAI/Gemini chain)" },
            },
            "/api/healthai/check": { post: { summary: "Symptom check + rule-based advice" } },
            // Universal Search
            "/api/search/health": { get: { summary: "Search service health — sources list", security: [] } },
            "/api/search": {
                get: {
                    summary: "Universal Search — queries QStore/QLearn/QNews/QEvents/QJobs/QRight in parallel",
                    security: [],
                    parameters: [
                        { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 100 } },
                        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
                        { name: "types", in: "query", schema: { type: "string", description: "Comma-separated: qstore,qlearn,qnews,qevents,qjobs,qright" } },
                    ],
                },
            },
            // Lemon Squeezy — recurring subscription webhook
            "/api/lemonsqueezy/webhook": {
                post: {
                    summary: "Lemon Squeezy subscription webhook — verifies x-signature (HMAC-SHA256), maps subscription_* events to plan provisioning",
                    description: "Activation events (subscription_created, subscription_updated, subscription_resumed, subscription_unpaused) call provisionSubscription: All-Access variant → 'business' tier, any bundle variant → 'pro', unrecognised/unset variant → 'pro'. Deactivation events (subscription_cancelled, subscription_expired, subscription_paused) write a tierId:'free' downgrade record. Other subscription_* events are acknowledged but ignored. Signature is HMAC-SHA256 of the raw body keyed by LEMON_SQUEEZY_WEBHOOK_SECRET, compared to the x-signature header; when the secret is unset the route is a 200 no-op stub. Delivery is at-least-once — handler dedups on subscription id + event + timestamp.",
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        meta: {
                                            type: "object",
                                            properties: {
                                                event_name: {
                                                    type: "string",
                                                    enum: [
                                                        "subscription_created",
                                                        "subscription_updated",
                                                        "subscription_resumed",
                                                        "subscription_unpaused",
                                                        "subscription_cancelled",
                                                        "subscription_expired",
                                                        "subscription_paused",
                                                    ],
                                                },
                                                custom_data: {
                                                    type: "object",
                                                    properties: {
                                                        reference: { type: "string", example: "bundle:fintech" },
                                                        email: { type: "string", format: "email" },
                                                    },
                                                },
                                            },
                                            required: ["event_name"],
                                        },
                                        data: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                attributes: {
                                                    type: "object",
                                                    properties: {
                                                        user_email: { type: "string", format: "email" },
                                                        variant_id: { type: "integer" },
                                                        status: { type: "string", example: "active" },
                                                        renews_at: { type: "string", format: "date-time", nullable: true },
                                                        ends_at: { type: "string", format: "date-time", nullable: true },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    required: ["meta"],
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Acknowledged. Body indicates the action taken: { ok, action: 'activated'|'downgraded', tierId? } | { ok, ignored } | { ok, deduped } | { ok, mode: 'stub' }",
                        },
                        "400": { description: "Body is not JSON, or subscription event missing user_email" },
                        "401": { description: "x-signature header missing or HMAC mismatch" },
                        "500": { description: "Provisioning failed — LS will retry (dedup entry released)" },
                    },
                },
            },
            // Gumroad — platform-wide ping webhook (form-encoded)
            "/api/gumroad/webhook": {
                get: {
                    summary: "Gumroad webhook liveness probe — returns JSON manifest (real Gumroad pings come on POST)",
                    security: [],
                    responses: { "200": { description: "Tiny JSON: { ok, endpoint, accepts, signed, info }" } },
                },
                post: {
                    summary: "Gumroad ping webhook (application/x-www-form-urlencoded) — maps sale/refund/cancel to plan provisioning",
                    description: "Gumroad sends form-encoded pings for all AEVION products. product_id is matched against GUMROAD_PRODUCT_<ID>=<reference> env to pick the tier (all-access/business → 'business', else 'pro'); unmatched falls back to constitution-pro. A paid sale calls provisionSubscription (writes subscriptions.jsonl, same store /me/plan and the Pro gates read); refunded/disputed/subscription_cancelled/subscription_failed write a tierId:'free' downgrade record. Missing email → ignored. Optional HMAC: if GUMROAD_WEBHOOK_SECRET is set, x-gumroad-signature (or a signature field) must match HMAC-SHA256 of the raw body. Dedup on sale_id + status.",
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            "application/x-www-form-urlencoded": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        sale_id: { type: "string" },
                                        email: { type: "string", format: "email" },
                                        product_id: { type: "string" },
                                        short_product_id: { type: "string" },
                                        is_recurring_billing: { type: "string", example: "true" },
                                        refunded: { type: "string", example: "false" },
                                        disputed: { type: "string", example: "false" },
                                        subscription_cancelled: { type: "string" },
                                        subscription_failed: { type: "string" },
                                        sale_timestamp: { type: "string", format: "date-time" },
                                    },
                                    required: ["email"],
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Acknowledged: { ok, action: 'activated'|'downgraded', tierId? } | { ok, ignored } | { ok, deduped }",
                        },
                        "400": { description: "Webhook body could not be parsed" },
                        "401": { description: "Signature mismatch (GUMROAD_WEBHOOK_SECRET set and x-gumroad-signature invalid)" },
                        "500": { description: "Provisioning failed — dedup entry released for retry" },
                    },
                },
            },
            // Pricing — subscription self-service
            "/api/pricing/subscription/me": {
                get: { summary: "Latest subscription for authenticated user (JWT)" },
            },
            "/api/pricing/subscriptions/purge": {
                post: {
                    summary: "Admin: purge all subscriptions.jsonl records by email (GDPR / test cleanup)",
                    description: "Requires X-Admin-Token. Body: { email }. Atomic .tmp+rename rewrite. Returns { ok, email, removed, remaining }.",
                },
            },
            "/api/pricing/cases": { get: { summary: "Customer case stories with ROI metrics" } },
            ...openapiFintechSpec_1.FINTECH_OPENAPI_PATHS,
            ...openapiNewWaveSpec_1.NEW_WAVE_OPENAPI_PATHS,
        },
        components: { schemas: { ...openapiFintechSpec_1.FINTECH_OPENAPI_SCHEMAS, ...openapiNewWaveSpec_1.NEW_WAVE_OPENAPI_SCHEMAS } },
        tags: [...openapiFintechSpec_1.FINTECH_OPENAPI_TAGS, ...openapiNewWaveSpec_1.NEW_WAVE_OPENAPI_TAGS],
    });
});
// ============================================================
// Platform module paywall — centralised gate registration.
//
// One source of truth mapping each monetised module's API prefix to its
// module id in MODULES_PRICING. Registered BEFORE the route mounts below so
// Express runs the gate ahead of the matching router (middleware runs in
// registration order). DORMANT by default: requireModule() is a no-op unless
// the id is listed in env PAYWALL_MODULES (see lib/planGate.ts), so this is
// safe to wire everywhere and flip on per-module from Railway.
//
// Deliberately NOT gated here: globus (free/public portal), cyberchess*,
// smeta-trainer, qbuild/build (active work in other worktrees), and
// constitution* (has its own dedicated gate in lib/constitutionGate.ts).
// qcoreai and multichat-engine are gated inline above (mounted earlier).
// Третий элемент — роутер этого префикса, необязательный. Он нужен стене,
// чтобы отличить несуществующий путь от платного: без него стена отвечает
// «купите тариф» на любую опечатку в адресе (замер 07.10.2026).
const MODULE_GATE_PREFIXES = [
    ["/api/qfusionai", "qfusionai", qfusionai_1.qfusionaiRouter],
    ["/api/qright", "qright"],
    ["/api/qsign", "qsign"], // also covers /api/qsign/v2
    ["/api/bureau", "aevion-ip-bureau"],
    ["/api/qtradeoffline", "qtradeoffline"],
    ["/api/qpaynet", "qpaynet-embedded"],
    ["/api/qmaskcard", "qmaskcard"],
    ["/api/veilnetx", "veilnetx"],
    ["/api/veilnetx-ledger", "veilnetx"],
    ["/api/healthai", "healthai", healthai_1.healthaiRouter],
    ["/api/longevity", "qrenew"],
    ["/api/qai", "qai", qai_1.qaiRouter],
    ["/api/qlearn", "qlearn", qlearn_1.qlearnRouter],
    ["/api/qnews", "qnews", qnews_1.qnewsRouter],
    ["/api/qstore", "qstore"],
    ["/api/qmedia", "qmedia"],
    ["/api/qlife", "qlife"],
    ["/api/qgood", "qgood"],
    ["/api/psyapp-deps", "psyapp-deps"],
    ["/api/qpersona", "qpersona"],
    ["/api/kids-ai", "kids-ai-content"],
    ["/api/voice-of-earth", "voice-of-earth"],
    ["/api/startupx", "startup-exchange"],
    ["/api/ventures", "ventures"],
    ["/api/qventure", "qventure"],
    // Добавлено 28.08.2026 сверкой таблицы шлюзов с MODULES_PRICING. Три
    // платных модуля были в прайсе, но их префиксов здесь не было — значит
    // ВКЛЮЧИТЬ для них стену было нечем: переменная PAYWALL_MODULES принимала
    // бы их имя и молча ничего не делала. Ни один из трёх сейчас не включён,
    // поэтому проводка ничего не меняет сегодня; она делает переключатель
    // работающим. Полноту стережёт tests/paywallGateCoversPricing.test.ts.
    ["/api/qmelanin", "qmelanin"],
    ["/api/revenue", "revenue-hub"],
    // qskyway крепится манифестом ниже (строка ~1328), а шлюзы регистрируются
    // выше (~1196) — Express идёт по порядку регистрации, поэтому шлюз успевает
    // встать перед роутером.
    ["/api/qskyway", "qskyway"],
    ["/api/qreal", "qreal"],
    ["/api/deepsan", "deepsan"],
    ["/api/mapreality", "mapreality"],
    ["/api/qevents", "qevents"],
    ["/api/ztide", "z-tide"],
    ["/api/qcontract", "qcontract"],
    ["/api/shadownet", "shadownet"],
    ["/api/lifebox", "lifebox"],
    ["/api/qchaingov", "qchaingov"],
];
for (const [prefix, moduleId, роутер] of MODULE_GATE_PREFIXES) {
    // Третий элемент (роутер) не обязателен. Там, где он есть, стена сперва
    // сверяет путь с маршрутами роутера и неизвестный путь пропускает дальше —
    // чтобы Express ответил 404, а не «купите тариф» (замер 07.10.2026).
    app.use(prefix, (0, planGate_1.requireModule)(moduleId, роутер));
}
// ==========================
// QRight — патентирование
// ==========================
app.use("/api/qtrade", qtrade_1.qtradeRouter);
app.use("/api/aev", aev_1.aevRouter);
app.use("/api/qright", qright_1.qrightRouter);
app.use("/api/qright", qrightRoyalties_1.qrightRoyaltiesRouter);
app.use("/api/ecosystem", ecosystem_1.ecosystemRouter);
app.use("/api/cyberchess", cyberchess_1.cyberchessRouter);
app.use("/api/cyberchess-puzzles", cyberchessPuzzles_1.default);
app.use("/api/cyberchess-tournaments", cyberchessTournaments_1.default);
app.use("/api/cyberchess-daily", cyberchessDaily_1.default);
app.use("/api/cyberchess-voice-coach", cyberchessVoiceCoach_1.default);
app.use("/api/cyberchess-spectator", cyberchessSpectator_1.default);
app.use("/api/cyberchess/matchmaking", cyberchessMatchmaking_1.default);
app.use("/api/cyberchess-anticheat", cyberchessAnticheat_1.default);
app.use("/api/cyberchess-opening", cyberchessOpening_1.default);
app.use("/api/puzzles", puzzles_1.puzzlesRouter);
// ==========================
// QSign — v1 (legacy) + v2 (RFC 8785, persisted, multi-algo)
// ==========================
app.use("/api/qsign/v2", qsignV2_1.qsignV2Router);
app.use("/api/qspace/photoreal", qspacePhotoreal_1.qspacePhotorealRouter);
app.use("/api/qsign", qsign_1.qsignRouter);
// ==========================
// Quantum Shield
// ==========================
app.use("/api/quantum-shield", quantum_shield_1.quantumShieldRouter);
app.use("/api/pipeline", pipeline_1.pipelineRouter);
app.use("/api/bureau", bureau_1.bureauRouter);
app.use("/api/build", build_1.buildRouter);
app.use("/api/coach", coach_1.coachRouter);
app.use("/api/healthai", healthai_1.healthaiRouter);
// ==========================
// Pricing / GTM
// ==========================
app.use("/api/pricing", pricing_2.pricingRouter);
// Публичный счётчик зарегистрированных: цель 100 000 к 31.12.2026 измеряется
// ИМ, а не пересказом. Личных данных не отдаёт, наши пробы считает отдельно.
app.use("/api/stats", publicStats_1.publicStatsRouter);
app.use("/api/pricing/checkout", checkout_1.checkoutRouter);
// Выдача доступа после оплаты. 19.08.2026 монтирование пропало при слиянии:
// чужой index.ts взяли целиком, а этой строки в нём не было. Поймал сторож
// tests/provisioning.routes.test.ts — до выкатки, а не после жалобы
// покупателя, которому не открылось купленное.
app.use("/api/pricing/provisioning", provisioning_3.provisioningRouter);
app.use("/api/quotas", apiQuotas_1.apiQuotasRouter);
// Platform entitlements + paywall policy (GET /api/me/entitlements, /api/paywall/policy)
app.use("/api", entitlements_1.entitlementsRouter);
app.use("/api/keys", apiKeys_1.apiKeysRouter);
app.use("/api/qgood", qgood_1.qgoodRouter);
app.use("/api/qmaskcard", qmaskcard_1.qmaskcardRouter);
app.use("/api/veilnetx-ledger", veilnetxLedger_1.veilnetxLedgerRouter);
app.use("/api/ztide", ztide_1.ztideRouter);
app.use("/api/qchaingov", qchaingov_1.qchaingovRouter);
app.use("/api/pricing/events", events_2.eventsRouter);
app.use("/api/lemonsqueezy", lemonSqueezyWebhook_1.lemonSqueezyWebhookRouter);
app.use("/api/apps/access", appAccess_1.appAccessRouter);
app.use("/api/gumroad", gumroadWebhook_1.gumroadWebhookRouter);
app.use("/api/paybox", payboxWebhook_1.payboxWebhookRouter);
app.use("/api/paypal", paypalWebhook_1.paypalWebhookRouter);
// ==========================
// Auth
// ==========================
app.use("/api/auth", auth_1.authRouter);
app.use("/api/auth/oauth", authOauth_1.authOauthRouter);
app.use("/api/tiktok", tiktok_1.tiktokRouter);
// ==========================
// Planet / Compliance / Evidence / Certificate
// ==========================
app.use("/api/planet", planetCompliance_1.planetComplianceRouter);
app.use("/api/planet", planetPayouts_1.planetPayoutsRouter);
// Telemetry + ban-gate cover the entire constitution surface
app.use(["/api/constitution", "/api/planet/constitution-artifacts"], constitutionAdmin_1.constitutionTelemetry);
app.use(["/api/constitution", "/api/planet/constitution-artifacts"], constitutionAdmin_1.constitutionBanGate);
app.use("/api/admin/constitution", constitutionAdmin_1.constitutionAdminRouter);
app.use("/api/admin/constitution/funnel", constitutionFunnel_1.constitutionFunnelAdminRouter);
app.use("/api/constitution/funnel", constitutionFunnel_1.constitutionFunnelTrackRouter);
app.use("/api/constitution/waitlist", constitutionWaitlist_1.constitutionWaitlistRouter);
// Приём заявок с сайта агентства (20.09.2026): до этого форма открывала почтовую
// программу посетителя, и на телефоне заявка просто терялась.
app.use("/api/agency", agencyLead_1.agencyLeadRouter);
app.use("/api/admin/constitution/waitlist", constitutionWaitlist_1.constitutionWaitlistAdminRouter);
app.use("/api/constitution/status", constitutionStatus_1.constitutionStatusRouter);
app.use("/api/constitution/checkout", constitutionCheckout_1.constitutionCheckoutRouter);
app.use("/api/planet/constitution-artifacts", planetConstitution_1.planetConstitutionRouter);
app.use("/api/constitution", constitutionAi_1.constitutionAiRouter);
app.use("/api/constitution", constitutionPdf_1.constitutionPdfRouter);
app.use("/api/constitution", constitutionPro_1.constitutionProRouter);
app.use("/api/constitution/public", constitutionPublic_1.constitutionPublicRouter);
app.use("/api/planet/constitution-artifacts", planetConstitutionSocial_1.planetConstitutionSocialRouter);
app.use("/api/awards", awards_1.awardsRouter);
// ==========================
// AEVION Hub — composite cross-product health + OpenAPI index
// ==========================
app.use("/api/aevion", aevion_hub_1.aevionHubRouter);
app.use("/api/i18n", i18n_1.i18nRouter);
// Internal: synthetic webhook dispatcher used by /bank/diagnostics.
app.use("/api/bank", bankTest_1.bankTestRouter);
// Prometheus metrics. Public unless METRICS_TOKEN is set in env.
app.use("/api/metrics", metrics_1.metricsRouter);
// Smeta Trainer — progress sync + LMS webhook
app.use("/api/smeta-trainer", smeta_trainer_1.smetaTrainerRouter);
// QContract — self-destruct smart documents
app.use("/api/qcontract", qcontract_1.qcontractRouter);
// QFusionAI — smart multi-provider LLM router
app.use("/api/qfusionai", qfusionai_1.qfusionaiRouter);
// VeilNetX — privacy proxy pre-launch status + waitlist
app.use("/api/veilnetx", veilnetx_1.veilnetxRouter);
// ShadowNet — alternative private internet concept simulator.
// Mounted BEFORE the generic planning stubs loop (which would also create
// /api/shadownet) so the dedicated endpoints win.
app.use("/api/shadownet", shadownet_1.shadownetRouter);
app.use("/api/psyapp-deps", psyappDeps_1.psyappDepsRouter);
app.use("/api/lifebox", lifebox_1.lifeboxRouter);
// Wave 1/3/4 MVPs — mount BEFORE planning stubs so dedicated routes win.
app.use("/api/mapreality", mapReality_1.mapRealityRouter);
app.use("/api/voice-of-earth", voiceOfEarth_1.voiceOfEarthRouter);
app.use("/api/deepsan", deepsan_1.deepSanRouter);
app.use("/api/qpersona", qpersona_1.qpersonaRouter);
app.use("/api/qlife", qlife_1.qlifeRouter);
// Module route manifest (append-only — see routes/moduleManifest.ts). Mounted
// BEFORE the planning stubs so dedicated module routers win over the generic
// /api/<id> status stubs, matching the convention of the inline mounts above.
// New modules add ONE entry to EXTRA_MOUNTS instead of editing this file.
for (const m of moduleManifest_1.EXTRA_MOUNTS) {
    if (m.module)
        app.use(m.path, (0, planGate_1.requireModule)(m.module), m.router);
    else
        app.use(m.path, m.router);
}
// MVP concept routers (per `routes/mvpConcepts.ts`) MUST mount BEFORE
// the generic planning stubs so module-specific paths (e.g.
// `/api/startup-exchange/listings`) take precedence and unknown paths
// still fall through to /health, /waitlist on the planning stub.
(0, mvpConcepts_1.mountMvpConcepts)(app);
// Planning-stage modules — shared status + waitlist surface
for (const cfg of planningStubs_1.PLANNING_MODULES) {
    app.use(`/api/${cfg.id}`, (0, planningStubs_1.createPlanningStubRouter)(cfg));
}
// DevHub — AI-powered developer platform
app.use("/api/devhub", devhub_1.devhubRouter);
// QMedia — music, video and creative tools
app.use("/api/qmedia", qmedia_1.qmediaRouter);
// Payments — Stripe + PayBox KZ unified gateway
app.use("/api/payments", payments_1.paymentsRouter);
// QAI — universal public AI assistant
app.use("/api/qai", qai_1.qaiRouter);
// QStore — digital marketplace
app.use("/api/qstore", qstore_1.qstoreRouter);
// QLearn — learning platform
app.use("/api/qlearn", qlearn_1.qlearnRouter);
// QMelanin — anti-graying engine (deterministic, DB-free)
app.use("/api/qmelanin", qmelanin_1.qmelaninRouter);
// QRenew — cellular-renewal program (biological age + tiered stack)
app.use("/api/qrenew", qrenew_1.qrenewRouter);
// Longevity — measure→act→re-measure protocol engine (panel + graded stack + progress)
app.use("/api/longevity", longevity_1.longevityRouter);
// QNews — standalone product #30
app.use("/api/qnews", qnews_1.qnewsRouter);
// StartupX — startup ideas marketplace + investor interest
app.use("/api/startupx", startupExchange_1.startupExchangeRouter);
app.use("/api/ventures", ventures_1.venturesRouter);
// QVenture + QSkyway now mounted via routes/moduleManifest.ts (EXTRA_MOUNTS)
// Kids AI Content — multilang lesson catalog + AI tutor
app.use("/api/kids-ai", kidsAiContent_1.kidsAiContentRouter);
// QJobs → QBuild social hiring layer. Canonical: /api/build/jobs, legacy: /api/qjobs
app.use("/api/build/jobs", qjobs_1.qjobsRouter);
app.use("/api/qjobs", qjobs_1.qjobsRouter);
// QSocial → QBuild social layer. Canonical: /api/build/social, legacy: /api/qsocial
app.use("/api/build/social", qsocial_1.qsocialRouter);
app.use("/api/qsocial", qsocial_1.qsocialRouter);
// QEvents now mounted via routes/moduleManifest.ts (EXTRA_MOUNTS)
// Revenue Hub — centralized monetization: Gumroad + YouTube + Twitch per app
app.use("/api/revenue", revenue_1.revenueRouter);
// Universal Search — /api/search?q=<query> across QStore/QLearn/QNews/QEvents/QJobs/QRight
app.use("/api/search", search_1.searchRouter);
// QPayNet — embedded payment infrastructure
app.use("/api/qpaynet", qpaynet_1.qpaynetRouter);
(0, qpaynet_1.startQpaynetRetryWorker)();
// QTradeOffline — offline-first P2P AEV payments (ECDSA P-256, /sync batch)
app.use("/api/qtradeoffline", qtradeoffline_1.qtradeOfflineRouter);
// Адрес, которого в API нет, отвечает JSON, а не страницей Express.
// Ставится ПОСЛЕ всех роутеров и ПЕРЕД обработчиком ошибок: иначе он перехватил
// бы живые маршруты. Разбор — в самом модуле.
app.use((0, httpErrorHandler_1.makeApiNotFoundHandler)());
// Обработчик ошибок живёт в src/lib/httpErrorHandler.ts — вынесен туда, чтобы
// его можно было проверить тестом, не поднимая весь сервер. Разбор клиентских
// отказов (413/400 вместо 500 и без Sentry) описан там же.
app.use((0, httpErrorHandler_1.makeHttpErrorHandler)());
// QSign v2 — Sentry init (no-op when SENTRY_DSN unset). Must run before
// the listener binds so any startup failures are captured too.
(0, sentry_1.initSentry)();
const httpServer = app.listen(PORT, () => {
    /*
     * 🔴 Ключ подписи бюро проверяется ПРИ СТАРТЕ, а не при первой нотаризации
     * (12.10.2026). Негодный PEM раньше дал бы 500 первому покупателю; теперь
     * он виден в журнале сразу после выкатки, а /health называет режим «сломан».
     */
    try {
        const { sostoyanieKlyucha } = require("./lib/bureauNotaryKey");
        const к = sostoyanieKlyucha();
        if (к.режим === "сломан")
            console.error("[bureau] BUREAU_NOTARY_SIGNING_KEY задан, но НЕГОДЕН:", к.pochemu);
        else
            console.log("[bureau] подпись нотариуса:", к.режим, к.idKlyucha ? "keyId=" + к.idKlyucha : "");
    }
    catch (e) {
        console.error("[bureau] не смог проверить ключ подписи:", e instanceof Error ? e.message : e);
    }
    console.log(`AEVION Globus Backend запущен на порту ${PORT}`);
    // QSign v2 — DB-backed webhook delivery queue. Survives restarts.
    (0, webhooks_1.startWebhookWorker)();
    // Дообновление якорей OpenTimestamps. До 28.08.2026 полное доказательство
    // забиралось ТОЛЬКО нажатием кнопки самим автором, и сертификат висел в
    // состоянии «ожидает подтверждения» бессрочно — при том что якорь в биткойне
    // уже существовал. Разбор — в самом модуле.
    (0, upgradeWorker_1.startOtsUpgradeWorker)();
    // Карта версий токенов. Пока она не загружена, проверка отзыва НЕ
    // применяется (см. lib/tokenVersion.ts): это осознанный выбор направления
    // отказа — падать закрыто значило бы не пустить вообще никого при недоступной
    // базе. Но слепота не бывает молчаливой: модуль кричит в журнал, а состояние
    // видно снаружи в /api/health/deep.
    //
    // Перезагрузка раз в 5 минут нужна для второго экземпляра сервиса: он
    // увеличивает счётчик в базе, а наша карта об этом узнает только так.
    void Promise.resolve().then(() => __importStar(require("./lib/tokenVersion"))).then(async ({ loadTokenVersions }) => {
        await loadTokenVersions();
        setInterval(() => void loadTokenVersions(), 5 * 60 * 1000).unref();
    });
    /*
     * Свип пробных сайтов DevHub. Уборка после выкатки живёт в ПАМЯТИ процесса
     * (deferred), а перезапуск сервиса случается при каждой выкатке — значит
     * отложенные уборки стираются, и пробный сайт остаётся публичным навсегда.
     * Замер 07.10.2026: пробу на проде пришлось убирать руками именно поэтому.
     * Это страховка тем же механизмом, а не второй механизм.
     */
    void Promise.resolve().then(() => __importStar(require("./routes/devhub"))).then(({ запуститьСвипПробныхСайтов }) => {
        запуститьСвипПробныхСайтов();
    });
});
// Last-resort process-level backstops. Express 5 auto-forwards async request-
// handler rejections to the error middleware, but a throw inside a setInterval/
// timer callback (e.g. the 3s matchmaking pairing scan) or a stray unhandled
// promise rejection bypasses Express entirely — without these, one such throw
// terminates the whole backend and takes every AEVION module down with it.
// Policy: log + capture, NEVER exit. A single bad tick must not kill the process.
process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
    try {
        (0, sentry_2.captureException)(err, { where: "uncaughtException" });
    }
    catch { /* never throw from the backstop */ }
});
process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
    try {
        (0, sentry_2.captureException)(reason instanceof Error ? reason : new Error(String(reason)), { where: "unhandledRejection" });
    }
    catch { /* never throw from the backstop */ }
});
// Завершение по сигналу замены — кодом 0. Без этого Railway присылал
// «Deploy Crashed!» на КАЖДУЮ выкатку (пять писем за 30.09–01.10): гаснет СТАРЫЙ
// экземпляр, у процесса не было обработчика SIGTERM, и платформа читала штатную
// замену как аварию. Разбор и жёсткий предел — в lib/gracefulShutdown.ts.
(0, gracefulShutdown_1.зарегистрироватьЗавершение)(process, {
    сервер: httpServer,
    закрытьПул: dbPool_1.закрытьПулЕслиОткрыт,
    выход: (код) => process.exit(код),
});
// QCoreAI duplex transport — same orchestrator as POST /multi-agent (SSE)
// but lets clients interject mid-run guidance on the same connection.
(0, wsServer_1.attachQCoreWebSocket)(httpServer, "/api/qcoreai/ws");
(0, collab_1.attachConstitutionCollab)(httpServer, "/api/constitution/collab");
(0, constitutionStatus_1.startUptimeChecker)(PORT);
// QCoreAI scheduler — polls for due scheduled batches every minute.
(0, qcoreai_1.startScheduler)();
