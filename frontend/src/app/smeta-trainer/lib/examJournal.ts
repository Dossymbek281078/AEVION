"use client";

/**
 * Журнал попыток экзаменов — локальное хранение в localStorage.
 *
 * Каждая сдача сохраняется как ExamAttempt. По taskId можно получить best
 * и all attempts; по всем — агрегированная статистика.
 */

import type { ExamReport } from "./examGrader";
import { buildRemediation, type RemediationOptions } from "./examRemediation";

const STORAGE_KEY = "smeta-trainer:exam-journal:v1";

/** Компактная сводка «работы над ошибками», сохраняемая в попытку. */
export interface AttemptRemediation {
  high: number;
  medium: number;
  low: number;
  estimatedGain: number;
  summary: string;
  /** до 3 главных действий — чтобы студент видел, что чинить, не пересдавая */
  topActions: string[];
}

export interface ExamAttempt {
  id: string;
  taskId: string;
  taskTitle: string;
  score: number;
  grade: ExamReport["grade"];
  timestamp: string;
  breakdown: {
    ai: number;
    coverage: number;
    volumes: number;
    total: number;
  };
  noticesCount: number;
  studentTotal: number;
  refTotal: number;
  /** автоген «работа над ошибками» (отсутствует у старых записей) */
  remediation?: AttemptRemediation;
}

export interface JournalStats {
  totalAttempts: number;
  avgScore: number;
  excellentCount: number; // оценок «отлично»
  goodPlusCount: number;  // оценок «хорошо» и выше
  passedTasks: number;    // уникальных задач сданных хотя бы раз
  perTask: Map<string, { best: ExamAttempt; attempts: ExamAttempt[] }>;
}

function safeRead(): ExamAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExamAttempt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(attempts: ExamAttempt[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    /* quota / serialization */
  }
}

export function loadAttempts(): ExamAttempt[] {
  return safeRead();
}

export function saveAttempt(
  taskId: string,
  taskTitle: string,
  report: ExamReport,
  remOpts: RemediationOptions = {},
): ExamAttempt {
  const plan = buildRemediation(report, remOpts);
  const attempt: ExamAttempt = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    taskId,
    taskTitle,
    score: report.score,
    grade: report.grade,
    timestamp: new Date().toISOString(),
    breakdown: {
      ai: report.breakdown.ai.score,
      coverage: report.breakdown.coverage.score,
      volumes: report.breakdown.volumes.score,
      total: report.breakdown.total.score,
    },
    noticesCount: report.breakdown.ai.notices.length,
    studentTotal: report.studentTotal,
    refTotal: report.refTotal,
    remediation: {
      high: plan.bySeverity.high,
      medium: plan.bySeverity.medium,
      low: plan.bySeverity.low,
      estimatedGain: plan.estimatedGain,
      summary: plan.summary,
      topActions: plan.items.slice(0, 3).map((i) => i.action),
    },
  };
  const all = safeRead();
  all.push(attempt);
  safeWrite(all);
  return attempt;
}

export function bestAttempt(taskId: string): ExamAttempt | null {
  const all = safeRead().filter((a) => a.taskId === taskId);
  if (all.length === 0) return null;
  return all.reduce((best, a) => (a.score > best.score ? a : best));
}

/** Сколько уже было неудачных попыток (<70) по этому заданию. */
export function failedAttemptsCount(taskId: string, threshold = 70): number {
  return safeRead().filter((a) => a.taskId === taskId && a.score < threshold).length;
}

/** Сколько вообще попыток по заданию (для подсказок и метрик). */
export function attemptsForTask(taskId: string): number {
  return safeRead().filter((a) => a.taskId === taskId).length;
}

export function bestScores(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of safeRead()) {
    if (!(a.taskId in out) || a.score > out[a.taskId]) {
      out[a.taskId] = a.score;
    }
  }
  return out;
}

export function computeStats(): JournalStats {
  const all = safeRead();
  const perTask = new Map<string, { best: ExamAttempt; attempts: ExamAttempt[] }>();
  let scoreSum = 0;
  let excellentCount = 0;
  let goodPlusCount = 0;
  for (const a of all) {
    scoreSum += a.score;
    if (a.grade === "отлично") excellentCount += 1;
    if (a.grade === "отлично" || a.grade === "хорошо") goodPlusCount += 1;
    const slot = perTask.get(a.taskId);
    if (!slot) {
      perTask.set(a.taskId, { best: a, attempts: [a] });
    } else {
      slot.attempts.push(a);
      if (a.score > slot.best.score) slot.best = a;
    }
  }
  return {
    totalAttempts: all.length,
    avgScore: all.length > 0 ? scoreSum / all.length : 0,
    excellentCount,
    goodPlusCount,
    passedTasks: perTask.size,
    perTask,
  };
}

export function clearJournal(): void {
  safeWrite([]);
}

/** Агрегат повторяющихся замечаний студента по всем сдачам. */
export interface CommonMistake {
  action: string;
  count: number;
  /** в скольких разных заданиях встретилось */
  tasks: number;
}

export interface MistakeAggregate {
  /** топ повторяющихся пунктов «работы над ошибками» */
  items: CommonMistake[];
  /** суммарно значимых замечаний (high+medium) по всем сдачам */
  totalSignificant: number;
  /** сдач, где замечаний не было */
  cleanAttempts: number;
  attemptsAnalyzed: number;
}

/**
 * Что чаще всего «всплывает» у студента: агрегирует topActions работы над
 * ошибками по всем попыткам (с remediation). Чистая по входу — для аналитики.
 */
export function commonMistakes(attempts: ExamAttempt[]): MistakeAggregate {
  const byAction = new Map<string, { count: number; tasks: Set<string> }>();
  let totalSignificant = 0;
  let cleanAttempts = 0;
  let analyzed = 0;
  for (const a of attempts) {
    if (!a.remediation) continue;
    analyzed += 1;
    const sig = a.remediation.high + a.remediation.medium;
    totalSignificant += sig;
    if (sig === 0) cleanAttempts += 1;
    for (const action of a.remediation.topActions) {
      const slot = byAction.get(action) ?? { count: 0, tasks: new Set<string>() };
      slot.count += 1;
      slot.tasks.add(a.taskId);
      byAction.set(action, slot);
    }
  }
  const items: CommonMistake[] = Array.from(byAction.entries())
    .map(([action, v]) => ({ action, count: v.count, tasks: v.tasks.size }))
    .sort((x, y) => y.count - x.count || y.tasks - x.tasks);
  return { items, totalSignificant, cleanAttempts, attemptsAnalyzed: analyzed };
}

/** Динамика одной попытки относительно предыдущей сдачи того же задания. */
export interface AttemptProgress {
  attemptId: string;
  prevAttemptId: string | null;
  /** балл − балл прошлой попытки (null — первая сдача) */
  scoreDelta: number | null;
  /** (high+medium сейчас) − (было); отрицательное = стало лучше */
  issuesDelta: number | null;
  /** действия из прошлой работы над ошибками, которых больше нет = закрытые */
  resolvedActions: string[];
  /** действия, появившиеся впервые в этой попытке */
  newActions: string[];
}

function significantIssues(a: ExamAttempt): number {
  const r = a.remediation;
  return r ? r.high + r.medium : 0;
}

/**
 * Для каждой попытки считает динамику относительно предыдущей сдачи того же
 * задания (по времени): прирост балла, изменение числа значимых замечаний,
 * какие пункты «работы над ошибками» закрыты, а какие появились.
 */
export function remediationProgress(attempts: ExamAttempt[]): Map<string, AttemptProgress> {
  const byTask = new Map<string, ExamAttempt[]>();
  for (const a of attempts) {
    const arr = byTask.get(a.taskId) ?? [];
    arr.push(a);
    byTask.set(a.taskId, arr);
  }
  const out = new Map<string, AttemptProgress>();
  for (const arr of byTask.values()) {
    const chrono = arr.slice().sort((x, y) => x.timestamp.localeCompare(y.timestamp));
    for (let i = 0; i < chrono.length; i++) {
      const cur = chrono[i];
      const prev = i > 0 ? chrono[i - 1] : null;
      const curActions = new Set(cur.remediation?.topActions ?? []);
      const prevActions = new Set(prev?.remediation?.topActions ?? []);
      out.set(cur.id, {
        attemptId: cur.id,
        prevAttemptId: prev?.id ?? null,
        scoreDelta: prev ? cur.score - prev.score : null,
        issuesDelta: prev ? significantIssues(cur) - significantIssues(prev) : null,
        resolvedActions: prev ? [...prevActions].filter((x) => !curActions.has(x)) : [],
        newActions: prev ? [...curActions].filter((x) => !prevActions.has(x)) : [],
      });
    }
  }
  return out;
}

export function exportCsv(): string {
  const all = safeRead().slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const headers = [
    "timestamp",
    "taskId",
    "taskTitle",
    "score",
    "grade",
    "ai",
    "coverage",
    "volumes",
    "total",
    "notices",
    "studentTotal",
    "refTotal",
    "remHigh",
    "remMedium",
    "remGain",
  ];
  const rows = all.map((a) =>
    [
      a.timestamp,
      a.taskId,
      JSON.stringify(a.taskTitle),
      a.score,
      a.grade,
      a.breakdown.ai,
      a.breakdown.coverage,
      a.breakdown.volumes,
      a.breakdown.total,
      a.noticesCount,
      a.studentTotal.toFixed(2),
      a.refTotal.toFixed(2),
      a.remediation?.high ?? 0,
      a.remediation?.medium ?? 0,
      a.remediation?.estimatedGain ?? 0,
    ].join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
