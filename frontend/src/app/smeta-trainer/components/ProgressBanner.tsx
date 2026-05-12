"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "smeta_trainer_progress_v1";
const TOTAL_LESSONS = 14;

function loadProgress(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw !== null ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : Math.min(Math.max(0, n), TOTAL_LESSONS);
  } catch {
    return 0;
  }
}

export function saveProgress(n: number): void {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.min(Math.max(0, n), TOTAL_LESSONS);
    localStorage.setItem(STORAGE_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent("smeta-lesson-progress-update"));
  } catch {}
}

export function incrementProgress(): void {
  const cur = loadProgress();
  if (cur < TOTAL_LESSONS) saveProgress(cur + 1);
}

export function ProgressBanner() {
  const [done, setDone] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setDone(loadProgress());
  }, []);

  useEffect(() => {
    setDone(loadProgress());
    setHydrated(true);
    window.addEventListener("smeta-lesson-progress-update", refresh);
    return () => window.removeEventListener("smeta-lesson-progress-update", refresh);
  }, [refresh]);

  const pct = Math.round((done / TOTAL_LESSONS) * 100);

  if (!hydrated) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          Урок {done}/{TOTAL_LESSONS} пройден
        </span>
        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100
                ? "linear-gradient(90deg, #10b981, #059669)"
                : pct > 50
                ? "linear-gradient(90deg, #3b82f6, #10b981)"
                : "linear-gradient(90deg, #6366f1, #3b82f6)",
            }}
          />
        </div>
        <span className="text-[10px] text-slate-400 shrink-0 font-mono w-8 text-right">
          {pct}%
        </span>
        {done > 0 && done < TOTAL_LESSONS && (
          <button
            onClick={() => {
              if (confirm("Сбросить счётчик пройденных уроков?")) {
                saveProgress(0);
              }
            }}
            className="text-[10px] text-slate-400 hover:text-red-500 shrink-0"
            title="Сбросить прогресс"
          >
            ✕
          </button>
        )}
        {done === TOTAL_LESSONS && (
          <span className="text-[10px] text-emerald-600 font-bold shrink-0">Курс завершён!</span>
        )}
      </div>
    </div>
  );
}
