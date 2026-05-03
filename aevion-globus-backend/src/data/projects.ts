import { GlobusProject } from "../types/globus";

const now = new Date().toISOString();

export const projects: GlobusProject[] = [
  // ===== CORE / PLATFORM =====
  {
    id: "globus",
    code: "GLOBUS",
    name: "AEVION Globus",
    description:
      "Центральная карта и портал экосистемы AEVION: реестр проектов, статусы, интеграции.",
    kind: "core",
    status: "launched",
    priority: 1,
    tags: ["core", "portal", "registry"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qcoreai",
    code: "QCOREAI",
    name: "QCoreAI — AI Core Engine",
    description:
      "Базовый ИИ-движок для всех Q-проектов: 5 LLM-провайдеров, rate-limit, chat history.",
    kind: "core",
    status: "launched",
    priority: 1,
    tags: ["ai", "engine", "core"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "multichat-engine",
    code: "MULTICHAT",
    name: "AEVION Multichat Engine",
    description:
      "Мультичат с параллельными агентами: персистентные conversations, fan-out до 8 агентов, JWT-scoped история.",
    kind: "product",
    status: "mvp",
    priority: 2,
    tags: ["ai", "chat", "agents"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qfusionai",
    code: "QFUSIONAI",
    name: "QFusionAI — Hybrid AI Engine",
    description:
      "Гибридный движок, объединяющий лучшие ИИ-платформы и автоматически адаптирующийся к изменениям.",
    kind: "experiment",
    status: "planning",
    priority: 2,
    tags: ["ai", "fusion", "engine"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== IP / LEGAL (FIRST WAVE) =====
  {
    id: "qright",
    code: "QRIGHT",
    name: "QRight — Legal & IP Protection System",
    description:
      "Postgres-реестр объектов IP: SHA-256 + HMAC, geo-fill, prior-art search, royalty webhooks, badge/object порталы.",
    kind: "core",
    status: "launched",
    priority: 1,
    tags: ["ip", "legal", "core"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qsign",
    code: "QSIGN",
    name: "QSign — Digital Signature & Integrity",
    description:
      "Stateless HMAC-SHA256 sign/verify, payload-agnostic. Auto-вызов из QRight/Bureau/QShield.",
    kind: "core",
    status: "launched",
    priority: 1,
    tags: ["signature", "security", "integrity"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "aevion-ip-bureau",
    code: "AIPB",
    name: "AEVION IP Bureau — Electronic Patent Office",
    description:
      "Ed25519 + Shamir SSS, PDF-сертификаты, badge/verify-портал, 6 правовых рамок (Berne/WIPO/TRIPS/eIDAS/ESIGN/KZ).",
    kind: "service",
    status: "launched",
    priority: 1,
    tags: ["ip", "bureau", "certificates"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== FINTECH / PAYMENTS (FIRST WAVE) =====
  {
    id: "qtradeoffline",
    code: "QTRADEOFFLINE",
    name: "QTradeOffline — Offline Trade & Payments",
    description:
      "Платформа для покупок и переводов без интернета: офлайн-операции, верификация, защита.",
    kind: "product",
    status: "planning",
    priority: 1,
    tags: ["payments", "offline", "fintech"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qpaynet-embedded",
    code: "QPAYNET",
    name: "QPayNet Embedded — Payment Core",
    description:
      "Встроенная платёжная система для приложений AEVION: кошельки, переводы, мерчант-ключи, комиссии.",
    kind: "service",
    status: "mvp",
    priority: 1,
    tags: ["payments", "engine", "fintech"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qmaskcard",
    code: "QMASKCARD",
    name: "QMaskCard — Protected Bank Card",
    description:
      "Банковская карта с виртуальными копиями, защищёнными транзакциями и антифрод-механикой.",
    kind: "product",
    status: "idea",
    priority: 2,
    tags: ["card", "security", "fintech"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== CRYPTO / NETWORK =====
  {
    id: "veilnetx",
    code: "VEILNETX",
    name: "VeilNetX — Privacy Crypto & Network",
    description:
      "Криптовалютное ядро и сеть с повышенной приватностью и оптимизацией энергопотребления.",
    kind: "experiment",
    status: "planning",
    priority: 2,
    tags: ["crypto", "privacy", "network"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== CHESS / GAMING (FIRST WAVE MVP) =====
  {
    id: "cyberchess",
    code: "CYBERCHESS",
    name: "CyberChess — New Chess Platform",
    description:
      "22 модуля (Tournaments/Variants/Brilliancy/Ghosts/Leaderboards/CoachKnowledge), bot personas, Postgres tournament persistence, prize webhook.",
    kind: "product",
    status: "mvp",
    priority: 2,
    tags: ["chess", "gaming", "esport"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== HEALTH / LONGEVITY =====
  {
    id: "healthai",
    code: "HEALTHAI",
    name: "HealthAI — Personal AI Doctor",
    description:
      "Персональный ИИ-доктор и тренер здоровья: рекомендации, трекеры, персональные планы.",
    kind: "product",
    status: "mvp",
    priority: 2,
    tags: ["health", "ai", "coach"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qlife",
    code: "QLIFE",
    name: "QLife — Longevity & Anti-Aging",
    description:
      "Система персональной антистареющей программы: биомаркеры, анализы, генетика и план действий.",
    kind: "product",
    status: "idea",
    priority: 2,
    tags: ["health", "longevity", "anti-aging"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== PSYCHOLOGY / WELLBEING =====
  {
    id: "qgood",
    code: "QGOOD",
    name: "QGood — Psychology & Mental Health",
    description:
      "Психологическое приложение с ИИ-собеседником, офлайн-режимом и глубокой персонализацией.",
    kind: "product",
    status: "idea",
    priority: 2,
    tags: ["psychology", "mental-health", "ai"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "psyapp-deps",
    code: "PSYAPP",
    name: "PsyApp — Dependencies Exit",
    description:
      "Платформа выхода из зависимостей (алкоголь/курение и др.): триггеры, поддержка, профилактика срывов.",
    kind: "product",
    status: "idea",
    priority: 3,
    tags: ["addiction", "recovery", "psychology"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== AVATAR / PERSONA =====
  {
    id: "qpersona",
    code: "QPERSONA",
    name: "QPersona — Digital Avatar",
    description:
      "Цифровой аватар-заместитель для работы, общения и представления человека в цифровой среде.",
    kind: "product",
    status: "idea",
    priority: 3,
    tags: ["avatar", "persona", "ai"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== KNOWLEDGE / EDUCATION / CONTENT =====
  {
    id: "kids-ai-content",
    code: "KIDS-AI",
    name: "Kids AI Content — Multi-language Learning",
    description:
      "Детский обучающий контент: мультформаты, логопедический эффект, многоязычность и персонализация.",
    kind: "product",
    status: "planning",
    priority: 3,
    tags: ["kids", "education", "multilang"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "voice-of-earth",
    code: "VOE",
    name: "Voice of the Earth Series",
    description:
      "Международный музыкальный проект: песни на разных языках с позитивной эмоциональной направленностью.",
    kind: "experiment",
    status: "idea",
    priority: 3,
    tags: ["music", "multilang", "content"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== MARKETPLACE / STARTUPS =====
  {
    id: "startup-exchange",
    code: "STARTUPX",
    name: "Startup Exchange — Protected Ideas Marketplace",
    description:
      "Биржа стартапов и идей с автоматической защитой авторства и безопасной коммуникацией с инвесторами.",
    kind: "product",
    status: "planning",
    priority: 2,
    tags: ["startups", "marketplace", "ip"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== OTHER PROJECTS (IDEA STAGE) =====
  {
    id: "deepsan",
    code: "DEEPSAN",
    name: "DeepSan — Anti-chaos App",
    description:
      "Антихаос-приложение: планирование, структурирование задач и поддержка фокуса.",
    kind: "product",
    status: "idea",
    priority: 3,
    tags: ["productivity", "focus"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "mapreality",
    code: "MAPREALITY",
    name: "MapReality — Map of Real Needs",
    description:
      "Карта реальных событий и потребностей: агрегирование запросов и сигналов общества.",
    kind: "experiment",
    status: "idea",
    priority: 3,
    tags: ["map", "data", "society"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "z-tide",
    code: "Z-TIDE",
    name: "Z-Tide — Energy & Emotion Currency",
    description:
      "Концепция валюты, связанной с энергией/эмоциями и социальными сигналами.",
    kind: "experiment",
    status: "idea",
    priority: 4,
    tags: ["currency", "concept"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qcontract",
    code: "QCONTRACT",
    name: "QContract — Self-destruct Smart Documents",
    description:
      "Саморазрушающиеся смарт-документы: контроль доступа, срок действия, защита контента.",
    kind: "product",
    status: "in_progress",
    priority: 3,
    tags: ["documents", "security"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "shadownet",
    code: "SHADOWNET",
    name: "ShadowNet — Alternative Private Network",
    description:
      "Концепция альтернативного интернета с повышенной приватностью и защитой данных.",
    kind: "experiment",
    status: "idea",
    priority: 4,
    tags: ["network", "privacy"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "lifebox",
    code: "LIFEBOX",
    name: "LifeBox — Digital Safe for Future Self",
    description:
      "Цифровой сейф для будущего 'я': документы, знания, инструкции, ценности.",
    kind: "product",
    status: "idea",
    priority: 4,
    tags: ["storage", "security", "personal"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qbuild",
    code: "QBUILD",
    name: "QBuild — Construction Hiring Platform",
    description:
      "Платформа найма для строительной вертикали: проекты, вакансии, тестовые задания, AI-оценка резюме, лояльность и cashback в AEV.",
    kind: "product",
    status: "mvp",
    priority: 1,
    tags: ["hiring", "construction", "ai", "marketplace"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qchaingov",
    code: "QCHAINGOV",
    name: "QChainGov — DAO Governance",
    description:
      "DAO-платформа народного управления: голосования, инициативы, прозрачные процессы.",
    kind: "experiment",
    status: "idea",
    priority: 4,
    tags: ["dao", "governance"],
    createdAt: now,
    updatedAt: now,
  },
];
