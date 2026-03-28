"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_RUNTIME = void 0;
exports.getModuleRuntime = getModuleRuntime;
exports.enrichProject = enrichProject;
exports.enrichProjects = enrichProjects;
/**
 * Полное покрытие 27 узлов из `projects.ts`.
 * Обновляйте tier по мере появления реальных страниц/API.
 */
exports.MODULE_RUNTIME = {
    globus: {
        tier: "mvp_live",
        primaryPath: "/",
        apiHints: ["/api/globus/projects"],
        hint: "Портал + 3D карта",
    },
    qcoreai: {
        tier: "mvp_live",
        primaryPath: "/qcoreai",
        apiHints: ["/api/qcoreai/chat", "/api/qcoreai/health"],
        hint: "Чат: OpenAI при ключе, иначе stub",
    },
    "multichat-engine": {
        tier: "mvp_live",
        primaryPath: "/multichat-engine",
        apiHints: ["/api/qcoreai/chat", "/multichat-engine (UI мост)"],
        hint: "Витрина → общий чат QCoreAI; агенты позже",
    },
    qfusionai: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "R&D — конвейер AEVION",
    },
    qright: {
        tier: "mvp_live",
        primaryPath: "/qright",
        apiHints: ["/api/qright/objects"],
        hint: "Реестр + Postgres",
    },
    qsign: {
        tier: "mvp_live",
        primaryPath: "/qsign",
        apiHints: ["/api/qsign/sign", "/api/qsign/verify"],
        hint: "HMAC подпись",
    },
    "aevion-ip-bureau": {
        tier: "mvp_live",
        primaryPath: "/bureau",
        apiHints: ["/api/qright/objects", "/api/qsign/*"],
        hint: "QRight + QSign UI",
    },
    qtradeoffline: {
        tier: "mvp_live",
        primaryPath: "/qtrade",
        apiHints: ["/api/qtrade/*"],
        hint: "Торговый MVP · JSON на диск (.aevion-data)",
    },
    "qpaynet-embedded": {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Песочница позже",
    },
    qmaskcard: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "После платёжного ядра",
    },
    veilnetx: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Крипто R&D",
    },
    cyberchess: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Отдельный трек / витрина",
    },
    healthai: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Health vertical",
    },
    qlife: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Longevity",
    },
    qgood: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Психология",
    },
    "psyapp-deps": {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Зависимости — осторожно с контентом",
    },
    qpersona: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Аватар",
    },
    "kids-ai-content": {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Детский контент",
    },
    "voice-of-earth": {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Медиа-проект",
    },
    "startup-exchange": {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Связка с QRight",
    },
    deepsan: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Фокус / продуктивность",
    },
    mapreality: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Карта потребностей",
    },
    "z-tide": {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Концепт",
    },
    qcontract: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "После QSign",
    },
    shadownet: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Сеть R&D",
    },
    lifebox: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "Сейф",
    },
    qchaingov: {
        tier: "portal_only",
        primaryPath: null,
        apiHints: [],
        hint: "DAO",
    },
};
const DEFAULT_META = {
    tier: "portal_only",
    primaryPath: null,
    apiHints: [],
    hint: "Конвейер на странице модуля",
};
function getModuleRuntime(id) {
    return exports.MODULE_RUNTIME[id] ?? DEFAULT_META;
}
function enrichProject(p) {
    return { ...p, runtime: getModuleRuntime(p.id) };
}
function enrichProjects(list) {
    return list.map(enrichProject);
}
