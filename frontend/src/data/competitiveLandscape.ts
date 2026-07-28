/**
 * Competitive landscape — what AEVION modules are actually up against.
 *
 * The rule this file exists to enforce: a comparison that wins every row is a
 * comparison nobody believes. An investor who opens a competitor's pricing page
 * and finds we described it wrong stops reading the rest.
 *
 * So the schema is asymmetric on purpose:
 *
 *  - OUR side carries `measured` — how the number was obtained. If it did not
 *    come from a run, a dashboard or a checked-in harness, it does not go here.
 *  - THEIR side carries `source` — a URL. A competitor claim without one has to
 *    be marked `unverified`, and the UI shows that mark to the reader.
 *  - `verdict` may be "theirs". Rows where a competitor is simply better are
 *    the rows that make the rest credible.
 *  - `different-jobs` is used where the comparison is a category error, which
 *    is more often than a pitch deck likes to admit.
 *
 * Modules with no researched landscape are listed in PENDING rather than given
 * an invented one.
 */

export type CompetitorCell = {
  value: string;
  /** URL backing this claim. Required unless `unverified` is set. */
  source?: string;
  /** Set when the claim could not be checked against a primary source. */
  unverified?: true;
};

export type ComparisonRow = {
  /** What is being compared. */
  axis: string;
  /** Why a buyer should care — an axis nobody buys on is filler. */
  why: string;
  ours: {
    value: string;
    /** How we know. Empty means the claim is qualitative, not a number. */
    measured?: string;
  };
  /** Keyed by competitor id. */
  theirs: Record<string, CompetitorCell>;
  verdict: "ours" | "theirs" | "different-jobs";
};

export type Competitor = { id: string; name: string; url: string };

export type Landscape = {
  moduleId: string;
  module: string;
  category: string;
  /** The sentence that stops the table being a lie by omission. */
  framing: string;
  competitors: Competitor[];
  rows: ComparisonRow[];
  /** ISO date the competitor claims were checked. */
  researchedAt: string;
};

// ── QVenture ───────────────────────────────────────────────────────────────

const QVENTURE: Landscape = {
  moduleId: "qventure",
  module: "QVenture",
  category: "Оценка инвестиционных заявок",
  framing:
    "PitchBook и Harmonic — не конкуренты в той же категории. Они ищут компании: у PitchBook около 3 млн профилей, у Harmonic — 35 млн. У QVenture ноль. Мы решаем следующую задачу: прочитать конкретный план или отчётность и объяснить оценку по пунктам. Сравнивать нас по охвату базы бессмысленно, сравнивать по объяснимости оценки — осмысленно.",
  competitors: [
    { id: "pitchbook", name: "PitchBook", url: "https://pitchbook.com" },
    { id: "harmonic", name: "Harmonic.ai", url: "https://harmonic.ai" },
    { id: "specter", name: "Specter", url: "https://www.tryspecter.com" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "База компаний для поиска сделок",
      why: "Если задача — найти, кого смотреть, размер базы решает всё.",
      ours: { value: "Нет базы. Модуль не ищет компании." },
      theirs: {
        pitchbook: {
          value: "~3 млн компаний",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        harmonic: {
          value: "35 млн компаний, 195 млн людей",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        specter: {
          value: "Сигналы роста: трафик, найм, продукт",
          source: "https://www.vcbacked.co/blog/best-vc-deal-sourcing-platforms",
        },
      },
      verdict: "theirs",
    },
    {
      axis: "Как получается оценка",
      why: "Оценку, которую нельзя разобрать по пунктам, нельзя защитить перед инвесткомитетом.",
      ours: {
        value:
          "Детерминированная рубрика: 8 факторов с весами, каждый с пометкой «из плана» или «отраслевое среднее». Числа не приходят от языковой модели.",
        measured: "src/lib/qventure/engine.ts, версия рубрики v6; 1140 тестов",
      },
      theirs: {
        pitchbook: {
          value: "В 2025 добавлен ИИ-поиск на естественном языке; открытой рубрики оценки не публикует",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        harmonic: {
          value: "ИИ-агент Scout: поиск и скоринг роста; методика скора не опубликована",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        specter: { value: "Скоринг по сигналам роста", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Чтение поданной отчётности",
      why: "Инвестор чаще получает документ, чем строку в базе. Цифру из документа надо прочитать верно.",
      ours: {
        value:
          "100 цифр из 32 реальных подач в SEC (S-1, 20-F, 6-K) — прочитаны все. 31 валюта, включая рупии, тенге, лиры.",
        measured: "scripts/qventure-disclosed.ts, прогон 28.07.2026",
      },
      theirs: {
        pitchbook: { value: "Данные из подач вносятся в профиль компании; парсер произвольного документа не заявлен", unverified: true },
        harmonic: { value: "Не заявлен разбор загруженного документа", unverified: true },
        specter: { value: "Не заявлен разбор загруженного документа", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Что делает с недостающими данными",
      why: "Молчаливая подстановка отраслевого среднего вместо цифры плана — самый дорогой класс ошибок.",
      ours: {
        value:
          "Показывает долю оценки, подкреплённую цифрами плана (у пустого плана — 0%), и называет каждое допущение отдельной строкой.",
        measured: "поле signalCoverage; список assumptions на странице результата",
      },
      theirs: {
        pitchbook: { value: "Не проверено", unverified: true },
        harmonic: { value: "Не проверено", unverified: true },
        specter: { value: "Не проверено", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Цена входа",
      why: "Определяет, кому инструмент вообще доступен.",
      ours: { value: "Внутри платформы AEVION; отдельной подписки нет" },
      theirs: {
        pitchbook: {
          value: "от ~$20 000/год за одно место",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        harmonic: {
          value: "от ~$12 000/год, до $50 000",
          source: "https://harmonic.ai/blog/pitchbook-competitors-and-alternatives-a-guide-for-2026",
        },
        specter: { value: "Средний сегмент", source: "https://www.vcbacked.co/blog/best-vc-deal-sourcing-platforms" },
      },
      verdict: "different-jobs",
    },
    {
      axis: "Предсказание успеха",
      why: "Здесь принято обещать больше, чем кто-либо умеет.",
      ours: {
        value:
          "Не предсказываем. На корпусе с известными исходами разделение всего 6.6 балла, и 8 провалов из 15 набирают больше слабейшего успеха — это записано в документации как ограничение.",
        measured: "docs/benchmarks/qventure-rubric.md, раздел «The claim we are not willing to make»",
      },
      theirs: {
        pitchbook: { value: "Публичной метрики предсказательной силы не найдено", unverified: true },
        harmonic: { value: "Публичной метрики предсказательной силы не найдено", unverified: true },
        specter: { value: "Публичной метрики предсказательной силы не найдено", unverified: true },
      },
      verdict: "different-jobs",
    },
  ],
};

// ── DevHub ─────────────────────────────────────────────────────────────────

const DEVHUB: Landscape = {
  moduleId: "qbuild",
  module: "DevHub / QBuild",
  category: "ИИ-сборка приложений по описанию",
  framing:
    "Самая плотная категория из всех, где работает AEVION: у Lovable, Bolt и Replit годы работы и большие команды. По качеству вёрстки Lovable объективно сильнее. Наше отличие лежит не в генерации, а в том, что считается успешным деплоем.",
  competitors: [
    { id: "lovable", name: "Lovable", url: "https://lovable.dev" },
    { id: "bolt", name: "Bolt.new", url: "https://bolt.new" },
    { id: "replit", name: "Replit Agent", url: "https://replit.com" },
    { id: "v0", name: "v0", url: "https://v0.dev" },
  ],
  researchedAt: "2026-07-28",
  rows: [
    {
      axis: "Качество вёрстки из коробки",
      why: "Первое, что видит человек.",
      ours: { value: "Светлая газетная тема AEVION; отдельного замера против конкурентов нет" },
      theirs: {
        lovable: {
          value: "Признан лучшим: React + Tailwind, аккуратные отступы, адаптив",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        bolt: {
          value: "Зависит от детальности промта; без неё — функционально, но просто",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        replit: {
          value: "Упор на работоспособность, не на внешний вид",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        v0: { value: "Сильна в UI, полный стек новее конкурентов", source: "https://altar.io/lovable-vs-bolt-vs-v0-vs-replit-vs-base44/" },
      },
      verdict: "theirs",
    },
    {
      axis: "Что считается успешным деплоем",
      why: "Деплой, отмеченный «успешным», но отдающий 500, дороже упавшего: о нём никто не узнаёт.",
      ours: {
        value:
          "Ни один путь не помечает деплой живым, пока URL реально не отдал 2xx — 5 попыток по 5 секунд, иначе статус failed с причиной в логе сборки.",
        measured: "verifyDeploymentServes() в src/routes/devhub.ts; правило в CLAUDE.md проекта",
      },
      theirs: {
        lovable: { value: "Не проверено", unverified: true },
        bolt: { value: "Не проверено", unverified: true },
        replit: { value: "Не проверено", unverified: true },
        v0: { value: "Не проверено", unverified: true },
      },
      verdict: "ours",
    },
    {
      axis: "Настоящий бэкенд",
      why: "Без сервера, БД и фоновых задач получается витрина, а не продукт.",
      ours: { value: "Express + Prisma + PostgreSQL внутри платформы" },
      theirs: {
        replit: {
          value: "Python, Node, Go; PostgreSQL из коробки; cron, воркеры, WebSocket",
          source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent",
        },
        lovable: { value: "Аутентификация, БД, платежи по описанию", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        bolt: { value: "Быстрое демо", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        v0: { value: "Полный стек есть, но обкатан меньше", source: "https://altar.io/lovable-vs-bolt-vs-v0-vs-replit-vs-base44/" },
      },
      verdict: "theirs",
    },
    {
      axis: "Цена",
      why: "",
      ours: { value: "Внутри платформы AEVION" },
      theirs: {
        lovable: { value: "$20/мес", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        bolt: { value: "$20/мес, команда $50/мес фиксировано", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        replit: { value: "$25/мес с хостингом; Pro ~$100/мес", source: "https://www.goodvibecode.com/compare/bolt-vs-lovable-vs-replit-agent" },
        v0: { value: "Не проверено", unverified: true },
      },
      verdict: "theirs",
    },
  ],
};

export const LANDSCAPES: Landscape[] = [QVENTURE, DEVHUB];

/**
 * Modules with obvious analogues that have NOT been researched yet.
 *
 * Listed rather than compared. An empty row is honest; an invented one is not,
 * and this list is what stops the table quietly implying the rest were checked.
 */
export const PENDING: Array<{ module: string; category: string; analogues: string[] }> = [
  { module: "CyberChess", category: "Шахматная платформа", analogues: ["Chess.com", "Lichess", "Chessable"] },
  { module: "QReal Studio", category: "ИИ-видео", analogues: ["Higgsfield", "Runway", "Kling", "Pika"] },
  { module: "QSkyway", category: "Воздушное пространство дронов", analogues: ["AirMap", "Altitude Angel", "Aloft"] },
  { module: "Смета-тренажёр", category: "Сметное дело РК", analogues: ["АВС-4", "Смета РК", "Сана"] },
  { module: "QSign / IP Bureau", category: "Фиксация авторства", analogues: ["OriginStamp", "Bernstein", "OpenTimestamps"] },
  { module: "StartupX", category: "Биржа стартапов", analogues: ["AngelList", "Republic", "SeedInvest"] },
  { module: "QTrade", category: "Торговый симулятор", analogues: ["TradingView Paper", "Thinkorswim paperMoney"] },
  { module: "QCoreAI", category: "Мультиагентный совет", analogues: ["CrewAI", "AutoGen", "LangGraph"] },
];

/** Counts for the section header — derived, never typed in. */
export const LANDSCAPE_STATS = {
  researched: LANDSCAPES.length,
  pending: PENDING.length,
  rows: LANDSCAPES.reduce((n, l) => n + l.rows.length, 0),
  rowsWhereTheyWin: LANDSCAPES.reduce((n, l) => n + l.rows.filter((r) => r.verdict === "theirs").length, 0),
  sourcedClaims: LANDSCAPES.reduce(
    (n, l) => n + l.rows.reduce((m, r) => m + Object.values(r.theirs).filter((c) => c.source).length, 0),
    0,
  ),
  unverifiedClaims: LANDSCAPES.reduce(
    (n, l) => n + l.rows.reduce((m, r) => m + Object.values(r.theirs).filter((c) => c.unverified).length, 0),
    0,
  ),
};
