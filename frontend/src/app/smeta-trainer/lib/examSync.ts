/**
 * Синхронизация экзаменационных сдач с backend прогресса (/api/smeta-trainer).
 *
 * Журнал экзаменов локальный (localStorage), но сдачи дублируются на сервер как
 * attempt kind="lsr-submit" — чтобы куратор видел результаты в leaderboard/stats.
 * Fire-and-forget: офлайн / нет бэкенда → молча игнорируем, локальный журнал цел.
 */

import type { ExamReport } from "./examGrader";
import { recordAttempt } from "./progressApi";

/** Экзамены — высший (экзаменационный) уровень курса. */
export const EXAM_LEVEL = 5;

export interface ExamAttemptSync {
  level: number;
  score: number;
  payload: {
    taskId: string;
    taskTitle: string;
    grade: ExamReport["grade"];
    coverage: { matched: number; total: number };
    notices: number;
    totalDeltaPct: number;
  };
  feedback: string;
}

/** Готовит компактную нагрузку для backend-attempt из отчёта экзамена (чистая). */
export function buildExamAttemptPayload(
  taskId: string,
  taskTitle: string,
  report: ExamReport,
): ExamAttemptSync {
  const cov = report.breakdown.coverage;
  const feedback =
    `${report.grade} · ${report.score}/100 · ` +
    `покрытие ${cov.matched}/${cov.total} · ` +
    `замечаний ${report.breakdown.ai.notices.length} · ` +
    `Δ итога ${report.breakdown.total.deltaPct.toFixed(1)}%`;
  return {
    level: EXAM_LEVEL,
    score: report.score,
    payload: {
      taskId,
      taskTitle,
      grade: report.grade,
      coverage: { matched: cov.matched, total: cov.total },
      notices: report.breakdown.ai.notices.length,
      totalDeltaPct: report.breakdown.total.deltaPct,
    },
    feedback,
  };
}

/** Отправляет сдачу на сервер; никогда не бросает (бэкенд опционален). */
export async function syncExamAttempt(
  taskId: string,
  taskTitle: string,
  report: ExamReport,
): Promise<boolean> {
  const a = buildExamAttemptPayload(taskId, taskTitle, report);
  try {
    await recordAttempt(a.level, "lsr-submit", a.score, a.payload, a.feedback);
    return true;
  } catch {
    return false; // BackendUnavailableError и пр. — тихо
  }
}
