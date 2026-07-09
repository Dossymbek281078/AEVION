import { Router, Request, Response } from "express";

/**
 * AEVION QRenew — cellular-renewal program engine.
 *
 * Thesis: graying is a visible, non-invasive biomarker of systemic stem-cell /
 * mitochondrial aging (Nature 2023 — McSC stall in the niche, lose MITF, ROS from
 * mitochondrial dysfunction → apoptosis). So the anti-graying targets ARE the
 * anti-aging targets. This engine:
 *   - computes a phenotypic (biological) age from routine labs (Levine 2018 PhenoAge),
 *   - generates an evidence-tiered intervention stack (A/B proposed, C/D info-only),
 *   - maps the 12 hallmarks of aging to the 4 we act on.
 *
 * DB-free & deterministic. Honest evidence tiering + safety gating are the point:
 * only Tier A + B are recommendations; Tier C is "discuss with a doctor"; Tier D
 * is science-horizon only, never advised.
 *
 * Endpoints:
 *   GET  /health   — status
 *   GET  /stack    — full tiered intervention catalog + hallmark map
 *   POST /bioage   — routine labs → phenotypic age + delta vs chronological
 *   POST /assess   — profile → personalized Tier A+B stack (contraindication-gated)
 */

export const qrenewRouter = Router();

const DISCLAIMER =
  "Wellness/образование/citizen-science, не диагностика и не лечение. Возрастная седина в основном необратима — целимся в замедление. Tier C только под наблюдением врача, Tier D — только горизонт науки, не рекомендация.";

// ── 12 hallmarks → the 4 we act on ────────────────────────────────────────────

const HALLMARKS = [
  { name: "Митохондриальная дисфункция", targeted: true },
  { name: "Отключение аутофагии", targeted: true },
  { name: "Истощение стволовых клеток", targeted: true },
  { name: "Клеточная сенесценция", targeted: true },
  { name: "Эпигенетические изменения", targeted: false },
  { name: "Хроническое воспаление", targeted: false },
  { name: "Потеря протеостаза", targeted: false },
  { name: "Дерегуляция нутриент-сенсинга", targeted: false },
  { name: "Укорочение теломер", targeted: false },
  { name: "Геномная нестабильность", targeted: false },
  { name: "Нарушение межклеточной коммуникации", targeted: false },
  { name: "Дисбиоз микробиома", targeted: false },
];

// ── Evidence-tiered intervention stack ────────────────────────────────────────

type Tier = "A" | "B" | "C" | "D";

interface Intervention {
  id: string;
  name: string;
  tier: Tier;
  mechanism: string;
  hallmark: string;
  evidence: string;
  action: "recommend" | "inform" | "science-only";
  foods?: string[];
}

const STACK: Intervention[] = [
  { id: "exercise", name: "Аэробная + силовая нагрузка", tier: "A", mechanism: "митобиогенез (PGC-1α), ↑антиокс.ферменты", hallmark: "Митохондриальная дисфункция", evidence: "сильная (RCT, когорты)", action: "recommend" },
  { id: "sleep", name: "Сон 7–9 ч, циркадный ритм", tier: "A", mechanism: "эндогенный мелатонин, репарация, аутофагия", hallmark: "Отключение аутофагии", evidence: "сильная", action: "recommend" },
  { id: "diet", name: "Средиземноморская / растительная диета", tier: "A", mechanism: "↓воспаление, полифенолы, нутриент-сенсинг", hallmark: "Хроническое воспаление", evidence: "сильная", action: "recommend" },
  { id: "fmd", name: "Fasting-Mimicking Diet (циклами)", tier: "A", mechanism: "↓IGF-1/mTOR, ↑аутофагия/кетоны", hallmark: "Дерегуляция нутриент-сенсинга", evidence: "RCT: −2.5 года биовозраста", action: "recommend" },
  { id: "urolithinA", name: "Уролитин А", tier: "B", mechanism: "митофагия", hallmark: "Митохондриальная дисфункция", evidence: "RCT 4 мес: +12% сила, ↓CRP", action: "recommend", foods: ["гранат", "грецкий орех", "ягоды"] },
  { id: "spermidine", name: "Спермидин", tier: "B", mechanism: "индуктор аутофагии", hallmark: "Отключение аутофагии", evidence: "эпидемиология сильна, RCT тонкие", action: "recommend", foods: ["зародыши пшеницы", "соя", "грибы", "выдержанный сыр"] },
  { id: "omega3d", name: "Омега-3 + витамин D (при дефиците)", tier: "B", mechanism: "мембраны, ↓воспаление", hallmark: "Хроническое воспаление", evidence: "средняя", action: "recommend", foods: ["жирная рыба", "яичный желток"] },
  { id: "nad", name: "NAD⁺ прекурсоры (NMN / NR)", tier: "C", mechanism: "↑NAD⁺, сиртуины", hallmark: "Митохондриальная дисфункция", evidence: "поднимает NAD⁺, клинпольза не доказана", action: "inform" },
  { id: "senolytics", name: "Сенолитики (D+Q / фисетин)", tier: "C", mechanism: "клиренс сенесцентных клеток", hallmark: "Клеточная сенесценция", evidence: "ранние фазы I–II", action: "inform" },
  { id: "rapamycin", name: "Рапамицин / метформин (off-label)", tier: "C", mechanism: "mTOR / нутриент-сенсинг", hallmark: "Дерегуляция нутриент-сенсинга", evidence: "долголетие у людей недоказано", action: "inform" },
  { id: "reprogramming", name: "Частичное эпигенетическое перепрограммирование (OSK)", tier: "D", mechanism: "сброс эпигенетических часов", hallmark: "Эпигенетические изменения", evidence: "только животные; +109% остаточной жизни у мышей; онкориск", action: "science-only" },
];

// ── PhenoAge (Levine et al., 2018) ────────────────────────────────────────────
// Deterministic biological-age estimate from 9 routine biomarkers + chronological age.
// Units expected (normalize on input):
//   albumin g/L, creatinine µmol/L, glucose mmol/L, crp mg/L, lymphocytePct %,
//   mcv fL, rdw %, alp U/L, wbc 1000/µL, age years.

interface PhenoInput {
  albumin: number;
  creatinine: number;
  glucose: number;
  crp: number; // mg/L (converted to mg/dL internally)
  lymphocytePct: number;
  mcv: number;
  rdw: number;
  alp: number;
  wbc: number;
  age: number;
}

function phenoAge(i: PhenoInput): number {
  // CRP mg/L → mg/dL, then ln (guard against <=0)
  const crpMgDl = Math.max(i.crp / 10, 0.01);
  const lnCrp = Math.log(crpMgDl);

  const xb =
    -19.907 -
    0.0336 * i.albumin +
    0.0095 * i.creatinine +
    0.1953 * i.glucose +
    0.0954 * lnCrp -
    0.012 * i.lymphocytePct +
    0.0268 * i.mcv +
    0.3306 * i.rdw +
    0.00188 * i.alp +
    0.0554 * i.wbc +
    0.0804 * i.age;

  const g = 0.0076927;
  const mortScore = 1 - Math.exp((-Math.exp(xb) * (Math.exp(120 * g) - 1)) / g);
  const clamped = Math.min(Math.max(mortScore, 1e-9), 1 - 1e-9);
  const pheno = 141.50225 + Math.log(-0.00553 * Math.log(1 - clamped)) / 0.09165;
  return Math.round(pheno * 10) / 10;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

qrenewRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "AEVION QRenew",
    persistence: "stateless",
    interventions: STACK.length,
    hallmarks: HALLMARKS.length,
    targetedHallmarks: HALLMARKS.filter((h) => h.targeted).length,
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

qrenewRouter.get("/stack", (_req: Request, res: Response) => {
  const byTier: Record<Tier, Intervention[]> = { A: [], B: [], C: [], D: [] };
  for (const it of STACK) byTier[it.tier].push(it);
  res.json({
    hallmarks: HALLMARKS,
    tiers: {
      A: { label: "Доказано — ядро всем", items: byTier.A },
      B: { label: "Многообещающе (RCT есть) — рекомендуется", items: byTier.B },
      C: { label: "Экспериментально — только под врачом", items: byTier.C },
      D: { label: "Research-only — не применять", items: byTier.D },
    },
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /bioage
 * body: { albumin, creatinine, glucose, crp, lymphocytePct, mcv, rdw, alp, wbc, age }
 * → phenotypic (biological) age + delta vs chronological.
 */
qrenewRouter.post("/bioage", (req: Request, res: Response) => {
  const b = req.body || {};
  const keys: (keyof PhenoInput)[] = ["albumin", "creatinine", "glucose", "crp", "lymphocytePct", "mcv", "rdw", "alp", "wbc", "age"];
  const parsed: Partial<PhenoInput> = {};
  const missing: string[] = [];
  for (const k of keys) {
    const v = num(b[k]);
    if (v === null) missing.push(k);
    else parsed[k] = v;
  }
  if (missing.length) {
    return res.status(400).json({
      error: "missing_biomarkers",
      missing,
      required: keys,
      hint: "Единицы: альбумин г/л, креатинин мкмоль/л, глюкоза ммоль/л, CRP мг/л, лимфоциты %, MCV фл, RDW %, ЩФ Ед/л, лейкоциты ×10⁹/л, возраст лет.",
    });
  }

  const bio = phenoAge(parsed as PhenoInput);
  const chrono = (parsed as PhenoInput).age;
  const delta = Math.round((bio - chrono) * 10) / 10;

  res.json({
    chronologicalAge: chrono,
    phenotypicAge: bio,
    ageDelta: delta,
    interpretation:
      delta <= -1
        ? "Биологический возраст ниже паспортного — клеточное здоровье выше среднего для возраста."
        : delta >= 1
        ? "Биологический возраст выше паспортного — есть куда улучшать; программа Tier A+B в приоритете."
        : "Биологический возраст примерно равен паспортному.",
    method: "PhenoAge (Levine et al., 2018)",
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /assess
 * body: { age, hasDiabetes?, pregnant?, underweight?, onMedications? }
 * → personalized Tier A+B stack, contraindication-gated; C/D returned as info only.
 */
qrenewRouter.post("/assess", (req: Request, res: Response) => {
  const b = req.body || {};
  const hasDiabetes = Boolean(b.hasDiabetes);
  const pregnant = Boolean(b.pregnant);
  const underweight = Boolean(b.underweight);

  const recommend: Intervention[] = [];
  const gatedOut: { name: string; reason: string }[] = [];

  for (const it of STACK) {
    if (it.action !== "recommend") continue;
    if (it.id === "fmd" && (hasDiabetes || pregnant || underweight)) {
      gatedOut.push({
        name: it.name,
        reason: "Противопоказано при диабете / беременности / дефиците массы — обсудите с врачом.",
      });
      continue;
    }
    recommend.push(it);
  }

  const informOnly = STACK.filter((it) => it.action !== "recommend").map((it) => ({
    name: it.name,
    tier: it.tier,
    evidence: it.evidence,
    note: it.tier === "D" ? "Только горизонт науки, не применять." : "Только под наблюдением врача.",
  }));

  res.json({
    recommendedStack: recommend.map((it) => ({
      id: it.id,
      name: it.name,
      tier: it.tier,
      mechanism: it.mechanism,
      hallmark: it.hallmark,
      evidence: it.evidence,
      foods: it.foods ?? null,
    })),
    contraindicationGated: gatedOut,
    informOnly,
    cycle: {
      baseline: "дефициты + биовозраст + функц.тесты + фото седины",
      retestBiomarkersInDays: 90,
      retestBioageInDays: 180,
      annualReport: true,
    },
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});

/**
 * POST /report
 * body: { baseline: {<PhenoInput>}, latest: {<PhenoInput>} }
 * → biological-age trajectory: PhenoAge at both points + delta improvement +
 *   whether the gap to chronological age narrowed. Stateless.
 */
qrenewRouter.post("/report", (req: Request, res: Response) => {
  const b = req.body || {};
  const keys: (keyof PhenoInput)[] = ["albumin", "creatinine", "glucose", "crp", "lymphocytePct", "mcv", "rdw", "alp", "wbc", "age"];

  function parsePoint(src: unknown): { ok: true; input: PhenoInput } | { ok: false; missing: string[] } {
    const o = (src || {}) as Record<string, unknown>;
    const parsed: Partial<PhenoInput> = {};
    const missing: string[] = [];
    for (const k of keys) {
      const v = num(o[k]);
      if (v === null) missing.push(k);
      else parsed[k] = v;
    }
    return missing.length ? { ok: false, missing } : { ok: true, input: parsed as PhenoInput };
  }

  const base = parsePoint(b.baseline);
  const late = parsePoint(b.latest);
  if (!base.ok || !late.ok) {
    return res.status(400).json({
      error: "missing_biomarkers",
      baselineMissing: base.ok ? [] : base.missing,
      latestMissing: late.ok ? [] : late.missing,
      required: keys,
    });
  }

  const baseBio = phenoAge(base.input);
  const lateBio = phenoAge(late.input);
  const baseGap = Math.round((baseBio - base.input.age) * 10) / 10;
  const lateGap = Math.round((lateBio - late.input.age) * 10) / 10;
  const bioChange = Math.round((lateBio - baseBio) * 10) / 10;
  const gapChange = Math.round((lateGap - baseGap) * 10) / 10; // negative = gap narrowed (good)

  res.json({
    baseline: { chronologicalAge: base.input.age, phenotypicAge: baseBio, ageGap: baseGap },
    latest: { chronologicalAge: late.input.age, phenotypicAge: lateBio, ageGap: lateGap },
    phenoAgeChange: bioChange,
    ageGapChange: gapChange,
    trajectory: gapChange < -0.5 ? "improving" : gapChange > 0.5 ? "worsening" : "stable",
    interpretation:
      gapChange < -0.5
        ? "Разрыв между биологическим и паспортным возрастом сократился — программа обновления в верном направлении."
        : gapChange > 0.5
        ? "Разрыв вырос — стоит усилить Tier A (нагрузка/сон/питание) и пересмотреть факторы стресса/воспаления."
        : "Без значимого сдвига — норма для короткого окна; биовозраст двигается за 6–12 мес.",
    method: "PhenoAge (Levine et al., 2018)",
    disclaimer: DISCLAIMER,
    timestamp: nowIso(),
  });
});
