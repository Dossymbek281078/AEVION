/**
 * AEVION Revenue Registry
 *
 * Per-app monetization config — единый источник правды о том,
 * какие каналы монетизации активны в каждом приложении.
 *
 * Stripe-атрибуция: каждый платёж тегируется metadata.app_id = appId.
 * YouTube/Twitch: read-only stats через API, ключи в ENV.
 * PayBox: orderId prefix = appId (например cyberchess-1748600000-abc)
 */

export type RevenueChannel =
  | "stripe_subscription"   // периодические подписки
  | "stripe_onetime"        // разовые платежи
  | "paybox"                // PayBox KZT
  | "kaspi"                 // Kaspi Pay (coming soon)
  | "youtube_adsense"       // YouTube AdSense / Shorts monetization
  | "twitch_affiliate"      // Twitch bits + subs + affiliate
  | "twitch_partner"        // Twitch Partner (расширенный)
  | "in_app_purchase"       // внутриигровые покупки
  | "donation"              // пожертвования
  | "course_sale"           // продажа курсов
  | "marketplace";          // маркетплейс (QStore и т.п.)

export interface AppRevenueMeta {
  appId: string;
  appName: string;
  /** Активные каналы монетизации */
  channels: RevenueChannel[];
  /** ENV-переменная с ID канала YouTube (если есть) */
  youtubeChannelEnvKey?: string;
  /** ENV-переменная с логином Twitch-канала */
  twitchChannelEnvKey?: string;
  /** Stripe Price IDs для подписок этого приложения */
  stripePriceIds?: string[];
  /** Цветовой маркер в дашборде */
  color: string;
  /** Описание для дашборда */
  description: string;
  /** Лайв или нет */
  live: boolean;
}

export const REVENUE_APPS: AppRevenueMeta[] = [
  {
    appId: "cyberchess",
    appName: "CyberChess",
    channels: ["stripe_subscription", "stripe_onetime", "twitch_affiliate", "youtube_adsense", "in_app_purchase"],
    youtubeChannelEnvKey: "CYBERCHESS_YOUTUBE_CHANNEL_ID",
    twitchChannelEnvKey: "CYBERCHESS_TWITCH_CHANNEL",
    color: "#6366f1",
    description: "Шахматная платформа — premium-аккаунты, турнирные взносы, Twitch-трансляции",
    live: true,
  },
  {
    appId: "qlearn",
    appName: "QLearn",
    channels: ["stripe_subscription", "course_sale", "paybox"],
    color: "#10b981",
    description: "Образовательная платформа — подписки, продажа курсов",
    live: true,
  },
  {
    appId: "smeta-trainer",
    appName: "Smeta Trainer",
    channels: ["stripe_onetime", "paybox", "course_sale"],
    color: "#f59e0b",
    description: "Тренажёр сметного дела РК — разовые покупки курсов",
    live: true,
  },
  {
    appId: "qstore",
    appName: "QStore",
    channels: ["stripe_onetime", "paybox", "marketplace"],
    color: "#ec4899",
    description: "Маркетплейс — транзакционные комиссии, прямые продажи",
    live: true,
  },
  {
    appId: "qgood",
    appName: "QGood",
    channels: ["stripe_onetime", "donation", "paybox"],
    color: "#14b8a6",
    description: "Благотворительность — пожертвования, сборы",
    live: true,
  },
  {
    appId: "qmedia",
    appName: "QMedia",
    channels: ["stripe_subscription", "youtube_adsense", "twitch_affiliate"],
    youtubeChannelEnvKey: "QMEDIA_YOUTUBE_CHANNEL_ID",
    twitchChannelEnvKey: "QMEDIA_TWITCH_CHANNEL",
    color: "#f97316",
    description: "Медиа-платформа — подписки, YouTube-монетизация, Twitch",
    live: true,
  },
  {
    appId: "qpaynet-embedded",
    appName: "QPayNet",
    channels: ["stripe_onetime", "paybox"],
    color: "#3b82f6",
    description: "Финансовые операции — комиссии за переводы",
    live: true,
  },
  {
    appId: "healthai",
    appName: "HealthAI",
    channels: ["stripe_subscription", "paybox"],
    color: "#22c55e",
    description: "AI-здоровье — подписки Premium",
    live: true,
  },
  {
    appId: "qcoreai",
    appName: "QCoreAI",
    channels: ["stripe_subscription", "stripe_onetime"],
    color: "#a855f7",
    description: "AI-платформа — API-кредиты, подписки Pro",
    live: true,
  },
  {
    appId: "psyapp-deps",
    appName: "PsyApp",
    channels: ["stripe_subscription", "paybox"],
    color: "#06b6d4",
    description: "Психологические инструменты — подписки",
    live: true,
  },
  {
    appId: "startup-exchange",
    appName: "Startup Exchange",
    channels: ["stripe_onetime", "stripe_subscription"],
    color: "#84cc16",
    description: "Стартап-биржа — листинги, featured-места",
    live: true,
  },
  {
    appId: "aevion-resonance",
    appName: "AEVION Resonance",
    channels: ["stripe_onetime", "paybox", "course_sale"],
    color: "#fb923c",
    description: "B2C протокол аллергии — продажа руководств, курсов",
    live: false,
  },
  {
    appId: "qfusionai",
    appName: "QFusionAI",
    channels: ["stripe_subscription", "stripe_onetime"],
    color: "#8b5cf6",
    description: "AI-ансамбли — подписки Pro, API-кредиты",
    live: true,
  },
  {
    appId: "qmaskcard",
    appName: "QMaskCard",
    channels: ["stripe_subscription"],
    color: "#64748b",
    description: "Защита идентичности — Premium-подписки",
    live: true,
  },
  {
    appId: "veilnetx",
    appName: "VeilNetX",
    channels: ["stripe_subscription"],
    color: "#475569",
    description: "Privacy-сеть — подписки",
    live: true,
  },
  {
    appId: "qlife",
    appName: "QLife",
    channels: ["stripe_subscription", "paybox"],
    color: "#0ea5e9",
    description: "Лайф-трекер — Premium",
    live: true,
  },
  {
    appId: "qpersona",
    appName: "QPersona",
    channels: ["stripe_subscription"],
    color: "#c084fc",
    description: "Личный AI-ассистент — подписки",
    live: true,
  },
  {
    appId: "kids-ai-content",
    appName: "Kids AI Content",
    channels: ["stripe_subscription", "paybox", "course_sale"],
    color: "#fbbf24",
    description: "Детский AI-контент — семейные подписки, продажа курсов",
    live: true,
  },
  {
    appId: "voice-of-earth",
    appName: "Voice of Earth",
    channels: ["donation", "stripe_onetime"],
    color: "#16a34a",
    description: "Социальная инициатива — пожертвования",
    live: true,
  },
  {
    appId: "deepsan",
    appName: "DeepSan",
    channels: ["stripe_subscription", "course_sale"],
    color: "#0891b2",
    description: "Глубинные сан-инструменты — подписки, курсы",
    live: true,
  },
  {
    appId: "mapreality",
    appName: "MapReality",
    channels: ["stripe_subscription", "stripe_onetime"],
    color: "#dc2626",
    description: "AR-карта реальности — Premium, разовые покупки",
    live: true,
  },
  {
    appId: "z-tide",
    appName: "Z-Tide",
    channels: ["stripe_subscription"],
    color: "#7c3aed",
    description: "Социальная волна — подписки",
    live: true,
  },
  {
    appId: "qcontract",
    appName: "QContract",
    channels: ["stripe_onetime", "paybox"],
    color: "#0f766e",
    description: "Цифровые контракты — разовые сборы",
    live: true,
  },
  {
    appId: "shadownet",
    appName: "ShadowNet",
    channels: ["stripe_subscription"],
    color: "#334155",
    description: "Анонимная сеть — подписки",
    live: true,
  },
  {
    appId: "lifebox",
    appName: "LifeBox",
    channels: ["stripe_subscription"],
    color: "#e11d48",
    description: "Личное хранилище — Premium-подписки",
    live: true,
  },
  {
    appId: "qbuild",
    appName: "QBuild",
    channels: ["stripe_subscription", "paybox"],
    color: "#ea580c",
    description: "Стройка-инструменты — Pro-подписки",
    live: true,
  },
  {
    appId: "qchaingov",
    appName: "QChainGov",
    channels: ["stripe_onetime"],
    color: "#1e40af",
    description: "Governance-голосования — разовые сборы за голос",
    live: true,
  },
  {
    appId: "qnews",
    appName: "QNews",
    channels: ["stripe_subscription", "youtube_adsense"],
    color: "#be123c",
    description: "Новости — подписки Pro, YouTube-монетизация",
    live: true,
  },
  {
    appId: "qai",
    appName: "QAI",
    channels: ["stripe_subscription"],
    color: "#7e22ce",
    description: "Универсальный AI — подписки",
    live: true,
  },
  {
    appId: "qevents",
    appName: "QEvents",
    channels: ["stripe_onetime", "paybox"],
    color: "#0d9488",
    description: "События — продажа билетов",
    live: true,
  },
];

export function getRevenueApp(appId: string): AppRevenueMeta | undefined {
  return REVENUE_APPS.find((a) => a.appId === appId);
}

export function getLiveRevenueApps(): AppRevenueMeta[] {
  return REVENUE_APPS.filter((a) => a.live);
}
