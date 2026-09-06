import { Router, Request, Response } from "express";
import { callProvider, getProviders } from "../services/qcoreai/providers";

/**
 * AEVION QMelanin — anti-graying engine.
 *
 * Deterministic, DB-free rules engine. Turns lab biomarkers into a food-first
 * protocol that targets the drivers of melanin synthesis, resolving known
 * nutrient interactions (Zn:Cu antagonism, iron+C, B12+folate, selenium cap).
 *
 * Honest framing (baked into responses): this is wellness/education, NOT a
 * medical device. "Melanin level" is not a blood test — we measure the upstream
 * biomarkers that gate melanogenesis plus visual hair tracking. Age-related
 * graying (melanocyte stem-cell depletion) is largely irreversible; the engine
 * targets early/deficiency-driven graying and slowing the rate.
 *
 * Endpoints:
 *   GET  /health       — status + rule counts
 *   POST /assessment   — intake profile → risk band + recommended lab panel
 *   POST /labs         — biomarker values → optimal-range flags
 *   POST /plan         — flags → food protocol + interaction schedule + duration
 */

export const qmelaninRouter = Router();

const DISCLAIMER =
  "Wellness/образовательный инструмент, не диагностика и не лечение. Дозы нутриентов гейтятся реальным дефицитом по анализам. Возрастная седина в основном необратима; метод целится в раннюю седину и замедление скорости.";

// ── Biomarker model ──────────────────────────────────────────────────────────

type BiomarkerKey =
  | "ferritin"
  | "b12"
  | "folate"
  | "vitaminD"
  | "copper"
  | "zinc"
  | "selenium"
  | "tsh";

interface BiomarkerSpec {
  key: BiomarkerKey;
  label: string;
  unit: string;
  /** Values below `optimalLow` are flagged as suboptimal for hair pigment. */
  optimalLow: number;
  /** Optional upper bound (e.g. TSH) beyond which we also flag. */
  optimalHigh?: number;
  tier: 1 | 2;
  drives: string; // what it feeds in melanogenesis
}

const BIOMARKERS: BiomarkerSpec[] = [
  { key: "ferritin", label: "Ферритин", unit: "нг/мл", optimalLow: 40, tier: 1, drives: "цикл роста и пигментации волоса" },
  { key: "b12", label: "Витамин B12", unit: "пг/мл", optimalLow: 400, tier: 1, drives: "пигментация меланоцитов" },
  { key: "folate", label: "Фолат", unit: "нг/мл", optimalLow: 5, tier: 1, drives: "метилирование, синтез ДНК меланоцитов" },
  { key: "vitaminD", label: "Витамин D (25-OH)", unit: "нг/мл", optimalLow: 30, tier: 1, drives: "функция меланоцитов" },
  { key: "copper", label: "Медь", unit: "мкг/дл", optimalLow: 80, tier: 1, drives: "кофактор тирозиназы — ядро синтеза меланина" },
  { key: "zinc", label: "Цинк", unit: "мкг/дл", optimalLow: 80, tier: 1, drives: "TRP2, антиоксидантная SOD" },
  { key: "selenium", label: "Селен", unit: "мкг/л", optimalLow: 90, tier: 2, drives: "глутатион-пероксидаза (антиоксидант ниши)" },
  { key: "tsh", label: "ТТГ", unit: "мЕд/л", optimalLow: 0.4, optimalHigh: 2.5, tier: 1, drives: "щитовидная регуляция пигментации" },
];

const BIOMARKER_BY_KEY: Record<string, BiomarkerSpec> = Object.fromEntries(
  BIOMARKERS.map((b) => [b.key, b]),
);

// ── Food sources (accessible, per nutrient) ──────────────────────────────────

const FOOD_SOURCES: Record<BiomarkerKey, string[]> = {
  copper: ["говяжья печень", "устрицы/морепродукты", "какао / тёмный шоколад", "кешью", "семечки подсолнуха", "грибы", "чечевица", "нут"],
  b12: ["печень", "красное мясо", "рыба", "яйца", "молочное", "обогащённые продукты (веганам)"],
  folate: ["листовая зелень", "чечевица", "фасоль", "спаржа", "авокадо"],
  ferritin: ["красное мясо", "печень", "бобовые + витамин C для усвоения"],
  vitaminD: ["жирная рыба (лосось, сардины)", "яичный желток", "солнце", "добавка при дефиците"],
  zinc: ["тыквенные семечки", "мясо", "бобовые"],
  selenium: ["бразильский орех (1–2 шт/день, не больше)", "рыба", "яйца"],
  tsh: ["йод (морепродукты, водоросли)", "селен", "консультация эндокринолога"],
};

// Melanin substrate + antioxidant support (always included, not tied to a single flag)
const SUBSTRATE_FOODS = ["яйца", "сыр", "соя", "птица", "рыба", "тыквенные семечки", "миндаль"];
const ANTIOXIDANT_FOODS = ["брокколи и крестоцветные", "огурец, редис", "чеснок, лук (прекурсоры глутатиона)", "ягоды", "зелёный чай"];
const MELATONIN_SLEEP = ["вишня, грецкий орех, фисташки, овёс", "гигиена сна 7–9 ч", "магний, витамин B6"];

// ── Interaction rules ─────────────────────────────────────────────────────────

interface Interaction {
  rule: string;
  why: string;
}

function resolveInteractions(activeKeys: BiomarkerKey[]): Interaction[] {
  const out: Interaction[] = [];
  const has = (k: BiomarkerKey) => activeKeys.includes(k);

  if (has("zinc") || has("copper")) {
    out.push({
      rule: "Соотношение цинк:медь держать 8–15:1; никогда не давать высокий цинк без меди.",
      why: "Высокий цинк вытесняет медь и вызывает ятрогенный дефицит меди — а медь критична для тирозиназы.",
    });
  }
  if (has("ferritin")) {
    out.push({
      rule: "Железо принимать с витамином C, отдельно от чая/кофе/кальция и от цинка/меди.",
      why: "Витамин C усиливает всасывание железа; танины и кальций тормозят; железо конкурирует с Zn/Cu.",
    });
  }
  if (has("b12") || has("folate")) {
    out.push({
      rule: "B12 и фолат корректировать вместе, не изолированно.",
      why: "Изолированный фолат маскирует дефицит B12.",
    });
  }
  if (has("vitaminD")) {
    out.push({
      rule: "Витамин D — с жиром, добавить K2 и магний; следить за балансом кальция.",
      why: "Жирорастворимый витамин; кофакторы нужны для корректного метаболизма.",
    });
  }
  if (has("selenium")) {
    out.push({
      rule: "Селен — жёсткий кап: не больше 1–2 бразильских орехов в день.",
      why: "Селен токсичен при передозировке.",
    });
  }
  // substrate rule is always relevant
  out.push({
    rule: "Тирозин-богатые продукты — с умеренным белком, распределять по приёмам.",
    why: "Тирозин конкурирует с другими большими нейтральными аминокислотами за транспорт.",
  });
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

qmelaninRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "AEVION QMelanin",
    persistence: "stateless",
    biomarkers: BIOMARKERS.length,
    interactionRules: 6,
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /assessment
 * body: { age, onsetAge?, familyHistory?, diet?, stress?, sleepHours?, smoking? }
 * → risk band + recommended lab panel (Tier 1 always; Tier 2 if elevated risk)
 */
qmelaninRouter.post("/assessment", (req: Request, res: Response) => {
  const b = req.body || {};
  const age = num(b.age) ?? 40;
  const onsetAge = num(b.onsetAge);
  const familyHistory = Boolean(b.familyHistory);
  const smoking = Boolean(b.smoking);
  const stress = num(b.stress) ?? 0; // 0..10
  const sleepHours = num(b.sleepHours) ?? 7;
  const diet = String(b.diet || "mixed"); // mixed | vegetarian | vegan

  let score = 0;
  const factors: string[] = [];
  if (onsetAge !== null && onsetAge < 30) { score += 3; factors.push("ранняя седина (до 30)"); }
  else if (onsetAge !== null && onsetAge < 40) { score += 2; factors.push("седина до 40"); }
  if (familyHistory) { score += 1; factors.push("семейный анамнез"); }
  if (smoking) { score += 2; factors.push("курение (окислительный стресс)"); }
  if (stress >= 7) { score += 2; factors.push("высокий стресс"); }
  if (sleepHours < 6) { score += 1; factors.push("недосып"); }
  if (diet === "vegan") { score += 2; factors.push("веган-диета (риск B12/железа/цинка)"); }
  else if (diet === "vegetarian") { score += 1; factors.push("вегетарианство (риск B12/железа)"); }

  // Какие поля человек ДЕЙСТВИТЕЛЬНО заполнил.
  //
  // У каждого значения выше есть умолчание: возраст 40, стресс 0, сон 7 часов,
  // питание «смешанное», а familyHistory и smoking — Boolean(undefined), то есть
  // false. Поэтому пустое тело давало score 0, factors [] и band "low":
  // «мы проверили, у вас всё хорошо», посчитанное из ничего. Проверено на проде
  // 20.08.2026 запросом с телом {}.
  //
  // В модуле про здоровье это опаснее отказа: отказ видно, а успокаивающий ответ
  // принимают на веру. Отсутствие данных — не признак благополучия.
  const RISK_FIELDS = ["onsetAge", "familyHistory", "smoking", "stress", "sleepHours", "diet"] as const;
  const answered = RISK_FIELDS.filter(
    (k) => b[k] !== undefined && b[k] !== null && b[k] !== "",
  );
  const assumed = RISK_FIELDS.filter((k) => !answered.includes(k));

  // Ни одного поля, влияющего на риск, — оценивать нечего.
  const band =
    answered.length === 0
      ? "unknown"
      : score >= 5
        ? "high"
        : score >= 2
          ? "moderate"
          : "low";
  const tier1 = BIOMARKERS.filter((x) => x.tier === 1).map((x) => ({ key: x.key, label: x.label, unit: x.unit }));
  const tier2 = BIOMARKERS.filter((x) => x.tier === 2).map((x) => ({ key: x.key, label: x.label, unit: x.unit }));
  // При "unknown" отдаётся ПОЛНАЯ панель: не зная ничего, сужать обследование
  // нельзя. Лишний анализ дешевле пропущенного.
  const recommendedPanel = band === "low" ? tier1 : [...tier1, ...tier2];

  res.json({
    riskScore: band === "unknown" ? null : score,
    riskBand: band,
    factors,
    // Что заполнено и что подставлено умолчанием. Без этого ноль в riskScore
    // неотличим от «ответил, и всё чисто».
    answered,
    assumed,
    recommendedPanel,
    extended: band !== "low",
    note:
      onsetAge !== null && age - onsetAge > 25
        ? "Седина давняя — вероятно возрастное истощение McSC (в основном необратимо). Программа целится в замедление и общее клеточное здоровье."
        : "Ранняя/пограничная седина — окно для коррекции дефицитов и снижения окислительной нагрузки.",
    ...(band === "unknown"
      ? {
          warning:
            "Анкета не заполнена: ни одно поле, влияющее на риск, не передано. " +
            "Это НЕ значит, что риск низкий — оценить его пока не по чему. " +
            "Заполните анкету, чтобы получить оценку.",
        }
      : {}),
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /labs
 * body: { values: { ferritin: 22, b12: 310, ... } }
 * → per-biomarker flags (below optimal / ok / high)
 */
qmelaninRouter.post("/labs", (req: Request, res: Response) => {
  const values = (req.body && req.body.values) || {};
  const flags = BIOMARKERS.map((spec) => {
    const v = num(values[spec.key]);
    let status: "deficient" | "ok" | "high" | "missing" = "missing";
    if (v !== null) {
      if (v < spec.optimalLow) status = "deficient";
      else if (spec.optimalHigh !== undefined && v > spec.optimalHigh) status = "high";
      else status = "ok";
    }
    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      value: v,
      optimalLow: spec.optimalLow,
      optimalHigh: spec.optimalHigh ?? null,
      status,
      drives: spec.drives,
    };
  });

  const deficient = flags.filter((f) => f.status === "deficient").map((f) => f.key);
  res.json({
    flags,
    deficientKeys: deficient,
    deficientCount: deficient.length,
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /plan
 * body: { deficientKeys: ["copper","b12"] }  (from /labs) OR { values: {...} }
 * → food protocol targeting each deficiency + always-on substrate/antioxidant/sleep
 *   blocks + resolved interaction schedule + duration + retest date.
 */
qmelaninRouter.post("/plan", (req: Request, res: Response) => {
  const b = req.body || {};
  let deficientKeys: BiomarkerKey[] = [];

  if (Array.isArray(b.deficientKeys)) {
    deficientKeys = b.deficientKeys.filter(
      // hasOwnProperty.call, а не `in`: `in` идёт по цепочке прототипов, поэтому
      // "constructor" проходил фильтр, а BIOMARKER_BY_KEY["constructor"] — функция.
      // Падения не было: .label и .drives у функции просто undefined — и человек
      // получал рекомендацию С ПУСТЫМ НАЗВАНИЕМ нутриента. Тихий неверный ответ в
      // модуле про здоровье хуже отказа: отказ видно, пустую строку принимают.
      (k: string): k is BiomarkerKey => Object.prototype.hasOwnProperty.call(BIOMARKER_BY_KEY, k),
    );
  } else if (b.values) {
    deficientKeys = BIOMARKERS.filter((spec) => {
      const v = num(b.values[spec.key]);
      return v !== null && v < spec.optimalLow;
    }).map((s) => s.key);
  }

  // Прислал ли человек ХОТЬ ЧТО-ТО, по чему можно судить о дефицитах.
  //
  // Ни deficientKeys, ни values — и обе ветки выше не выполняются, список
  // остаётся пустым, а сводка гласит «Явных дефицитов по порогам нет».
  // Проверено на проде 20.08.2026 телом {}. Отсутствие данных выдавалось за
  // результат проверки.
  //
  // Считаем ЗНАЧЕНИЯ, а не наличие поля. Boolean({}) истинно, а витрина
  // шлёт `values` ВСЕГДА — при пустой форме это пустой объект. Первая
  // версия признака (`Boolean(b.values)`) поэтому срабатывала только на
  // теле из моего же зонда и молчала ровно там, где человек ничего не
  // ввёл. Проверено прогоном обоих тел рядом.
  const hasInput =
    (Array.isArray(b.deficientKeys) && b.deficientKeys.length > 0) ||
    (b.values !== null &&
      typeof b.values === "object" &&
      Object.values(b.values as Record<string, unknown>).some((v) => num(v) !== null));

  const targeted = deficientKeys.map((k) => ({
    nutrient: BIOMARKER_BY_KEY[k].label,
    key: k,
    role: BIOMARKER_BY_KEY[k].drives,
    foods: FOOD_SOURCES[k],
  }));

  const foundation = [
    { block: "Субстрат меланина (тирозин)", foods: SUBSTRATE_FOODS },
    { block: "Антиоксидантная поддержка ниши", foods: ANTIOXIDANT_FOODS },
    { block: "Мелатонин и сон", foods: MELATONIN_SLEEP },
  ];

  const interactions = resolveInteractions(deficientKeys);
  const durationDays = 90;

  res.json({
    summary:
      !hasInput
        ? "Данные не переданы: ни списка дефицитов, ни значений анализов. Это НЕ значит, что дефицитов нет — судить пока не по чему. План ниже общий, не персональный."
        : deficientKeys.length === 0
        ? "Явных дефицитов по порогам нет — фокус на поддержке (субстрат + антиоксиданты + сон) и снижении окислительной нагрузки."
        : `Целевая коррекция ${deficientKeys.length} дефицит(а/ов) через доступные продукты + база.`,
    targeted,
    // Персональный план или общий. Без этого признака человек не отличит
    // «проверили, дефицитов нет» от «нам нечего было проверять».
    personalised: hasInput,
    ...(hasInput ? {} : { warning: "План общий: данные для персонализации не переданы." }),
    foundation,
    interactions,
    schedule: {
      durationDays,
      retestInDays: durationDays,
      visualEndpointInDays: 180,
      note: "Биомаркеры отвечают за 8–12 недель → ретест на 90-й день. Видимый пигмент — не раньше 6 мес (цикл волоса).",
    },
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /track
 * body: { entries: [{ date, grayCountZone, subjectiveScore? }] }  (client-held state)
 * → stateless trend: gray-count delta first→last, direction, weeks tracked. No DB.
 */
qmelaninRouter.post("/track", (req: Request, res: Response) => {
  const raw = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const entries = raw
    .map((e: Record<string, unknown>) => ({
      date: String(e.date ?? ""),
      grayCountZone: num(e.grayCountZone),
      subjectiveScore: num(e.subjectiveScore),
    }))
    .filter((e: { grayCountZone: number | null }) => e.grayCountZone !== null)
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));

  if (entries.length < 1) {
    return res.status(400).json({ error: "no_entries", hint: "Нужна хотя бы одна запись с grayCountZone." });
  }

  const first = entries[0];
  const last = entries[entries.length - 1];
  const delta = last.grayCountZone! - first.grayCountZone!;
  const direction = delta < 0 ? "improving" : delta > 0 ? "worsening" : "stable";

  let weeks: number | null = null;
  const t0 = Date.parse(first.date);
  const t1 = Date.parse(last.date);
  if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
    weeks = Math.round((t1 - t0) / (7 * 24 * 3600 * 1000));
  }

  res.json({
    points: entries.length,
    firstCount: first.grayCountZone,
    lastCount: last.grayCountZone,
    delta,
    direction,
    weeksTracked: weeks,
    interpretation:
      direction === "improving"
        ? "Число седых в зоне снизилось — но это чувствительно к освещению/ракурсу фото; смотрите на тренд, не на одну точку."
        : direction === "worsening"
        ? "Число седых растёт — норма при возрастной седине; программа целится в замедление, не гарантирует откат."
        : "Стабильно — уже неплохо для активной седины.",
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /ai-plan
 * body: { deficientKeys? | values? }
 * → deterministic food lists (from the engine) arranged by AI into a 1-day menu
 *   that RESPECTS the interaction timing rules. The AI only sequences the SAME
 *   foods across meals — it must not add supplements or invent doses. Falls back
 *   to a deterministic day-plan when no AI provider is configured.
 */
qmelaninRouter.post("/ai-plan", async (req: Request, res: Response) => {
  const b = req.body || {};
  let deficientKeys: BiomarkerKey[] = [];
  if (Array.isArray(b.deficientKeys)) {
    deficientKeys = b.deficientKeys.filter(
      // hasOwnProperty.call, а не `in`: `in` идёт по цепочке прототипов, поэтому
      // "constructor" проходил фильтр, а BIOMARKER_BY_KEY["constructor"] — функция.
      // Падения не было: .label и .drives у функции просто undefined — и человек
      // получал рекомендацию С ПУСТЫМ НАЗВАНИЕМ нутриента. Тихий неверный ответ в
      // модуле про здоровье хуже отказа: отказ видно, пустую строку принимают.
      (k: string): k is BiomarkerKey => Object.prototype.hasOwnProperty.call(BIOMARKER_BY_KEY, k),
    );
  } else if (b.values) {
    deficientKeys = BIOMARKERS.filter((spec) => {
      const v = num(b.values[spec.key]);
      return v !== null && v < spec.optimalLow;
    }).map((s) => s.key);
  }

  // The complete pool of allowed foods (targeted deficiencies + always-on base).
  const targetedFoods = deficientKeys.flatMap((k) => FOOD_SOURCES[k]);
  const allowedFoods = Array.from(
    new Set([...targetedFoods, ...SUBSTRATE_FOODS, ...ANTIOXIDANT_FOODS]),
  );
  const interactions = resolveInteractions(deficientKeys);

  const fallbackDay = {
    breakfast: ["яйца", ...ANTIOXIDANT_FOODS.slice(0, 1)],
    lunch: [...targetedFoods.slice(0, 2), "листовая зелень + витамин C (для железа)"],
    dinner: [...SUBSTRATE_FOODS.slice(0, 2)],
    snack: ["грецкий орех / тыквенные семечки"],
    note: "Детерминированная раскладка (AI-провайдер не подключён). Железо — с витамином C, отдельно от чая/кофе; цинк и медь — в разные приёмы.",
  };

  const providers = getProviders().filter((p) => p.configured);
  if (providers.length === 0) {
    return res.json({
      source: "deterministic-fallback",
      allowedFoods,
      interactions,
      dayPlan: fallbackDay,
      disclaimer: DISCLAIMER,
      timestamp: nowIso(),
    });
  }

  const rulesText = interactions.map((i) => `- ${i.rule}`).join("\n");
  const prompt = [
    "Ты нутрициолог. Составь меню на ОДИН день (завтрак, обед, ужин, перекус) СТРОГО из списка разрешённых продуктов ниже.",
    "ЗАПРЕЩЕНО: добавлять добавки/БАДы, указывать дозировки в мг/МЕ, вводить продукты не из списка.",
    "Твоя задача — только распределить эти продукты по приёмам пищи так, чтобы соблюсти правила совместимости.",
    "",
    `Разрешённые продукты: ${allowedFoods.join(", ")}.`,
    "",
    `Правила совместимости (обязательно соблюсти по таймингу приёмов):\n${rulesText}`,
    "",
    'Верни ТОЛЬКО JSON: {"breakfast": string[], "lunch": string[], "dinner": string[], "snack": string[], "note": string}.',
  ].join("\n");

  try {
    const p = providers[0];
    const result = await callProvider(p.id, [{ role: "user", content: prompt }], p.defaultModel, 0.3, undefined, undefined, { module: "qmelanin-plan" });
    const rawReply = result.reply.trim();
    const jsonStr = rawReply.startsWith("{")
      ? rawReply
      : rawReply.match(/```(?:json)?\n?([\s\S]+?)```/)?.[1] ?? rawReply;
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return res.json({
      source: "ai",
      model: result.model,
      allowedFoods,
      interactions,
      dayPlan: parsed,
      guardrail: "AI только компонует продукты; дозировки и добавки — вне его полномочий, их не назначаем.",
      disclaimer: DISCLAIMER,
      timestamp: nowIso(),
    });
  } catch {
    // Any AI/parse failure → safe deterministic day.
    return res.json({
      source: "deterministic-fallback",
      allowedFoods,
      interactions,
      dayPlan: fallbackDay,
      disclaimer: DISCLAIMER,
      timestamp: nowIso(),
    });
  }
});
