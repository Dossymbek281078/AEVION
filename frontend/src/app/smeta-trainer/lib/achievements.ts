"use client";

// Достижения курса. Все определяются производным от состояния
// (CourseProgress + LessonProgress) — никаких отдельных событий.
// Когда состояние меняется, computeEarned() пересчитывает множество, и
// AchievementToast показывает разницу с предыдущим сохранённым множеством.

import type { CourseProgress } from "./useProgress";
import type { LessonProgress } from "./lessons";
import { LEVELS } from "./levels";
import { getLessonsForLevel } from "./lessons";
import { PRACTICE_EXERCISES, loadPracticeProgress } from "./practiceExercises";
import { currentStreak } from "./streak";

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** Сколько раз должно быть выполнено для получения (для прогресс-бара). */
  threshold?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-lesson",       icon: "🎯", title: "Первый шаг",          description: "Завершён первый урок теории" },
  { id: "level1-theory",      icon: "📖", title: "С нуля",              description: "Все уроки уровня 1 пройдены" },
  { id: "level2-theory",      icon: "✍️", title: "Сметчик",             description: "Все уроки уровня 2 пройдены" },
  { id: "level3-theory",      icon: "📊", title: "ПТО",                 description: "Все уроки уровня 3 пройдены" },
  { id: "level4-theory",      icon: "📐", title: "Проектировщик",       description: "Все уроки уровня 4 пройдены" },
  { id: "level5-theory",      icon: "🔬", title: "Эксперт",             description: "Все уроки уровня 5 пройдены" },
  { id: "all-theory",         icon: "🎓", title: "Магистр теории",      description: "Все уроки курса пройдены (47 штук)" },
  { id: "perfectionist",      icon: "💯", title: "Перфекционист",       description: "5 уроков сданы со 100% по тестам" },
  { id: "first-zachet",       icon: "🥇", title: "Первый зачёт",        description: "Получен первый зачёт уровня" },
  { id: "course-complete",    icon: "🏆", title: "Курс пройден",        description: "Все 5 уровней зачтены — сертификат доступен" },
  { id: "detective",          icon: "🕵️", title: "Детектив",            description: "Все 7 упражнений «найди ошибку» в практике решены" },
  { id: "capstone-pass",      icon: "📜", title: "Капстоун-зачёт",      description: "Сдан финальный экзамен между Уровнями 4 и 5" },
  { id: "streak-7",           icon: "🔥", title: "Неделя подряд",       description: "7 дней активности подряд" },
  { id: "streak-30",          icon: "🌟", title: "Месяц подряд",        description: "30 дней активности подряд — настоящая дисциплина" },
];

const STORAGE_KEY = "aevion-smeta-achievements-v1";

/** Считаем, какие достижения должны быть получены при текущем состоянии. */
export function computeEarned(
  progress: CourseProgress,
  lessonProgress: Record<string, LessonProgress>,
): Set<string> {
  const earned = new Set<string>();

  // ── Уроки ──
  const completedLessons = Object.values(lessonProgress).filter((p) => p.completed);
  if (completedLessons.length >= 1) earned.add("first-lesson");

  for (let lvl = 1; lvl <= 5; lvl++) {
    const lessons = getLessonsForLevel(lvl);
    if (lessons.length === 0) continue;
    const allDone = lessons.every((l) => lessonProgress[l.id]?.completed);
    if (allDone) earned.add(`level${lvl}-theory`);
  }

  // Все 32 урока пройдены
  const totalLessons = LEVELS.reduce(
    (s, lv) => s + getLessonsForLevel(lv.num).length,
    0,
  );
  if (totalLessons > 0 && completedLessons.length === totalLessons) {
    earned.add("all-theory");
  }

  // 5 уроков с 100% по тестам
  const perfect = Object.values(lessonProgress).filter((p) => p.quizScore === 100).length;
  if (perfect >= 5) earned.add("perfectionist");

  // ── Зачёты уровней ──
  const doneLevels = LEVELS.filter((lv) => progress.levels[lv.num]?.status === "done").length;
  if (doneLevels >= 1) earned.add("first-zachet");
  if (doneLevels === LEVELS.length) earned.add("course-complete");

  // ── Практика ──
  const practice = loadPracticeProgress();
  const solvedAll = PRACTICE_EXERCISES.every((ex) => practice[ex.id]?.correct);
  if (PRACTICE_EXERCISES.length > 0 && solvedAll) earned.add("detective");

  // ── Капстоун (хранится отдельным флагом) ──
  if (typeof window !== "undefined") {
    try {
      if (localStorage.getItem("aevion-smeta-capstone-pass-v1") === "true") {
        earned.add("capstone-pass");
      }
    } catch {}
  }

  // ── Streak ──
  if (typeof window !== "undefined") {
    const streak = currentStreak();
    if (streak >= 7) earned.add("streak-7");
    if (streak >= 30) earned.add("streak-30");
  }

  return earned;
}

/** Хранилище: множество уже «увиденных» (показанных тостом) достижений. */
export function loadSeenAchievements(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveSeenAchievements(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {}
}

/** Событие, которое diss-patches при изменении прогресса (уроки/уровни). */
export const PROGRESS_EVENT = "aevion-smeta-progress-update";

export function notifyProgressUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
}
