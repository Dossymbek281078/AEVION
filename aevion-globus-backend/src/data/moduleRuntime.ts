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
 * Переклассифицировано по фактам prod-health (catch-all нет — фейк-id даёт 404,
 * значит каждый 200 = реально смонтированный роутер). Критерий:
 *   • mvp_live    — живой API с фича-данными ИЛИ реальная функциональная страница
 *                   (health отдаёт домен-поля: sectors/profiles/tracks/documents/…),
 *                   НЕ самозаявленный planning/idea/waitlist.
 *   • platform_api— роутер смонтирован + Postgres, но health голый {ok,module,db}
 *                   (реальный бэкенд-скелет, ещё не полный продукт).
 *   • portal_only — нет своего API ЛИБО сам заявляет phase planning/idea/waitlist.
 * Итог: mvp_live 21 · platform_api 13 · portal_only 5.
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

  // ── platform_api: роутер+Postgres смонтированы, health голый (скелет) ────────
  qai: {
    tier: "platform_api",
    primaryPath: "/qai",
    apiHints: ["/api/qai/*"],
    hint: "AI-сессии · роутер живой, данных пока нет",
  },
  qstore: {
    tier: "platform_api",
    primaryPath: "/qstore",
    apiHints: ["/api/qstore/*"],
    hint: "Магазин · Postgres-роутер (скелет)",
  },
  qevents: {
    tier: "platform_api",
    primaryPath: "/qevents",
    apiHints: ["/api/qevents/*"],
    hint: "События · Postgres-роутер (скелет)",
  },
  qlearn: {
    tier: "platform_api",
    primaryPath: "/qlearn",
    apiHints: ["/api/qlearn/*"],
    hint: "Обучение · Postgres-роутер (скелет)",
  },
  qgood: {
    tier: "platform_api",
    primaryPath: "/qgood",
    apiHints: ["/api/qgood/*"],
    hint: "Психология · роутер живой (скелет)",
  },
  qmaskcard: {
    tier: "platform_api",
    primaryPath: "/qmaskcard",
    apiHints: ["/api/qmaskcard/*"],
    hint: "Маск-карты · роутер живой (скелет)",
  },
  qchaingov: {
    tier: "platform_api",
    primaryPath: "/qchaingov",
    apiHints: ["/api/qchaingov/*"],
    hint: "DAO-управление · роутер живой (скелет)",
  },
  deepsan: {
    tier: "platform_api",
    primaryPath: "/deepsan",
    apiHints: ["/api/deepsan/*"],
    hint: "Фокус/продуктивность · Postgres-роутер (скелет)",
  },
  lifebox: {
    tier: "platform_api",
    primaryPath: "/lifebox",
    apiHints: ["/api/lifebox/*"],
    hint: "Сейф · Postgres-роутер (скелет)",
  },
  "psyapp-deps": {
    tier: "platform_api",
    primaryPath: "/psyapp-deps",
    apiHints: ["/api/psyapp-deps/*"],
    hint: "Зависимости · Postgres-роутер (скелет)",
  },
  qpersona: {
    tier: "platform_api",
    primaryPath: "/qpersona",
    apiHints: ["/api/qpersona/*"],
    hint: "Аватар · Postgres-роутер (скелет)",
  },
  qlife: {
    tier: "platform_api",
    primaryPath: "/qlife",
    apiHints: ["/api/qlife/*"],
    hint: "Longevity · Postgres-роутер (скелет)",
  },
  shadownet: {
    tier: "platform_api",
    primaryPath: "/shadownet",
    apiHints: ["/api/shadownet/*"],
    hint: "Сеть R&D · Postgres-роутер (скелет)",
  },

  // ── portal_only: нет своего API ЛИБО самозаявленный planning/idea/waitlist ───
  veilnetx: {
    tier: "portal_only",
    primaryPath: "/veilnetx",
    apiHints: ["/api/veilnetx/*"],
    hint: "Крипто · phase planning (waitlist), ETA Q4 2026",
  },
  "kids-ai-content": {
    tier: "portal_only",
    primaryPath: "/kids-ai-content",
    apiHints: ["/api/kids-ai-content/*"],
    hint: "Детский контент · phase planning (waitlist), ETA Q4 2026",
  },
  "startup-exchange": {
    tier: "portal_only",
    primaryPath: "/startup-exchange",
    apiHints: ["/api/startup-exchange/*"],
    hint: "Связка с QRight · phase planning (waitlist), ETA Q2 2027",
  },
  "z-tide": {
    tier: "portal_only",
    primaryPath: "/z-tide",
    apiHints: ["/api/z-tide/*"],
    hint: "Концепт · phase idea (waitlist)",
  },
  "qpaynet-embedded": {
    tier: "portal_only",
    primaryPath: null,
    apiHints: [],
    hint: "Песочница позже · своего API нет",
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
