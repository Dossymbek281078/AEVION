"use client";

/**
 * Spaced Repetition (SM-2-lite) для уроков курса.
 *
 * Идея: после первого успешного прохождения урока (все квизы на 100%) урок
 * попадает в очередь повторения с интервалом 1 день. При каждом успешном
 * повторе интервал растёт: 1 → 3 → 7 → 14 → 30 → 60 → 120 дней.
 * При неуспешном (quizScore < 100) — сброс на интервал 1.
 *
 * Состояние храним отдельно от lessonProgress (тот фиксирует факт прохождения,
 * а здесь — историю повторений).
 */

import { LESSONS, loadLessonProgress } from "./lessons";

const KEY = "aevion-smeta-srep-v1";

/** Интервалы повторения в днях. */
export const INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewState {
  lessonId: string;
  /** Кол-во успешных повторов (0 = только что добавлен). */
  reps: number;
  /** Timestamp последнего ревью / добавления. */
  lastReviewTs: number;
  /** Лучший quizScore по этому уроку. */
  bestScore: number;
}

export function loadReviewStates(): Record<string, ReviewState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, ReviewState>) : {};
  } catch {
    return {};
  }
}

function saveReviewStates(states: Record<string, ReviewState>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(states));
  } catch {}
}

/** Записать результат ревью. Вызывается из LessonViewer после checkAll. */
export function recordReview(lessonId: string, quizScore: number): void {
  if (typeof window === "undefined") return;
  const states = loadReviewStates();
  const prev = states[lessonId];
  const success = quizScore >= 100;
  if (!prev) {
    // Первое прохождение — попадаем в очередь только если quizScore == 100
    if (success) {
      states[lessonId] = {
        lessonId,
        reps: 0,
        lastReviewTs: Date.now(),
        bestScore: quizScore,
      };
    }
  } else {
    states[lessonId] = {
      lessonId,
      reps: success ? prev.reps + 1 : 0, // сброс при неуспехе
      lastReviewTs: Date.now(),
      bestScore: Math.max(prev.bestScore, quizScore),
    };
  }
  saveReviewStates(states);
  window.dispatchEvent(new CustomEvent("aevion-smeta-progress-update"));
}

/** Получить интервал в днях для записи. */
export function intervalFor(state: ReviewState): number {
  return INTERVALS_DAYS[Math.min(state.reps, INTERVALS_DAYS.length - 1)];
}

/** Когда урок «созреет» для следующего повторения. */
export function dueAt(state: ReviewState): number {
  return state.lastReviewTs + intervalFor(state) * DAY_MS;
}

export interface DueLesson {
  lessonId: string;
  level: number;
  title: string;
  /** Сколько дней просрочено (отрицательное = ещё не созрел). */
  overdueDays: number;
  /** Текущий интервал в днях. */
  intervalDays: number;
  reps: number;
}

/**
 * Список уроков, которые «пора повторять» сегодня. Сортировка: самые
 * просроченные сверху.
 */
export function computeDueToday(): DueLesson[] {
  const states = loadReviewStates();
  const now = Date.now();
  const out: DueLesson[] = [];
  for (const state of Object.values(states)) {
    const due = dueAt(state);
    if (due > now) continue;
    const lesson = LESSONS.find((l) => l.id === state.lessonId);
    if (!lesson) continue;
    const overdueDays = Math.floor((now - due) / DAY_MS);
    out.push({
      lessonId: state.lessonId,
      level: lesson.level,
      title: lesson.title,
      overdueDays,
      intervalDays: intervalFor(state),
      reps: state.reps,
    });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays);
}

/**
 * Backward-compat: одноразовая инициализация SR-state для уроков, которые уже
 * были пройдены (на 100%) до раскатки фичи. Безопасно вызывать повторно — мы
 * не перезаписываем существующие записи.
 */
export function backfillFromLessonProgress(): void {
  if (typeof window === "undefined") return;
  const states = loadReviewStates();
  const lp = loadLessonProgress();
  let changed = false;
  for (const [lessonId, p] of Object.entries(lp)) {
    if (states[lessonId]) continue;
    if (p.completed && p.quizScore === 100) {
      states[lessonId] = {
        lessonId,
        reps: 0,
        lastReviewTs: p.ts ?? Date.now(),
        bestScore: p.quizScore,
      };
      changed = true;
    }
  }
  if (changed) saveReviewStates(states);
}

/** Удалить запись (если урок удалён или сбросить очередь). */
export function removeReview(lessonId: string): void {
  if (typeof window === "undefined") return;
  const states = loadReviewStates();
  if (lessonId in states) {
    delete states[lessonId];
    saveReviewStates(states);
    window.dispatchEvent(new CustomEvent("aevion-smeta-progress-update"));
  }
}
