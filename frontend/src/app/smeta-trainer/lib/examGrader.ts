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

export interface ExamReport {
  score: number; // 0-100 итог
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
): ExamReport {
  // 1. AI
  const notices = runAiAdvisor(studentLsr, object);
  const penalty = notices.reduce((s, n) => s + noticeWeight(n.severity), 0);
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

  return {
    score: Math.round(finalScore),
    grade: gradeFromScore(finalScore),
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
