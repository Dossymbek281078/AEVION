/**
 * Roadmap timing для 27 проектов AEVION.
 *
 * Источник: AEVION_27_PROJECTS_ROADMAP.md (фазы A-E, ориентиры Working v1).
 * Цифры дают +25–40% запас на параллельные задачи и интеграции.
 *
 * phase: A (уже есть/скелет) → E (эксперименты, низкий приоритет).
 * targetWindow: целевой квартал/год для Working v1.
 * progress: 0..100 — субъективная оценка готовности модуля.
 */

export type Phase = "A" | "B" | "C" | "D" | "E";

export interface RoadmapEntry {
  /** id из data/projects.ts */
  id: string;
  phase: Phase;
  /** Целевое окно "Working v1" (например "Q2 2026") */
  targetWindow: string;
  /** Числовое представление для сортировки: год*10 + квартал */
  targetSortKey: number;
  /** Субъективная готовность 0..100 */
  progress: number;
  /** Короткая нота: что осталось до Working v1 */
  remaining: string;
}

const SORT = (year: number, q: number) => year * 10 + q;

export const ROADMAP: RoadmapEntry[] = [
  /* ========= PHASE A — уже есть / скелет ========= */
  {
    id: "globus",
    phase: "A",
    targetWindow: "Q2 2026",
    targetSortKey: SORT(2026, 2),
    progress: 80,
    remaining: "Финализация 3D-полировки, реки/слои — позже",
  },
  {
    id: "qright",
    phase: "A",
    targetWindow: "Q2 2026",
    targetSortKey: SORT(2026, 2),
    progress: 85,
    remaining: "Политики экспорта, аудит-лог, certified-export",
  },
  {
    id: "qsign",
    phase: "A",
    targetWindow: "Q2 2026",
    targetSortKey: SORT(2026, 2),
    progress: 85,
    remaining: "Расширение: ключи, цепочки, не только HMAC",
  },
  {
    id: "aevion-ip-bureau",
    phase: "A",
    targetWindow: "Q2 2026",
    targetSortKey: SORT(2026, 2),
    progress: 70,
    remaining: "Слияние с QRight+QSign, Postgres для сертификатов",
  },
  {
    id: "cyberchess",
    phase: "A",
    targetWindow: "Q2 2026",
    targetSortKey: SORT(2026, 2),
    progress: 90,
    remaining: "Отдельный трек, в монорепо — только витрина",
  },

  /* ========= PHASE B — ядро экосистемы (апр–июнь 2026) ========= */
  {
    id: "qcoreai",
    phase: "B",
    targetWindow: "Q3 2026",
    targetSortKey: SORT(2026, 3),
    progress: 40,
    remaining: "Контракты API для агентов; пока stub + health",
  },
  {
    id: "multichat-engine",
    phase: "B",
    targetWindow: "Q3 2026",
    targetSortKey: SORT(2026, 3),
    progress: 30,
    remaining: "Зависит от QCoreAI/LLM ключей; v1 = один чат + история",
  },

  /* ========= PHASE C — финтех + второй продуктовый фронт (июль–сент) ========= */
  {
    id: "qtradeoffline",
    phase: "C",
    targetWindow: "Q3 2026",
    targetSortKey: SORT(2026, 3),
    progress: 35,
    remaining: "Persistence + модель сделок; офлайн-синк позже",
  },
  {
    id: "qpaynet-embedded",
    phase: "C",
    targetWindow: "Q4 2026",
    targetSortKey: SORT(2026, 4),
    progress: 15,
    remaining: "Юридически чувствительно; v1 = внутренние «кредиты»",
  },

  /* ========= PHASE D — масштаб продуктов (окт 2026 – март 2027) ========= */
  {
    id: "healthai",
    phase: "D",
    targetWindow: "Q4 2026",
    targetSortKey: SORT(2026, 4),
    progress: 10,
    remaining: "Медицинский дисклеймер; v1 = чеклист+лог, не диагноз",
  },
  {
    id: "kids-ai-content",
    phase: "D",
    targetWindow: "Q4 2026",
    targetSortKey: SORT(2026, 4),
    progress: 10,
    remaining: "Детский контент — модерация и локализация",
  },
  {
    id: "qfusionai",
    phase: "D",
    targetWindow: "Q1 2027",
    targetSortKey: SORT(2027, 1),
    progress: 5,
    remaining: "R&D; рабочая v1 после политики провайдеров",
  },
  {
    id: "qlife",
    phase: "D",
    targetWindow: "Q1 2027",
    targetSortKey: SORT(2027, 1),
    progress: 5,
    remaining: "После HealthAI или общего health-модуля",
  },
  {
    id: "qgood",
    phase: "D",
    targetWindow: "Q1 2027",
    targetSortKey: SORT(2027, 1),
    progress: 5,
    remaining: "Контент-модерация, этика; зависит от Multichat/AI",
  },
  {
    id: "startup-exchange",
    phase: "D",
    targetWindow: "Q1 2027",
    targetSortKey: SORT(2027, 1),
    progress: 8,
    remaining: "Сильная связка с QRight/IP Bureau",
  },

  /* ========= PHASE E — эксперименты (2027+) ========= */
  {
    id: "qmaskcard",
    phase: "E",
    targetWindow: "Q2 2027",
    targetSortKey: SORT(2027, 2),
    progress: 5,
    remaining: "Нужен банковский/PCI контур — после платёжного ядра",
  },
  {
    id: "psyapp-deps",
    phase: "E",
    targetWindow: "Q2 2027",
    targetSortKey: SORT(2027, 2),
    progress: 3,
    remaining: "Регуляторика/контент; не спешить без эксперта",
  },
  {
    id: "qpersona",
    phase: "E",
    targetWindow: "Q2 2027",
    targetSortKey: SORT(2027, 2),
    progress: 3,
    remaining: "Аватар = тяжёлый UX + медиа",
  },
  {
    id: "deepsan",
    phase: "E",
    targetWindow: "Q2 2027",
    targetSortKey: SORT(2027, 2),
    progress: 3,
    remaining: "Продуктивность — конкурентное поле, нужен UX-фокус",
  },
  {
    id: "qcontract",
    phase: "E",
    targetWindow: "Q3 2027",
    targetSortKey: SORT(2027, 3),
    progress: 5,
    remaining: "После зрелого QSign + хранилища",
  },
  {
    id: "lifebox",
    phase: "E",
    targetWindow: "Q3 2027",
    targetSortKey: SORT(2027, 3),
    progress: 2,
    remaining: "Крипто/наследие — юридически сложно",
  },
  {
    id: "veilnetx",
    phase: "E",
    targetWindow: "2027+",
    targetSortKey: SORT(2027, 4),
    progress: 2,
    remaining: "Крипто-слой с нуля",
  },
  {
    id: "voice-of-earth",
    phase: "E",
    targetWindow: "2027+",
    targetSortKey: SORT(2027, 4),
    progress: 2,
    remaining: "Контент-производство, не только код",
  },
  {
    id: "mapreality",
    phase: "E",
    targetWindow: "2027+",
    targetSortKey: SORT(2027, 4),
    progress: 2,
    remaining: "Данные/модерация/этика",
  },
  {
    id: "z-tide",
    phase: "E",
    targetWindow: "2027+",
    targetSortKey: SORT(2027, 4),
    progress: 1,
    remaining: "Концепт; код после спецификации",
  },
  {
    id: "shadownet",
    phase: "E",
    targetWindow: "2027+",
    targetSortKey: SORT(2027, 4),
    progress: 1,
    remaining: "Исследование",
  },
  {
    id: "qchaingov",
    phase: "E",
    targetWindow: "2027+",
    targetSortKey: SORT(2027, 4),
    progress: 1,
    remaining: "DAO — после VeilNetX или внешней сети",
  },
];

export const PHASE_META: Record<Phase, { label: string; period: string; description: string; color: string }> = {
  A: {
    label: "Phase A · Уже есть / скелет",
    period: "Текущий момент",
    description: "Globus, QRight, QSign, IP Bureau, Auth, динамические /[id], CyberChess.",
    color: "#0d9488",
  },
  B: {
    label: "Phase B · Ядро экосистемы",
    period: "Апрель – июнь 2026",
    description: "Довести IP-контур до предсказуемого MVP, QCoreAI / Multichat — заглушка или один демо-сценарий.",
    color: "#0ea5e9",
  },
  C: {
    label: "Phase C · Финтех + второй фронт",
    period: "Июль – сентябрь 2026",
    description: "QTradeOffline persistence, QPayNet модель счетов (симуляция/песочница).",
    color: "#7c3aed",
  },
  D: {
    label: "Phase D · Масштаб продуктов",
    period: "Окт 2026 – март 2027",
    description: "HealthAI, Kids AI, Startup Exchange, QGood — по 1 модулю ≈ 4–8 недель последовательно.",
    color: "#be185d",
  },
  E: {
    label: "Phase E · Эксперименты",
    period: "2027+",
    description: "VeilNetX, Z-Tide, ShadowNet, QChainGov, MapReality, Voice of Earth — исследования.",
    color: "#92400e",
  },
};
