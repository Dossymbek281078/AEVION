import { Router, Request, Response } from "express";

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

  const band = score >= 5 ? "high" : score >= 2 ? "moderate" : "low";
  const tier1 = BIOMARKERS.filter((x) => x.tier === 1).map((x) => ({ key: x.key, label: x.label, unit: x.unit }));
  const tier2 = BIOMARKERS.filter((x) => x.tier === 2).map((x) => ({ key: x.key, label: x.label, unit: x.unit }));
  const recommendedPanel = band === "low" ? tier1 : [...tier1, ...tier2];

  res.json({
    riskScore: score,
    riskBand: band,
    factors,
    recommendedPanel,
    extended: band !== "low",
    note:
      onsetAge !== null && age - onsetAge > 25
        ? "Седина давняя — вероятно возрастное истощение McSC (в основном необратимо). Программа целится в замедление и общее клеточное здоровье."
        : "Ранняя/пограничная седина — окно для коррекции дефицитов и снижения окислительной нагрузки.",
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
    deficientKeys = b.deficientKeys.filter((k: string): k is BiomarkerKey => k in BIOMARKER_BY_KEY);
  } else if (b.values) {
    deficientKeys = BIOMARKERS.filter((spec) => {
      const v = num(b.values[spec.key]);
      return v !== null && v < spec.optimalLow;
    }).map((s) => s.key);
  }

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
      deficientKeys.length === 0
        ? "Явных дефицитов по порогам нет — фокус на поддержке (субстрат + антиоксиданты + сон) и снижении окислительной нагрузки."
        : `Целевая коррекция ${deficientKeys.length} дефицит(а/ов) через доступные продукты + база.`,
    targeted,
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
