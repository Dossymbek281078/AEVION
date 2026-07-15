import { Router, Request, Response } from "express";
import crypto from "crypto";
import { callProvider, getProviders } from "../services/qcoreai/providers";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { makeServiceCapture } from "../lib/sentry/platform";

/**
 * AEVION Longevity — the measure → act → re-measure protocol engine.
 *
 * One 12-week cycle. A standard lab + functional panel reveals what is deficient
 * and how fast the body ages; a personalized, evidence-graded intervention stack
 * across four levers (nutrition, movement, hormesis, mental) is generated; then
 * the same markers are re-measured and the delta is scored.
 *
 * Deterministic engine, hybrid persistence: signed-in users get every /assess
 * call saved as a LongevityMeasurement row (Postgres if DATABASE_URL is set,
 * else in-memory for the life of the process — same hybrid-store pattern as
 * healthai.ts) so /progress can auto-fill baseline/latest from history instead
 * of requiring manual re-entry. Anonymous requests stay fully stateless.
 * Honest evidence grading is the point:
 *   A — сильные доказательства (RCT / крупные когорты)
 *   B — умеренные / смешанные
 *   C — слабые / предварительные
 *   E — экспериментально, влияние на долголетие не доказано
 * Doses and prescription drugs are never issued — the engine sequences lifestyle
 * only; anything grade E or prescription is info-only.
 *
 * Endpoints:
 *   GET  /health     — status
 *   GET  /panel      — standard lab + functional panel (grouped, graded)
 *   POST /assess     — values + flags → flagged markers + personalized 12-week stack
 *                      (saved to history when signed in)
 *   GET  /history    — signed-in user's past assessments, oldest first
 *   POST /ai-plan    — recommended stack → concrete weekly schedule (qcoreai, no doses)
 *   POST /progress   — baseline vs latest key metrics → direction-aware delta + score
 *                      (auto-fills baseline/latest from history when signed in)
 */

export const longevityRouter = Router();

const captureLongevityError = makeServiceCapture("longevity");

const DISCLAIMER =
  "Wellness/образование, не диагностика и не лечение. Целевые коридоры — ориентиры (зависят от пола, возраста, лаборатории). Рецептурные препараты и часть анализов — только через врача. Не отменяйте назначенное лечение.";

// ── Types ─────────────────────────────────────────────────────────────────────

type Grade = "A" | "B" | "C" | "E";
type Dir = "higher" | "lower" | "range";
type Domain = "nutrition" | "movement" | "hormesis" | "mental";

interface Marker {
  key: string;
  name: string;
  group: string;
  shows: string;
  target: string;
  grade: Grade;
  dir?: Dir;
  low?: number;
  high?: number;
  unit?: string;
}

interface Intervention {
  id: string;
  name: string;
  domain: Domain;
  grade: Grade;
  action: "recommend" | "inform";
  note: string;
  targets?: string[];
  gate?: string[]; // flags that contraindicate this item
}

// ── Standard panel (Step 1) ────────────────────────────────────────────────────

const PANEL: Marker[] = [
  // Дефициты и микронутриенты
  { key: "vitD", name: "Витамин D (25-OH)", group: "Дефициты", shows: "Иммунитет, кости, настроение", target: "40–60 нг/мл", grade: "A", dir: "higher", low: 40, unit: "нг/мл" },
  { key: "b12", name: "Витамин B12", group: "Дефициты", shows: "Нервы, кроветворение, энергия", target: ">500 пг/мл", grade: "A", dir: "higher", low: 500, unit: "пг/мл" },
  { key: "ferritin", name: "Ферритин", group: "Дефициты", shows: "Запас железа, энергия", target: "50–150 нг/мл", grade: "A", dir: "range", low: 50, high: 200, unit: "нг/мл" },
  { key: "magnesium", name: "Магний (RBC)", group: "Дефициты", shows: ">300 ферментов, сон, мышцы", target: "верхняя треть нормы", grade: "B" },
  { key: "znCuRatio", name: "Цинк / Медь (Zn:Cu)", group: "Дефициты", shows: "Иммунитет, пигмент, антиоксидация", target: "8–12 : 1", grade: "B", dir: "range", low: 8, high: 12 },
  { key: "omega3Index", name: "Омега-3 индекс", group: "Дефициты", shows: "Мембраны, воспаление, мозг", target: ">8 %", grade: "A", dir: "higher", low: 8, unit: "%" },
  { key: "homocysteine", name: "Гомоцистеин", group: "Дефициты", shows: "Сосуды, метилирование", target: "<8 мкмоль/л", grade: "B", dir: "lower", high: 8, unit: "мкмоль/л" },
  // Метаболизм и воспаление
  { key: "glucose", name: "Глюкоза натощак", group: "Метаболизм", shows: "Сахар крови сейчас", target: "<5.5 ммоль/л", grade: "A", dir: "lower", high: 5.5, unit: "ммоль/л" },
  { key: "hba1c", name: "HbA1c", group: "Метаболизм", shows: "Средний сахар за 3 мес", target: "<5.4 %", grade: "A", dir: "lower", high: 5.4, unit: "%" },
  { key: "homaIR", name: "HOMA-IR", group: "Метаболизм", shows: "Инсулинорезистентность", target: "<1.5", grade: "A", dir: "lower", high: 1.5 },
  { key: "apoB", name: "ApoB", group: "Метаболизм", shows: "Атерогенные частицы (точнее ЛПНП)", target: "<0.8 г/л", grade: "A", dir: "lower", high: 0.8, unit: "г/л" },
  { key: "hsCRP", name: "hs-CRP", group: "Метаболизм", shows: "Системное воспаление", target: "<1.0 мг/л", grade: "A", dir: "lower", high: 1.0, unit: "мг/л" },
  { key: "uricAcid", name: "Мочевая кислота", group: "Метаболизм", shows: "Метаболизм, воспаление, давление", target: "<5.5 мг/дл", grade: "B", dir: "lower", high: 5.5, unit: "мг/дл" },
  // Гормоны и органы
  { key: "tsh", name: "ТТГ", group: "Гормоны/органы", shows: "Щитовидка = скорость метаболизма", target: "1–2 мкМЕ/мл", grade: "B", dir: "range", low: 0.5, high: 2.5, unit: "мкМЕ/мл" },
  { key: "testosterone", name: "Тестостерон / эстрадиол / ДГЭА-С", group: "Гормоны/органы", shows: "Мышцы, либидо, настроение, резерв", target: "по полу/возрасту", grade: "B" },
  { key: "alt", name: "АЛТ / АСТ / ГГТ", group: "Гормоны/органы", shows: "Печень, детоксикация", target: "нижняя-средняя норма", grade: "B" },
  { key: "egfr", name: "рСКФ + Цистатин C", group: "Гормоны/органы", shows: "Почки", target: ">90", grade: "B", dir: "higher", low: 90 },
  // Биомаркеры старения
  { key: "phenoAge", name: "PhenoAge (биовозраст)", group: "Старение", shows: "Биовозраст по 9 маркерам крови — считается в QRenew", target: "младше паспорта", grade: "B", dir: "lower" },
  { key: "dnamAge", name: "Эпигенетические часы (DNAm)", group: "Старение", shows: "Скорость старения — информативно, но дорого", target: "младше паспорта", grade: "B" },
  { key: "telomere", name: "Длина теломер (LTL)", group: "Старение", shows: "⚠ Шумный тест, плохо воспроизводится, не даёт руководства к действию — не в первую очередь", target: "не приоритет", grade: "C" },
  { key: "mito", name: "Работа митохондрий", group: "Старение", shows: "Дешёвого валидированного теста нет; прокси — VO₂max и лактат", target: "функц. прокси", grade: "C" },
  // Функциональные замеры (сильнейшие предикторы)
  { key: "vo2max", name: "VO₂max", group: "Функциональные", shows: "Аэробная мощность — сильнейший предиктор смертности", target: "↑ выше среднего для возраста", grade: "A", dir: "higher" },
  { key: "grip", name: "Сила хвата", group: "Функциональные", shows: "Системная сила и крепость", target: "↑ выше", grade: "A", dir: "higher" },
  { key: "gaitSpeed", name: "Скорость ходьбы / вставание со стула", group: "Функциональные", shows: "Функциональный возраст, риск падений", target: "↑ выше", grade: "A", dir: "higher" },
  { key: "waist", name: "Талия / висцеральный жир (DEXA)", group: "Функциональные", shows: "Метаболический риск, мышцы, кости", target: "↓ ниже", grade: "A", dir: "lower" },
  { key: "hrv", name: "ВСР (HRV), АД, пульс покоя", group: "Функциональные", shows: "Восстановление, автономный тонус, сосуды", target: "ВСР ↑ / АД в норме", grade: "B", dir: "higher" },
];

const PANEL_BY_KEY: Record<string, Marker> = Object.fromEntries(PANEL.map((m) => [m.key, m]));

// ── Intervention stack (Step 2) ────────────────────────────────────────────────

const STACK: Intervention[] = [
  // Питание
  { id: "fix-deficiencies", name: "Закрыть дефициты (D, B12, омега-3, магний, железо)", domain: "nutrition", grade: "A", action: "recommend", note: "Первый приоритет — по твоим цифрам. Быстрый и доказанный эффект.", targets: ["vitD", "b12", "omega3Index", "magnesium", "ferritin"] },
  { id: "protein-fiber", name: "Белок 1.6–2.2 г/кг + клетчатка 30–40 г", domain: "nutrition", grade: "A", action: "recommend", note: "Мышцы, сытость, микробиом." },
  { id: "creatine", name: "Креатин 3–5 г/день", domain: "nutrition", grade: "A", action: "recommend", note: "Мышцы, мозг, энергия." },
  { id: "glynac", name: "GlyNAC (глицин + NAC)", domain: "nutrition", grade: "B", action: "recommend", note: "Есть RCT-сигналы по маркерам старения.", targets: ["hsCRP"] },
  { id: "taurine", name: "Таурин", domain: "nutrition", grade: "E", action: "inform", note: "Сильные животные данные, у людей ещё изучается." },
  { id: "nad-boosters", name: "NMN / NR (бустеры NAD⁺)", domain: "nutrition", grade: "E", action: "inform", note: "Поднимают NAD⁺, но пользы для healthspan у людей мало — не переоценивать." },
  { id: "rx-geroprotectors", name: "Метформин / рапамицин", domain: "nutrition", grade: "E", action: "inform", note: "Только рецепт и врач, не DIY. Идут исследования (TAME)." },
  // Движение
  { id: "resistance", name: "Силовые 2–3×/нед", domain: "movement", grade: "A", action: "recommend", note: "Мышцы и кости против саркопении.", targets: ["grip", "waist", "homaIR"] },
  { id: "zone2", name: "Zone 2 (лёгкое кардио) 150–180 мин/нед", domain: "movement", grade: "A", action: "recommend", note: "Митохондрии, метаболизм.", targets: ["homaIR", "vo2max", "hsCRP"] },
  { id: "vo2-intervals", name: "Интервалы VO₂max (4×4) 1×/нед", domain: "movement", grade: "A", action: "recommend", note: "Растит аэробный потолок.", targets: ["vo2max"] },
  { id: "steps", name: "8–10 тыс. шагов/день", domain: "movement", grade: "A", action: "recommend", note: "Базовая активность, глюкоза.", targets: ["glucose", "waist"] },
  // Гормезис
  { id: "sauna", name: "Сауна 4×/нед по 15–20 мин", domain: "hormesis", grade: "B", action: "recommend", note: "Финская когорта: ↓ сердечно-сосудистая смертность.", gate: ["pregnant", "hypertension"] },
  { id: "cold", name: "Холод (душ / погружение)", domain: "hormesis", grade: "C", action: "recommend", note: "Настроение, бурый жир, метаболизм; данные по долголетию скромные.", gate: ["pregnant", "heartCondition"] },
  { id: "tre", name: "Пост / окно питания 12–16 ч", domain: "hormesis", grade: "B", action: "recommend", note: "Метаболизм; по долголетию у людей смешанно.", targets: ["homaIR", "glucose"], gate: ["diabetes", "pregnant", "underweight"] },
  // Ментальное
  { id: "sleep", name: "Сон 7–9 ч, регулярный ритм", domain: "mental", grade: "A", action: "recommend", note: "Фундамент всего остального.", targets: ["hsCRP", "homaIR"] },
  { id: "social", name: "Социальные связи, борьба с одиночеством", domain: "mental", grade: "A", action: "recommend", note: "Один из сильнейших психосоциальных предикторов срока жизни." },
  { id: "purpose", name: "Смысл / цель, управление стрессом, медитация", domain: "mental", grade: "B", action: "recommend", note: "Снижают воспаление и риск.", targets: ["hsCRP"] },
  { id: "affirmations", name: "Аффирмации (self-affirmation)", domain: "mental", grade: "C", action: "recommend", note: "В RCT буферят стресс; напрямую про долголетие — нет." },
  { id: "wave-gadgets", name: "«Волновые» методы, PEMF, бинауральные, домашний PBM", domain: "mental", grade: "E", action: "inform", note: "Предварительно; влияния на срок жизни нет. Медицинские TTFields/HIFU/BNCT — это лечение рака в больнице, НЕ longevity-процедуры и не то же самое." },
];

const DOMAIN_LABEL: Record<Domain, string> = {
  nutrition: "💊 Питание и добавки",
  movement: "🏋️ Физическая нагрузка",
  hormesis: "❄️ Гормезис",
  mental: "🧠 Ментальное",
};

// ── Progress metrics (Step 3) ──────────────────────────────────────────────────

const PROGRESS_METRICS: { key: string; name: string; dir: "higher" | "lower" }[] = [
  { key: "hsCRP", name: "hs-CRP (воспаление)", dir: "lower" },
  { key: "homaIR", name: "HOMA-IR (инсулинорезистентность)", dir: "lower" },
  { key: "vitD", name: "Витамин D", dir: "higher" },
  { key: "omega3Index", name: "Омега-3 индекс", dir: "higher" },
  { key: "vo2max", name: "VO₂max", dir: "higher" },
  { key: "waist", name: "Талия / висцеральный жир", dir: "lower" },
  { key: "phenoAge", name: "PhenoAge (биовозраст)", dir: "lower" },
];

const CYCLE = {
  weeks: 12,
  phases: [
    { week: "0", title: "Точка отсчёта", detail: "Полная панель крови + функциональные тесты + биовозраст (PhenoAge). Фиксируем всё до вмешательств." },
    { week: "1–2", title: "Фундамент", detail: "Закрываем дефициты, налаживаем сон и шаги, стартуем тренировки мягко." },
    { week: "3–8", title: "Полный стек", detail: "Прогрессия силовых и кардио, добавки по плану, окно питания." },
    { week: "9–11", title: "Пик", detail: "Добавляем гормезис (сауна/холод), выводим объёмы на максимум, следим за ВСР." },
    { week: "12", title: "Перемер и дельта", detail: "Те же анализы и тесты. Считаем прогресс-скор, оставляем только рабочее." },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function markerFlagged(m: Marker, v: number): boolean {
  if (m.dir === "higher") return m.low !== undefined && v < m.low;
  if (m.dir === "lower") return m.high !== undefined && v > m.high;
  if (m.dir === "range") return (m.low !== undefined && v < m.low) || (m.high !== undefined && v > m.high);
  return false;
}

// ── History persistence (Step 1 → Step 3 bridge) ───────────────────────────────
// Hybrid store: Postgres if DATABASE_URL is set, else per-process in-memory.
// Only ever keyed by the authenticated user's sub — anonymous /assess calls are
// never persisted, matching the module's original stateless behaviour for them.

interface Measurement {
  id: string;
  userId: string;
  values: Record<string, number>;
  flags: Record<string, boolean>;
  flaggedMarkers: { key: string; name: string; value: number; target: string; grade: Grade }[];
  createdAt: string;
}

const measurementsMem = new Map<string, Measurement[]>(); // userId -> asc by createdAt

let useDb = false;
let dbInitTried = false;

async function ensureDb() {
  if (dbInitTried) return;
  dbInitTried = true;
  if (!process.env.DATABASE_URL) {
    console.log("[Longevity] DATABASE_URL absent — in-memory history");
    return;
  }
  try {
    const pool = getPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS "LongevityMeasurement" (
      "id"             TEXT PRIMARY KEY,
      "userId"         TEXT NOT NULL,
      "values"         JSONB NOT NULL DEFAULT '{}',
      "flags"          JSONB NOT NULL DEFAULT '{}',
      "flaggedMarkers" JSONB NOT NULL DEFAULT '[]',
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "LongevityMeasurement_userId_createdAt_idx" ON "LongevityMeasurement" ("userId", "createdAt")`);
    await pool.query(`SELECT 1 FROM "LongevityMeasurement" LIMIT 1`);
    useDb = true;
    console.log("[Longevity] Postgres persistence enabled");
  } catch (e) {
    captureLongevityError(e, { route: "db-init" });
    console.warn("[Longevity] DB init failed, fallback in-memory:", e instanceof Error ? e.message : e);
  }
}
void ensureDb();

function rowToMeasurement(r: any): Measurement {
  return {
    id: r.id,
    userId: r.userId,
    values: r.values || {},
    flags: r.flags || {},
    flaggedMarkers: r.flaggedMarkers || [],
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

const measurementStore = {
  async save(m: Measurement): Promise<void> {
    await ensureDb();
    if (useDb) {
      await getPool().query(
        `INSERT INTO "LongevityMeasurement" ("id","userId","values","flags","flaggedMarkers","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [m.id, m.userId, JSON.stringify(m.values), JSON.stringify(m.flags), JSON.stringify(m.flaggedMarkers), m.createdAt],
      );
      return;
    }
    const list = measurementsMem.get(m.userId) || [];
    list.push(m);
    measurementsMem.set(m.userId, list);
  },
  /** Ascending by createdAt — [0] is the earliest (baseline), last is the latest. */
  async listForUser(userId: string): Promise<Measurement[]> {
    await ensureDb();
    if (useDb) {
      const r = await getPool().query(`SELECT * FROM "LongevityMeasurement" WHERE "userId"=$1 ORDER BY "createdAt" ASC`, [userId]);
      return r.rows.map(rowToMeasurement);
    }
    return measurementsMem.get(userId) || [];
  },
};

// ── Endpoints ───────────────────────────────────────────────────────────────────

longevityRouter.get("/health", async (_req: Request, res: Response) => {
  await ensureDb();
  res.json({
    status: "ok",
    service: "AEVION Longevity",
    persistence: useDb ? "postgres" : "in-memory (signed-in only)",
    panelMarkers: PANEL.length,
    interventions: STACK.length,
    cycleWeeks: CYCLE.weeks,
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * GET /panel — standard lab + functional panel grouped, with evidence grades.
 */
longevityRouter.get("/panel", (_req: Request, res: Response) => {
  const groups: Record<string, Marker[]> = {};
  for (const m of PANEL) (groups[m.group] ||= []).push(m);
  res.json({
    groups,
    gradeLegend: {
      A: "сильные доказательства (RCT / крупные когорты)",
      B: "умеренные / смешанные",
      C: "слабые / предварительные",
      E: "экспериментально, долголетие не доказано",
    },
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /assess
 * body: { values?: {<markerKey>: number}, flags?: {diabetes,pregnant,underweight,hypertension,heartCondition} }
 * → flagged (out-of-range) markers + personalized, contraindication-gated 12-week stack.
 */
longevityRouter.post("/assess", async (req: Request, res: Response) => {
  const b = req.body || {};
  const values = (b.values || {}) as Record<string, unknown>;
  const flags = (b.flags || {}) as Record<string, unknown>;
  const activeFlags = Object.keys(flags).filter((k) => Boolean(flags[k]));

  // 1. Flag markers that are out of their optimal corridor.
  const flagged: { key: string; name: string; value: number; target: string; grade: Grade }[] = [];
  for (const m of PANEL) {
    const v = num(values[m.key]);
    if (v === null) continue;
    if (markerFlagged(m, v)) flagged.push({ key: m.key, name: m.name, value: v, target: m.target, grade: m.grade });
  }
  const flaggedKeys = new Set(flagged.map((f) => f.key));

  // 2. Build the recommended stack: all core "recommend" items, gating contraindications.
  const recommend: (Intervention & { targeted: boolean })[] = [];
  const gatedOut: { name: string; reason: string }[] = [];
  for (const it of STACK) {
    if (it.action !== "recommend") continue;
    const blocked = (it.gate || []).filter((g) => activeFlags.includes(g));
    if (blocked.length) {
      gatedOut.push({ name: it.name, reason: `Противопоказано при: ${blocked.join(", ")}. Обсудите с врачом.` });
      continue;
    }
    const targeted = (it.targets || []).some((t) => flaggedKeys.has(t));
    recommend.push({ ...it, targeted });
  }
  // Prioritise: targeted first, then by grade A→C.
  const gradeRank: Record<Grade, number> = { A: 0, B: 1, C: 2, E: 3 };
  recommend.sort((a, b2) => (Number(b2.targeted) - Number(a.targeted)) || gradeRank[a.grade] - gradeRank[b2.grade]);

  const informOnly = STACK.filter((it) => it.action === "inform").map((it) => ({
    name: it.name,
    grade: it.grade,
    note: it.note,
  }));

  // Save to history for signed-in users only — anonymous /assess stays stateless.
  const auth = verifyBearerOptional(req);
  let saved = false;
  let measurementId: string | null = null;
  if (auth?.sub && Object.keys(values).some((k) => num(values[k]) !== null)) {
    try {
      measurementId = crypto.randomUUID();
      const numericValues: Record<string, number> = {};
      for (const [k, v] of Object.entries(values)) {
        const n = num(v);
        if (n !== null) numericValues[k] = n;
      }
      await measurementStore.save({
        id: measurementId,
        userId: auth.sub,
        values: numericValues,
        flags: Object.fromEntries(activeFlags.map((f) => [f, true])),
        flaggedMarkers: flagged,
        createdAt: nowIso(),
      });
      saved = true;
    } catch (e) {
      captureLongevityError(e, { route: "assess-save", actorUserId: auth.sub });
      measurementId = null;
    }
  }

  res.json({
    flaggedMarkers: flagged,
    flaggedCount: flagged.length,
    recommendedStack: recommend.map((it) => ({
      id: it.id,
      name: it.name,
      domain: it.domain,
      domainLabel: DOMAIN_LABEL[it.domain],
      grade: it.grade,
      targeted: it.targeted,
      note: it.note,
    })),
    contraindicationGated: gatedOut,
    informOnly,
    cycle: CYCLE,
    priorityRule: "Сначала бесплатное и доказанное (сон, движение, коррекция дефицитов, связи), потом экзотика.",
    guardrail: "Движок компонует только образ жизни; дозы и рецептурные препараты не назначаем.",
    saved,
    measurementId,
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * GET /history — signed-in user's past assessments, oldest first (so [0] is
 * the natural baseline). 401 if not signed in — anonymous users have no history.
 */
longevityRouter.get("/history", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth?.sub) return res.status(401).json({ error: "auth-required" });
  const list = await measurementStore.listForUser(auth.sub);
  res.json({
    measurements: list.map((m) => ({
      id: m.id,
      values: m.values,
      flags: m.flags,
      flaggedCount: m.flaggedMarkers.length,
      createdAt: m.createdAt,
    })),
    count: list.length,
    timestamp: nowIso(),
  });
});

/**
 * POST /ai-plan
 * body: { stack?: string[] (intervention ids) | values?, flags? }
 * → the recommended lifestyle items arranged by AI into a concrete WEEKLY schedule.
 *   The AI only sequences the SAME items across the week — it must not add
 *   supplements, drugs or doses. Falls back to a deterministic week when no AI.
 */
longevityRouter.post("/ai-plan", async (req: Request, res: Response) => {
  const b = req.body || {};
  const flags = (b.flags || {}) as Record<string, unknown>;
  const activeFlags = Object.keys(flags).filter((k) => Boolean(flags[k]));

  // Resolve the allowed item list: explicit ids, else all non-gated recommend items.
  let items: Intervention[];
  if (Array.isArray(b.stack) && b.stack.length) {
    const ids = new Set(b.stack as string[]);
    items = STACK.filter((it) => ids.has(it.id) && it.action === "recommend");
  } else {
    items = STACK.filter((it) => it.action === "recommend" && !(it.gate || []).some((g) => activeFlags.includes(g)));
  }
  const allowed = items.map((it) => it.name);

  const fallbackWeek = {
    monday: ["Силовые", "Сон 7–9 ч", "Белок + клетчатка"],
    tuesday: ["Zone 2 кардио", "8–10к шагов"],
    wednesday: ["Силовые", "Сауна (если разрешено)"],
    thursday: ["Zone 2 кардио", "Социальная активность"],
    friday: ["Интервалы VO₂max (4×4)", "Медитация/стресс"],
    saturday: ["Длинная прогулка / шаги", "Окно питания 12–16 ч"],
    sunday: ["Отдых / мобильность", "Планирование недели"],
    note: "Детерминированная раскладка (AI-провайдер не подключён). Только образ жизни, без доз и добавочных препаратов.",
  };

  const providers = getProviders().filter((p) => p.configured);
  if (providers.length === 0) {
    return res.json({
      source: "deterministic-fallback",
      allowedItems: allowed,
      weekPlan: fallbackWeek,
      disclaimer: DISCLAIMER,
      timestamp: nowIso(),
    });
  }

  const prompt = [
    "Ты тренер по образу жизни. Составь недельное расписание (пн-вс) СТРОГО из списка разрешённых активностей ниже.",
    "ЗАПРЕЩЕНО: добавлять добавки/препараты, указывать дозировки, вводить активности не из списка.",
    "Твоя задача — только распределить эти активности по дням недели разумно (силовые через день, кардио и отдых чередовать).",
    "",
    `Разрешённые активности: ${allowed.join(", ")}.`,
    "",
    'Верни ТОЛЬКО JSON: {"monday":string[],"tuesday":string[],"wednesday":string[],"thursday":string[],"friday":string[],"saturday":string[],"sunday":string[],"note":string}.',
  ].join("\n");

  try {
    const p = providers[0];
    const result = await callProvider(p.id, [{ role: "user", content: prompt }], p.defaultModel, 0.3);
    const raw = result.reply.trim();
    const jsonStr = raw.startsWith("{") ? raw : raw.match(/```(?:json)?\n?([\s\S]+?)```/)?.[1] ?? raw;
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return res.json({
      source: "ai",
      model: result.model,
      allowedItems: allowed,
      weekPlan: parsed,
      guardrail: "AI только компонует активности; дозы и препараты — вне его полномочий.",
      disclaimer: DISCLAIMER,
      timestamp: nowIso(),
    });
  } catch {
    return res.json({
      source: "deterministic-fallback",
      allowedItems: allowed,
      weekPlan: fallbackWeek,
      disclaimer: DISCLAIMER,
      timestamp: nowIso(),
    });
  }
});

/**
 * POST /progress
 * body: { baseline: {<metricKey>: number}, latest: {<metricKey>: number} }
 * → direction-aware per-metric improvement + overall progress score. Stateless.
 */
longevityRouter.post("/progress", async (req: Request, res: Response) => {
  const b = req.body || {};
  let base = (b.baseline || {}) as Record<string, unknown>;
  let late = (b.latest || {}) as Record<string, unknown>;
  let baselineSource: "input" | "history" = "input";
  let latestSource: "input" | "history" = "input";

  // Auto-fill missing baseline/latest from a signed-in user's saved history:
  // baseline ← earliest measurement, latest ← most recent measurement.
  // Explicit body values always win — this only fills in what's missing.
  const auth = verifyBearerOptional(req);
  const baselineEmpty = Object.keys(base).length === 0;
  const latestEmpty = Object.keys(late).length === 0;
  if (auth?.sub && (baselineEmpty || latestEmpty)) {
    const list = await measurementStore.listForUser(auth.sub);
    if (baselineEmpty && list.length > 0) {
      base = list[0].values;
      baselineSource = "history";
    }
    if (latestEmpty && list.length > 1) {
      late = list[list.length - 1].values;
      latestSource = "history";
    }
  }

  const results: { key: string; name: string; baseline: number; latest: number; change: number; improved: boolean }[] = [];
  for (const m of PROGRESS_METRICS) {
    const bv = num(base[m.key]);
    const lv = num(late[m.key]);
    if (bv === null || lv === null) continue;
    const change = Math.round((lv - bv) * 100) / 100;
    const improved = m.dir === "lower" ? change < 0 : change > 0;
    results.push({ key: m.key, name: m.name, baseline: bv, latest: lv, change, improved });
  }

  if (results.length === 0) {
    return res.status(400).json({
      error: "no_comparable_metrics",
      hint: auth?.sub
        ? "Нет сравнимых метрик. Передайте baseline и latest вручную, либо сначала сохрани минимум 2 оценки через «Собрать план»."
        : "Передайте baseline и latest хотя бы по одной из метрик.",
      metrics: PROGRESS_METRICS.map((m) => m.key),
    });
  }

  const improvedCount = results.filter((r) => r.improved).length;
  const score = Math.round((improvedCount / results.length) * 100);
  const trajectory = score >= 67 ? "improving" : score <= 33 ? "worsening" : "mixed";

  res.json({
    metrics: results,
    improvedCount,
    total: results.length,
    progressScore: score,
    trajectory,
    baselineSource,
    latestSource,
    interpretation:
      trajectory === "improving"
        ? "Большинство ключевых маркеров сдвинулись в нужную сторону — цикл рабочий, продолжаем и усиливаем сработавшее."
        : trajectory === "worsening"
        ? "Маркеры в основном ухудшились — вернись к фундаменту (сон, движение, дефициты) и пересмотри стресс/восстановление."
        : "Смешанный результат — норма для короткого окна; оставь то, что сдвинулось, и дай биовозрасту 6–12 мес.",
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});
