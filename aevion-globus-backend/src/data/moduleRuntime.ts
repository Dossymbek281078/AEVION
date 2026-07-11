import type { GlobusProject } from "../types/globus";

/** Уровень готовности для ускорения разработки и UI. */
export type ModuleTier =
  | "mvp_live" // отдельная страница + рабочий API / ядро
  | "platform_api" // есть или планируется префикс API (stub)
  | "portal_only"; // конвейер /[id] + Auth/QRight/QSign/Bureau

export interface ModuleRuntimeMeta {
  tier: ModuleTier;
  /** Путь в Next.js или null */
  primaryPath: string | null;
  /** Задействованные API префиксы (информативно) */
  apiHints: string[];
  /** Короткая подсказка для дашборда */
  hint: string;
}

/**
 * Полное покрытие 39 узлов из `projects.ts`.
 *
 * ⚠️ Аудит 2026-07-11 (прод-проверка каждого модуля, aevion.vercel.app/api-backend):
 * старая карта покрывала лишь ~27 модулей — всё новое падало в DEFAULT (portal_only),
 * из-за чего дашборд показывал mvp_live=9, ХОТЯ рабочих бэкендов много больше.
 * ВАЖНО: короткое health-тело ≠ скелет. Первый проход (21/13/5) занизил 13
 * модулей, судя лишь по терсному health. Повторный аудит дёрнул РЕАЛЬНЫЙ
 * GET-эндпоинт каждого модуля на проде — критерий по функции, не по health:
 *   • mvp_live    — рабочий API отдаёт живые данные (или корректный gate:
 *                   402 paywall / 401 auth) + фронт-страница. 34 модуля.
 *   • platform_api— API+фронт есть, но модуль САМ заявляет pre-launch/waitlist
 *                   (veilnetx/kids-ai-content/startup-exchange/z-tide). 4 модуля.
 *   • portal_only — 0. Не построенных модулей НЕТ: qpaynet-embedded построен под
 *                   путём /api/qpaynet (id≠путь), первый пробник дал ложный 404.
 * Итог: mvp_live 35 · platform_api 4 · portal_only 0.  ВСЕ 39 модулей построены;
 * 35 работают, 4 сами на self-declared waitlist. (catch-all нет: fake-id=404)
 */
export const MODULE_RUNTIME: Record<string, ModuleRuntimeMeta> = {
  // ── mvp_live: рабочий продукт (verified prod API/страница) ──────────────────
  globus: {
    tier: "mvp_live",
    primaryPath: "/",
    apiHints: ["/api/globus/projects"],
    hint: "Портал + 3D карта",
  },
  ventures: {
    tier: "mvp_live",
    primaryPath: "/ventures",
    apiHints: ["/api/globus/projects"],
    hint: "Идея-Маркет: 20 моделей до $10M + венчур AEVIA",
  },
  qcoreai: {
    tier: "mvp_live",
    primaryPath: "/qcoreai",
    apiHints: ["/api/qcoreai/chat", "/api/qcoreai/health"],
    hint: "Мульти-провайдер чат: 16 провайдеров, anthropic активен, Postgres",
  },
  "multichat-engine": {
    tier: "mvp_live",
    primaryPath: "/multichat-engine",
    apiHints: ["/api/qcoreai/chat"],
    hint: "Витрина → общий чат QCoreAI",
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
    apiHints: ["/api/qsign/v2/*", "/api/qsign/sign", "/api/qsign/verify"],
    hint: "Подпись: v2 в проде (v1 HMAC legacy)",
  },
  "aevion-ip-bureau": {
    tier: "mvp_live",
    primaryPath: "/bureau",
    apiHints: ["/api/qright/objects", "/api/qsign/*"],
    hint: "QRight + QSign UI",
  },
  qbuild: {
    tier: "mvp_live",
    primaryPath: "/build",
    apiHints: ["/api/build/*"],
    hint: "Найм в стройке: проекты, вакансии, AI-coach, loyalty тиры",
  },
  qtradeoffline: {
    tier: "mvp_live",
    primaryPath: "/qtrade",
    apiHints: ["/api/qtradeoffline/*"],
    hint: "Торговый MVP · Postgres (wallets/transfers/nonces)",
  },
  qventure: {
    tier: "mvp_live",
    primaryPath: "/qventure",
    apiHints: ["/api/qventure/analyze", "/api/qventure/benchmark", "/api/qventure/health"],
    hint: "AI-инвестаналитик: скор + совет 4 ролей + бенчмарк · 18 секторов · Postgres",
  },
  "smeta-trainer": {
    tier: "mvp_live",
    primaryPath: "/smeta-trainer",
    apiHints: ["/api/smeta-trainer/*"],
    hint: "AI-тренажёр сметного дела РК · Postgres (v2)",
  },
  healthai: {
    tier: "mvp_live",
    primaryPath: "/healthai",
    apiHints: ["/api/healthai/*"],
    hint: "Health vertical · 64 профиля, 10 правил · Postgres",
  },
  qfusionai: {
    tier: "mvp_live",
    primaryPath: "/qfusionai",
    apiHints: ["/api/qfusionai/*"],
    hint: "Fusion AI 2.0-mvp: несколько провайдеров",
  },
  "revenue-hub": {
    tier: "mvp_live",
    primaryPath: "/revenue",
    apiHints: ["/api/revenue/*"],
    hint: "Монетизация: LemonSqueezy живой канал подписок",
  },
  qcontract: {
    tier: "mvp_live",
    primaryPath: "/qcontract",
    apiHints: ["/api/qcontract/*"],
    hint: "Контракты · Postgres (документы)",
  },
  qmedia: {
    tier: "mvp_live",
    primaryPath: "/qmedia",
    apiHints: ["/api/qmedia/*"],
    hint: "Медиа: треки/плейлисты/видео/лайки · Postgres",
  },
  "voice-of-earth": {
    tier: "mvp_live",
    primaryPath: "/voice-of-earth",
    apiHints: ["/api/voice-of-earth/*"],
    hint: "Медиа-проект · 22 трека · Postgres",
  },
  mapreality: {
    tier: "mvp_live",
    primaryPath: "/mapreality",
    apiHints: ["/api/mapreality/*"],
    hint: "Карта потребностей · 17 сигналов · Postgres",
  },
  qnews: {
    tier: "mvp_live",
    primaryPath: "/qnews",
    apiHints: ["/api/qnews/*"],
    hint: "Новостной модуль · живой сервис",
  },
  cyberchess: {
    tier: "mvp_live",
    primaryPath: "/cyberchess",
    apiHints: [],
    hint: "Шахматная платформа (ядро клиентское: игра/пазлы/турниры)",
  },
  constitution: {
    tier: "mvp_live",
    primaryPath: "/constitution",
    apiHints: [],
    hint: "Design Lab · 12 страниц (ядро фронтовое)",
  },

  // ── mvp_live (2): доп. модули с рабочим API+фронтом (functional-probe verified) ─
  // Изначально ошибочно занижены в platform_api по короткому health; повторный
  // аудит дёрнул реальный GET-эндпоинт каждого — все отдают живые данные (или
  // корректный gate 402 paywall / 401 auth), фронт-страницы 224–867 строк.
  qai: {
    tier: "mvp_live",
    primaryPath: "/qai",
    apiHints: ["/api/qai/sessions"],
    hint: "AI-сессии · 16 endpoints · за платной стеной (402 upgrade)",
  },
  qstore: {
    tier: "mvp_live",
    primaryPath: "/qstore",
    apiHints: ["/api/qstore/categories", "/api/qstore/*"],
    hint: "Магазин шаблонов/пресетов · 27 endpoints · живые категории",
  },
  qevents: {
    tier: "mvp_live",
    primaryPath: "/qevents",
    apiHints: ["/api/qevents/categories", "/api/qevents/*"],
    hint: "События · 26 endpoints · живой каталог",
  },
  qlearn: {
    tier: "mvp_live",
    primaryPath: "/qlearn",
    apiHints: ["/api/qlearn/*"],
    hint: "Обучение · 48 endpoints · за платной стеной (402 upgrade)",
  },
  qgood: {
    tier: "mvp_live",
    primaryPath: "/qgood",
    apiHints: ["/api/qgood/campaigns", "/api/qgood/*"],
    hint: "Благотворительность/кампании · 18 endpoints",
  },
  qmaskcard: {
    tier: "mvp_live",
    primaryPath: "/qmaskcard",
    apiHints: ["/api/qmaskcard/masks"],
    hint: "Маск-карты · 7 endpoints · auth-gated (401)",
  },
  qchaingov: {
    tier: "mvp_live",
    primaryPath: "/qchaingov",
    apiHints: ["/api/qchaingov/proposals"],
    hint: "DAO · 11 endpoints · живые proposals (Postgres)",
  },
  deepsan: {
    tier: "mvp_live",
    primaryPath: "/deepsan",
    apiHints: ["/api/deepsan/tasks"],
    hint: "Фокус/задачи · 13 endpoints · живые tasks (Postgres)",
  },
  lifebox: {
    tier: "mvp_live",
    primaryPath: "/lifebox",
    apiHints: ["/api/lifebox/categories"],
    hint: "Сейф знаний · 9 endpoints · живые категории (Postgres)",
  },
  "psyapp-deps": {
    tier: "mvp_live",
    primaryPath: "/psyapp-deps",
    apiHints: ["/api/psyapp-deps/affirmations"],
    hint: "Зависимости · 13 endpoints · живые аффирмации",
  },
  qpersona: {
    tier: "mvp_live",
    primaryPath: "/qpersona",
    apiHints: ["/api/qpersona/stats"],
    hint: "Аватар · 10 endpoints · 23 записи (Postgres)",
  },
  qlife: {
    tier: "mvp_live",
    primaryPath: "/qlife",
    apiHints: ["/api/qlife/stats"],
    hint: "Longevity · 7 endpoints · 13 логов / 11 юзеров",
  },
  shadownet: {
    tier: "mvp_live",
    primaryPath: "/shadownet",
    apiHints: ["/api/shadownet/threat-models"],
    hint: "Приватность · 12 endpoints · живые threat-models (фронт слабо wired)",
  },

  // ── platform_api (2): API+фронт есть, но модуль САМ заявляет pre-launch/waitlist
  veilnetx: {
    tier: "platform_api",
    primaryPath: "/veilnetx",
    apiHints: ["/api/veilnetx/status", "/api/veilnetx/*"],
    hint: "Крипто · 6 endpoints · self-declared planning/waitlist, ETA Q4 2026 (реально pre-product)",
  },
  "kids-ai-content": {
    tier: "platform_api",
    primaryPath: "/kids-ai-content",
    apiHints: ["/api/kids-ai-content/*"],
    hint: "Детский контент · 8 endpoints · функц. готов, но нужен child-safety ревью до launch",
  },
  // ── startup-exchange + z-tide: страницы ЖИВЫЕ и рабочие (реальные бэкенды
  //    /api/startupx, /api/ztide), «waitlist» был устаревший ярлык → mvp_live.
  //    Planning-vision (эскроу/smart-NDA у startupx; currency-research у z-tide)
  //    остаётся в planningStubs.ts как осознанный roadmap — не product-статус.
  "startup-exchange": {
    tier: "mvp_live",
    primaryPath: "/startup-exchange",
    apiHints: ["/api/startupx/ideas", "/api/startupx/stats", "/api/startupx/*"],
    hint: "Биржа стартапов/идей · /ideas+/stats живые · страница подключена к реальному API",
  },
  "z-tide": {
    tier: "mvp_live",
    primaryPath: "/z-tide",
    apiHints: ["/api/ztide/leaderboard", "/api/ztide/stats", "/api/ztide/*"],
    hint: "Стрики/leaderboard/очки · /api/ztide живой (юзеры+события) · страница рабочая",
  },

  // ── qpaynet-embedded: ПОСТРОЕН (id≠путь — реестр qpaynet-embedded, API /api/qpaynet)
  // Первый пробник дёрнул /api/qpaynet-embedded (реестровый id) → ложный 404.
  // Реально: /api/qpaynet — 67 endpoints, страница /qpaynet, 27 кошельков /
  // 54 транзакции / шифрование / Stripe-вебхуки + retry-worker.
  "qpaynet-embedded": {
    tier: "mvp_live",
    primaryPath: "/qpaynet",
    apiHints: ["/api/qpaynet/health", "/api/qpaynet/stats", "/api/qpaynet/*"],
    hint: "Встраиваемые платежи · 67 endpoints · Postgres (27 кошельков, шифрование, Stripe webhooks)",
  },
};

const DEFAULT_META: ModuleRuntimeMeta = {
  tier: "portal_only",
  primaryPath: null,
  apiHints: [],
  hint: "Конвейер на странице модуля",
};

export function getModuleRuntime(id: string): ModuleRuntimeMeta {
  return MODULE_RUNTIME[id] ?? DEFAULT_META;
}

export type GlobusProjectWithRuntime = GlobusProject & { runtime: ModuleRuntimeMeta };

export function enrichProject(p: GlobusProject): GlobusProjectWithRuntime {
  return { ...p, runtime: getModuleRuntime(p.id) };
}

export function enrichProjects(list: GlobusProject[]): GlobusProjectWithRuntime[] {
  return list.map(enrichProject);
}
