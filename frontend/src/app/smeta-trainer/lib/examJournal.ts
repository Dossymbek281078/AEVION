"use client";

/**
 * Журнал попыток экзаменов — локальное хранение в localStorage.
 *
 * Каждая сдача сохраняется как ExamAttempt. По taskId можно получить best
 * и all attempts; по всем — агрегированная статистика.
 */

import type { ExamReport } from "./examGrader";

const STORAGE_KEY = "smeta-trainer:exam-journal:v1";

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
): ExamAttempt {
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
    ].join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
