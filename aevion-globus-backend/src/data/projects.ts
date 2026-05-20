import { GlobusProject } from "../types/globus";

const now = new Date().toISOString();

export const projects: GlobusProject[] = [
  // ===== CORE / PLATFORM =====
  {
    id: "revenue-hub",
    code: "REVENUE",
    name: "Revenue Hub — Monetization Central",
    description:
      "Centralized monetization: Stripe balance/payments, YouTube AdSense, Twitch affiliate — 12 AEVION apps tracked. Real Stripe connected (test mode). 15/15 prod smoke ✅.",
    kind: "service",
    status: "live",
    priority: 1,
    tags: ["revenue", "stripe", "monetization"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "globus",
    code: "GLOBUS",
    name: "AEVION Globus",
    description:
      "Центральная карта и портал экосистемы AEVION: реестр 29 проектов, 3D-карта, маркеры по странам, статусы, интеграции.",
    kind: "core",
    status: "live",
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
      "Postgres-персистентный мульти-агент AI-движок: 5 LLM-провайдеров, сессии/ран/сообщения в БД, webhooks, eval harness, notebooks, A/B тесты, ветвление ранов.",
    kind: "core",
    status: "live",
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
    status: "live",
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
      "Интеллектуальный маршрутизатор AI-запросов: стратегии speed/quality/cost/auto, live providers dashboard, fusion playground + concept board. MVP 2026-05-15 — /api/qfusionai.",
    kind: "experiment",
    status: "live",
    priority: 2,
    tags: ["ai", "fusion", "engine", "router"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== IP / LEGAL (FIRST WAVE) =====
  {
    id: "qright",
    code: "QRIGHT",
    name: "QRight — Legal & IP Protection System",
    description:
      "Postgres-реестр объектов IP: SHA-256 + HMAC, geo-fill, prior-art search, royalty webhooks, badge/object порталы, policies, changelog RSS, CSV export, transparency.",
    kind: "core",
    status: "live",
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
      "Ed25519 + HMAC-SHA256 sign/verify, key rotation, webhooks, PDF certs, batch signing, audit trail, OpenAPI 3.1.",
    kind: "core",
    status: "live",
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
      "Ed25519 + Shamir SSS, PDF-сертификаты, badge/verify-портал, 6 правовых рамок (Berne/WIPO/TRIPS/eIDAS/ESIGN/KZ), org management, KYC flow, trust-edges.",
    kind: "service",
    status: "live",
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
    status: "live",
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
    status: "live",
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
      "Віртуальні карти-маски: ліміти (день/місяць), авторизація зарядів, anti-fraud decline, 14 активних масок у проді, 14/14 prod smoke ✅.",
    kind: "product",
    status: "live",
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
      "Privacy proxy network MVP 2026-05-15 — pre-launch status surface, waitlist with email-hash dedupe, principles + threat model, in-memory concept board. /api/veilnetx.",
    kind: "experiment",
    status: "live",
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
      "Postgres-персистентний AI-лікар: профілі, симптом-чек, денний лог (сон/настрій/вага/вода), цикл-трекер, AI план, тренди, рефераліти, популяційні аверейджи, 15/15 prod smoke ✅.",
    kind: "product",
    status: "live",
    priority: 2,
    tags: ["health", "ai", "coach"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qlife",
    code: "QLIFE",
    name: "QLife — Personal OS",
    description:
      "Personal Operating System: 6-pillar live dashboard (Finance/Health/Communication/AI/Data/Identity) polling real AEVION health endpoints, cross-module AI insights, community life-prompts concept board. Launched 2026-05-18 — browser-smoke verified https://aevion.app/qlife. /api/qlife.",
    kind: "product",
    status: "live",
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
      "Психо-MVP 2026-05-15 — mood log (1-10 + emotion), AI therapist chat, 5 exercises (breathing/grounding/gratitude/body-scan/reframe), 7-day trend + concept board. /api/qgood.",
    kind: "product",
    status: "live",
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
      "Выход из зависимостей MVP 2026-05-15 — streak tracker (alcohol/smoking), trigger log с intensity 1-10, AI support via QCoreAI, 10 RU affirmations + concept board. /api/psyapp-deps.",
    kind: "product",
    status: "live",
    priority: 3,
    tags: ["addiction", "recovery", "psychology", "ai"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== AVATAR / PERSONA =====
  {
    id: "qpersona",
    code: "QPERSONA",
    name: "QPersona — Digital Avatar",
    description:
      "AI doppelganger: style analyzer (LLM extracts rhythm/emoji/tone from 3+ messages) + reply generator (answers in your voice). Concept board shared. Launched 2026-05-18 — browser-smoke verified on https://aevion.app/qpersona. /api/qpersona + /api/qcoreai/chat.",
    kind: "product",
    status: "live",
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
      "Детский обучающий контент: каталог уроков RU/EN/KZ, AI-помощник через QCoreAI, трекинг прогресса по псевдониму + concept board. MVP 2026-05-15 — 10 seed уроков, /api/kids-ai.",
    kind: "product",
    status: "live",
    priority: 3,
    tags: ["kids", "education", "multilang", "ai"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "voice-of-earth",
    code: "VOE",
    name: "Voice of the Earth Series",
    description:
      "Международный музыкальный проект: каталог треков с многоязычными текстами, подача от авторов, голосование (UNIQUE per voter) + concept board. MVP 2026-05-15 — 8 seed треков (RU/EN/KZ/ES), /api/voice-of-earth.",
    kind: "experiment",
    status: "live",
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
      "Биржа стартапов: submit идеи → авто-защита через QRight-style SHA-256 → лента → interest от инвесторов + concept board. Privacy by default. MVP 2026-05-15 — /api/startupx.",
    kind: "product",
    status: "live",
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
      "Антихаос productivity: AI Inbox Parser (LLM достаёт next-action из дампов email/Slack/notes с приоритетом+owner+deadline), Focus Session pomodoro 25min, Bridge to QCoreAI agents, persistent concept board. Launched 2026-05-18 — browser-smoke verified on https://aevion.app/deepsan. /api/deepsan + /api/qcoreai/chat.",
    kind: "product",
    status: "live",
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
      "Карта реальных потребностей: сигналы (need/event/request) с гео-привязкой, +1 поддержка с dedupe, агрегация по категориям/регионам + concept board. MVP 2026-05-15 — /api/mapreality.",
    kind: "experiment",
    status: "live",
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
      "Adaptive social-economic coordination MVP 2026-05-15 — contribution events (10 kinds × 12 source modules), decayed tide score, 7-rank ladder (Seedling→Ocean), leaderboard, in-memory concept board. /api/ztide.",
    kind: "experiment",
    status: "live",
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
      "Смарт-документи: 5 шаблонів (NDA/договір/дозвіл/конфіденційність/ТЗ), auth-gated CRUD, view-token, audit log CSV, OpenAPI — 17/17 prod smoke ✅.",
    kind: "product",
    status: "live",
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
      "Privacy concept simulator MVP 2026-05-15 — 4 threat models, routing simulator (3-7 hops + Mulberry32), privacy score, E2E encrypted posts (WebCrypto AES-GCM + PBKDF2 250k) + concept board. /api/shadownet.",
    kind: "experiment",
    status: "live",
    priority: 4,
    tags: ["network", "privacy", "crypto"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "lifebox",
    code: "LIFEBOX",
    name: "LifeBox — Digital Safe for Future Self",
    description:
      "Time-locked капсулы MVP 2026-05-15 — содержимое скрыто до unlock_at, 5 категорий (knowledge/values/instructions/future_self/advice), countdown, alias gate + concept board. /api/lifebox.",
    kind: "product",
    status: "live",
    priority: 4,
    tags: ["storage", "security", "personal", "time-locked"],
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
    status: "live",
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
      "DAO governance: proposals + 3 vote modes (yes-no, ranked, weighted), tally execution with quorum, auth-gated voting, stats — 15/15 prod smoke ✅.",
    kind: "experiment",
    status: "live",
    priority: 4,
    tags: ["dao", "governance"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== EDUCATION / TRAINING =====
  {
    id: "smeta-trainer",
    code: "SMETA",
    name: "Smeta Trainer — AI Сметный тренажёр РК",
    description:
      "Учебная платформа по сметному делу Казахстана: 5 уровней, 222 расценки ЭСН РК, AI-советник, сквозной кейс школа №47.",
    kind: "product",
    status: "mvp",
    priority: 2,
    tags: ["education", "construction", "ai", "kazakhstan"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qnews",
    code: "QNEWS",
    name: "QNews — Отраслевой агрегатор новостей",
    description:
      "Агрегатор отраслевых новостей для экосистемы AEVION: строительство, крипто, IP-право, AI, финтех. Пользователи публикуют и читают релевантный контент. AI генерирует дайджест дня и суммаризует статьи + concept board. MVP 2026-05-15 — /api/qnews.",
    kind: "product",
    status: "live",
    priority: 3,
    tags: ["news", "aggregator", "ai", "media", "content"],
    createdAt: now,
    updatedAt: now,
  },

  // ===== CONTENT / AI / COMMERCE (WAVE 2026-05-12) =====
  {
    id: "qmedia",
    code: "QMEDIA",
    name: "QMedia — Music, Video & Creative AI",
    description:
      "Медиа-платформа: стриминг музыки и видео, AI-creative (тексты, обложки, цветовые палитры). Waveform-визуализация, плеер с мини-эквалайзером, песочница для авторов.",
    kind: "product",
    status: "live",
    priority: 2,
    tags: ["media", "music", "video", "ai", "creative"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qai",
    code: "QAI",
    name: "QAI — Real-time Streaming AI",
    description:
      "Real-time streaming AI с переключаемыми persona и chunk-based UI. Альтернативный фронт к QCoreAI с фокусом на потоковую генерацию word-by-word и быстрый UX.",
    kind: "product",
    status: "live",
    priority: 2,
    tags: ["ai", "streaming", "chat", "persona"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qlearn",
    code: "QLEARN",
    name: "QLearn — Learning Platform",
    description:
      "Платформа обучения AEVION: курсы, уроки, AI-тренер, прогресс студента. Postgres-first: курсы, модули, ответы, аттестация. Связан со Smeta Trainer как канал доставки контента.",
    kind: "product",
    status: "live",
    priority: 2,
    tags: ["education", "ai", "courses", "learning"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qstore",
    code: "QSTORE",
    name: "QStore — Ecosystem Marketplace",
    description:
      "Магазин экосистемы AEVION: товары, цифровые продукты, услуги. Postgres-каталог, корзина, заказы; интеграция с QPayNet для оплат и QRight для защиты авторских позиций.",
    kind: "product",
    status: "live",
    priority: 2,
    tags: ["commerce", "marketplace", "store", "fintech"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qevents",
    code: "QEVENTS",
    name: "QEvents — Events & Conferences",
    description:
      "Платформа событий и конференций: создание мероприятий, регистрация, расписание, рассылки. Postgres-storage; интеграция с QSign для билетов и QPayNet для платежей.",
    kind: "product",
    status: "live",
    priority: 3,
    tags: ["events", "conferences", "scheduling"],
    createdAt: now,
    updatedAt: now,
  },
];
