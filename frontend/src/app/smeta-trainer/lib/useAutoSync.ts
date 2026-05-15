"use client";

import { useEffect, useRef } from "react";
import { useStudent } from "./useStudent";
import {
  pingBackend,
  syncProgress,
  syncLessons,
  syncPractice,
  syncCapstone,
  syncAchievements,
} from "./progressApi";
import { loadLessonProgress } from "./lessons";
import { loadPracticeProgress } from "./practiceExercises";
import { computeEarned } from "./achievements";

const SYNC_DEBOUNCE_MS = 2500;
const PROGRESS_KEY = "aevion-smeta-progress-v1";
const CAPSTONE_KEY = "aevion-smeta-capstone-pass-v1";
const LAST_SYNC_KEY = "aevion-smeta-last-sync-v1";

interface SyncSnapshot {
  levels: string;       // JSON
  lessons: string;
  practice: string;
  capstone: boolean;
  achievements: string; // JSON sorted
}

function snapshot(): SyncSnapshot {
  if (typeof window === "undefined") {
    return { levels: "{}", lessons: "{}", practice: "{}", capstone: false, achievements: "[]" };
  }
  let levels: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      levels = parsed.levels ?? {};
    }
  } catch {}
  const lessons = loadLessonProgress();
  const practice = loadPracticeProgress();
  let capstone = false;
  try { capstone = localStorage.getItem(CAPSTONE_KEY) === "true"; } catch {}
  const earned = [...computeEarned(
    { levels: levels as Record<number, { status: "open" | "in-progress" | "done" | "locked" }> },
    lessons,
  )].sort();
  return {
    levels: JSON.stringify(levels),
    lessons: JSON.stringify(lessons),
    practice: JSON.stringify(practice),
    capstone,
    achievements: JSON.stringify(earned),
  };
}

function loadLastSnapshot(): SyncSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? (JSON.parse(raw) as SyncSnapshot) : null;
  } catch { return null; }
}

function saveLastSnapshot(s: SyncSnapshot): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(s)); } catch {}
}

/**
 * Auto-sync — на каждое событие `aevion-smeta-progress-update` (debounced 2.5s)
 * сравнивает snapshot прогресса с последним синхронизированным и шлёт на бэк
 * только то, что изменилось. Тихо отваливается если бэкенд недоступен.
 *
 * Использование: вмонтировать один раз в layout.tsx (как AchievementToast).
 */
export function AutoSyncBridge() {
  const { student } = useStudent();
  const studentRef = useRef(student);
  studentRef.current = student;
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(false);

  useEffect(() => {
    let aliveBackend: boolean | null = null;

    async function ensureBackend() {
      if (aliveBackend === null) {
        aliveBackend = await pingBackend();
      }
      return aliveBackend;
    }

    async function doSync() {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        if (!(await ensureBackend())) return;
        const cur = snapshot();
        const last = loadLastSnapshot();
        const changed = !last
          || last.levels !== cur.levels
          || last.lessons !== cur.lessons
          || last.practice !== cur.practice
          || last.capstone !== cur.capstone
          || last.achievements !== cur.achievements;
        if (!changed) return;

        const s = studentRef.current;
        const displayName = s.name || undefined;
        const group = s.group || undefined;

        // Levels
        if (!last || last.levels !== cur.levels) {
          const parsedLevels = JSON.parse(cur.levels) as Record<string, { status: "open" | "in-progress" | "done" | "locked"; score?: number; completedAt?: string; attempts?: number }>;
          await syncProgress(
            { levels: parsedLevels as never },
            displayName,
            group,
          );
        }
        // Lessons
        if (!last || last.lessons !== cur.lessons) {
          const lp = JSON.parse(cur.lessons) as Record<string, { completed: boolean; quizScore?: number; ts: number }>;
          if (Object.keys(lp).length > 0) await syncLessons(lp);
        }
        // Practice
        if (!last || last.practice !== cur.practice) {
          const pp = JSON.parse(cur.practice) as Record<string, { correct: boolean; attempts: number; ts: number }>;
          if (Object.keys(pp).length > 0) await syncPractice(pp);
        }
        // Capstone
        if (!last || last.capstone !== cur.capstone) {
          await syncCapstone(cur.capstone);
        }
        // Achievements
        if (!last || last.achievements !== cur.achievements) {
          const ach = JSON.parse(cur.achievements) as string[];
          if (ach.length > 0) await syncAchievements(ach);
        }
        saveLastSnapshot(cur);
      } catch {
        // тихо игнорируем — backend offline или временная ошибка
      } finally {
        inflightRef.current = false;
      }
    }

    function schedule() {
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(doSync, SYNC_DEBOUNCE_MS);
    }

    // Первичная синхронизация при монтировании (когда вкладка открывается со старыми данными)
    schedule();

    function onUpdate() { schedule(); }
    window.addEventListener("aevion-smeta-progress-update", onUpdate);
    return () => {
      window.removeEventListener("aevion-smeta-progress-update", onUpdate);
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  return null;
}
