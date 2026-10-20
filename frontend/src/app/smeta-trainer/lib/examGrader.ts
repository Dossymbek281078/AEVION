import type { Lsr, AiNotice, LearningObject, SmetaPosition } from "./types";
import { calcLsr } from "./calc";
import { findRate } from "./corpus";
import { runAiAdvisor } from "./ai";

/**
 * Грейдер экзамена: студент сдаёт свою ЛСР, мы сравниваем с эталонной.
 *
 * Алгоритм оценивания (макс. 100 баллов):
 *   1. AI-проверки (вес 40):
 *      • каждый info-notice = -2 балла
 *      • каждый warning = -5 баллов
 *      • каждый error = -10 баллов
 *      • минимум 0
 *   2. Покрытие позиций эталона (вес 30):
 *      • % найденных rateCode из эталона
 *   3. Объёмы (вес 20):
 *      • для каждой совпадающей позиции — |delta| ≤ 1% = 100%, ≤ 5% = 75%, ≤ 15% = 50%, иначе 0
 *      • усредняем
 *   4. Итоговая сумма (вес 10):
 *      • |delta totalWithVat| ≤ 5% = 100%, ≤ 15% = 50%, иначе 0
 */

export interface ExamRubric {
  weights: {
    ai: number;
    coverage: number;
    volumes: number;
    total: number;
  };
}

const DEFAULT_RUBRIC: ExamRubric = {
  weights: { ai: 40, coverage: 30, volumes: 20, total: 10 },
};

export interface PositionDiff {
  rateCode: string;
  rateTitle: string;
  unit: string;
  refVolume: number;
  studentVolume: number | null;
  deltaPct: number | null;
  status: "match" | "off-volume" | "missing" | "extra";
  score: number; // 0-100
}


/**
 * Критерии спрятанной ошибки — то, чем заготовка (starter) отличается от эталона.
 *
 * 20.10.2026, слово Оркестратора: заготовка без правок должна быть НИЖЕ порога сдачи
 * (LMS_PASS_THRESHOLD = 70), исправленная — выше, эталон = 100. Весами рубрики этого
 * не добиться на всех 21 кейсе (в «лестнице» ошибка — один коэффициент, заготовка давала
 * 96). Заготовка отличается от эталона РОВНО спрятанной ошибкой (замер: шапка и разделы —
 * только служебные id/title), поэтому отличия считаются автоматически и становятся
 * требованиями. Нарушено хоть одно — ошибка не исправлена, балл не выше 69.
 * Прочие расхождения студента (свои позиции, округления) сюда не попадают.
 */
export interface КритерийОшибки {
  что: string;
  выполнен: (student: Lsr) => boolean;
}

const ДОПУСК_ОБЪЁМА_PCT = 5;
const поКоду = (l: Lsr) => {
  const m = new Map<string, { p: SmetaPosition; category: string }>();
  for (const sec of l.sections) for (const p of sec.positions) if (!m.has(p.rateCode)) m.set(p.rateCode, { p, category: sec.category });
  return m;
};
const одинаково = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function критерииСпрятаннойОшибки(starter: Lsr, reference: Lsr): КритерийОшибки[] {
  const out: КритерийОшибки[] = [];
  for (const k of ["method", "indexQuarter", "indexRegion"] as const) {
    if (!одинаково(starter[k], reference[k])) out.push({ что: `${k} = ${String(reference[k])}`, выполнен: (s) => одинаково(s[k], reference[k]) });
  }
  const st = поКоду(starter);
  const ref = поКоду(reference);
  for (const [код, r] of ref) {
    const z = st.get(код);
    if (!z) { out.push({ что: `есть позиция ${код}`, выполнен: (s) => поКоду(s).has(код) }); continue; }
    if (Math.abs(z.p.volume - r.p.volume) > 1e-9) {
      out.push({ что: `объём ${код} ≈ ${r.p.volume}`, выполнен: (s) => {
        const x = поКоду(s).get(код);
        return !!x && r.p.volume !== 0 && Math.abs((x.p.volume - r.p.volume) / r.p.volume) * 100 <= ДОПУСК_ОБЪЁМА_PCT;
      } });
    }
    if (!одинаково(z.p.coefficients, r.p.coefficients)) {
      out.push({ что: `коэффициенты ${код} как в эталоне`, выполнен: (s) => одинаково(поКоду(s).get(код)?.p.coefficients, r.p.coefficients) });
    }
    if (!одинаково(z.p.resourceOverrides, r.p.resourceOverrides)) {
      out.push({ что: `состав ресурсов ${код} как в эталоне`, выполнен: (s) => одинаково(поКоду(s).get(код)?.p.resourceOverrides, r.p.resourceOverrides) });
    }
    if (z.category !== r.category) {
      out.push({ что: `раздел с ${код} — категория ${r.category}`, выполнен: (s) => поКоду(s).get(код)?.category === r.category });
    }
  }
  for (const код of st.keys()) {
    if (!ref.has(код)) out.push({ что: `нет лишней позиции ${код}`, выполнен: (s) => !поКоду(s).has(код) });
  }
  return out;
}

/** Потолок балла, если спрятанная ошибка не исправлена: на 1 ниже порога сдачи. */
export const ПОТОЛОК_С_ОШИБКОЙ = 69;

export interface ExamReport {
  score: number; // 0-100 итог
  /** Исправлена ли спрятанная ошибка заготовки (null — заготовку не передали). */
  hiddenError?: { fixed: boolean; unmet: string[] } | null;
  grade: "отлично" | "хорошо" | "удовл." | "неуд.";
  breakdown: {
    ai: { score: number; weight: number; notices: AiNotice[] };
    coverage: { score: number; weight: number; matched: number; total: number };
    volumes: { score: number; weight: number; avgDeltaPct: number };
    total: { score: number; weight: number; deltaPct: number };
  };
  positions: PositionDiff[];
  refTotal: number;
  studentTotal: number;
}

function gradeFromScore(score: number): ExamReport["grade"] {
  if (score >= 85) return "отлично";
  if (score >= 70) return "хорошо";
  if (score >= 50) return "удовл.";
  return "неуд.";
}

function noticeWeight(s: AiNotice["severity"]): number {
  if (s === "error") return 10;
  if (s === "warning") return 5;
  return 2;
}

function volumeMatchScore(deltaPct: number): number {
  const a = Math.abs(deltaPct);
  if (a <= 1) return 100;
  if (a <= 5) return 75;
  if (a <= 15) return 50;
  return 0;
}

function totalMatchScore(deltaPct: number): number {
  const a = Math.abs(deltaPct);
  if (a <= 5) return 100;
  if (a <= 15) return 50;
  return 0;
}

function flattenPositions(lsr: Lsr): SmetaPosition[] {
  return lsr.sections.flatMap((s) => s.positions);
}

export function gradeExam(
  studentLsr: Lsr,
  referenceLsr: Lsr,
  object: LearningObject,
  rubric: ExamRubric = DEFAULT_RUBRIC,
  opts: { starter?: Lsr } = {},
): ExamReport {
  // 1. AI
  const notices = runAiAdvisor(studentLsr, object);
  // Штраф — только за замечания СВЕРХ тех, что советник ставит самому эталону.
  // 20.10.2026 (замер всех 21 кейсов): эталон, проверенный против себя, получал
  // 84–96, а не 100 — советник ставит мягкие замечания и эталонам («Индекс заметно
  // устарел» стареет вместе с календарём, «Не указана категория грунта» и т.п.;
  // referenceClean.test.ts их методически допускает). Студента сравнивают с
  // эталоном, и его же замечания — не ошибка студента. Показываем все, штрафуем лишние.
  const уЭталона = new Map<string, number>();
  for (const n of runAiAdvisor(referenceLsr, object)) {
    const k = `${n.scenario}|${n.title}`;
    уЭталона.set(k, (уЭталона.get(k) ?? 0) + 1);
  }
  const penalty = notices.reduce((s, n) => {
    const k = `${n.scenario}|${n.title}`;
    const есть = уЭталона.get(k) ?? 0;
    if (есть > 0) {
      уЭталона.set(k, есть - 1);
      return s;
    }
    return s + noticeWeight(n.severity);
  }, 0);
  const aiScore = Math.max(0, 100 - penalty * 2);

  // 2. Coverage + 3. Volumes
  const refPositions = flattenPositions(referenceLsr);
  const studentPositions = flattenPositions(studentLsr);
  const studentByCode = new Map<string, SmetaPosition>();
  for (const p of studentPositions) studentByCode.set(p.rateCode, p);
  const refByCode = new Set(refPositions.map((p) => p.rateCode));

  const positions: PositionDiff[] = [];
  let matched = 0;
  let volumeScoreSum = 0;
  let volumeMatchedCount = 0;

  for (const ref of refPositions) {
    const rate = findRate(ref.rateCode);
    const title = rate?.title ?? ref.rateCode;
    const unit = rate?.unit ?? "";
    const sp = studentByCode.get(ref.rateCode);
    if (!sp) {
      positions.push({
        rateCode: ref.rateCode,
        rateTitle: title,
        unit,
        refVolume: ref.volume,
        studentVolume: null,
        deltaPct: null,
        status: "missing",
        score: 0,
      });
      continue;
    }
    matched += 1;
    const delta = ((sp.volume - ref.volume) / ref.volume) * 100;
    const vScore = volumeMatchScore(delta);
    volumeScoreSum += vScore;
    volumeMatchedCount += 1;
    positions.push({
      rateCode: ref.rateCode,
      rateTitle: title,
      unit,
      refVolume: ref.volume,
      studentVolume: sp.volume,
      deltaPct: delta,
      status: Math.abs(delta) <= 1 ? "match" : "off-volume",
      score: vScore,
    });
  }

  // Лишние позиции студента
  for (const sp of studentPositions) {
    if (refByCode.has(sp.rateCode)) continue;
    const rate = findRate(sp.rateCode);
    positions.push({
      rateCode: sp.rateCode,
      rateTitle: rate?.title ?? sp.rateCode,
      unit: rate?.unit ?? "",
      refVolume: 0,
      studentVolume: sp.volume,
      deltaPct: null,
      status: "extra",
      score: 0,
    });
  }

  const coverageScore = refPositions.length > 0 ? (matched / refPositions.length) * 100 : 100;
  const volumesScore = volumeMatchedCount > 0 ? volumeScoreSum / volumeMatchedCount : 0;
  const avgVolumeDelta = volumeMatchedCount > 0
    ? positions
        .filter((p) => p.deltaPct != null)
        .reduce((s, p) => s + Math.abs(p.deltaPct as number), 0) / volumeMatchedCount
    : 0;

  // 4. Total
  const refCalc = calcLsr(referenceLsr);
  const stuCalc = calcLsr(studentLsr);
  const totalDeltaPct = refCalc.totalWithVat > 0
    ? ((stuCalc.totalWithVat - refCalc.totalWithVat) / refCalc.totalWithVat) * 100
    : 0;
  const totalScore = totalMatchScore(totalDeltaPct);

  const finalScore =
    (aiScore * rubric.weights.ai +
      coverageScore * rubric.weights.coverage +
      volumesScore * rubric.weights.volumes +
      totalScore * rubric.weights.total) /
    (rubric.weights.ai + rubric.weights.coverage + rubric.weights.volumes + rubric.weights.total);

  const критерии = opts.starter ? критерииСпрятаннойОшибки(opts.starter, referenceLsr) : null;
  const невыполнены = критерии ? критерии.filter((k) => !k.выполнен(studentLsr)).map((k) => k.что) : [];
  const итог = критерии && невыполнены.length ? Math.min(finalScore, ПОТОЛОК_С_ОШИБКОЙ) : finalScore;
  return {
    score: Math.round(итог),
    grade: gradeFromScore(итог),
    hiddenError: критерии ? { fixed: невыполнены.length === 0, unmet: невыполнены } : null,
    breakdown: {
      ai: { score: Math.round(aiScore), weight: rubric.weights.ai, notices },
      coverage: {
        score: Math.round(coverageScore),
        weight: rubric.weights.coverage,
        matched,
        total: refPositions.length,
      },
      volumes: {
        score: Math.round(volumesScore),
        weight: rubric.weights.volumes,
        avgDeltaPct: avgVolumeDelta,
      },
      total: {
        score: Math.round(totalScore),
        weight: rubric.weights.total,
        deltaPct: totalDeltaPct,
      },
    },
    positions,
    refTotal: refCalc.totalWithVat,
    studentTotal: stuCalc.totalWithVat,
  };
}
