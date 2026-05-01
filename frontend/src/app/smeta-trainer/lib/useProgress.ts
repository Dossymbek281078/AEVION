"use client";

import { useEffect, useState, useCallback } from "react";

export type LevelStatus = "locked" | "open" | "in-progress" | "done";

export interface LevelProgress {
  status: LevelStatus;
  score?: number;       // для уровней с тестами (0–100)
  completedAt?: string; // ISO date
  attempts?: number;
}

export interface CourseProgress {
  levels: Record<number, LevelProgress>;
  lastVisited?: number;
}

const KEY = "aevion-smeta-progress-v1";

const DEFAULT: CourseProgress = {
  levels: {
    1: { status: "open" },
    2: { status: "open" },
    3: { status: "open" },
    4: { status: "open" },
    5: { status: "open" },
  },
};

function load(): CourseProgress {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT;
}

function save(p: CourseProgress) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

export function useProgress() {
  const [progress, setProgress] = useState<CourseProgress>(load);

  const setLevel = useCallback((num: number, update: Partial<LevelProgress>) => {
    setProgress((prev) => {
      const next = {
        ...prev,
        levels: {
          ...prev.levels,
          [num]: { ...(prev.levels[num] ?? { status: "open" }), ...update },
        },
      };
      save(next);
      return next;
    });
  }, []);

  const markVisit = useCallback((num: number) => {
    setProgress((prev) => {
      const cur = prev.levels[num] ?? { status: "open" };
      if (cur.status === "open") {
        const next = { ...prev, lastVisited: num, levels: { ...prev.levels, [num]: { ...cur, status: "in-progress" as LevelStatus } } };
        save(next);
        return next;
      }
      const next = { ...prev, lastVisited: num };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => { save(DEFAULT); setProgress(DEFAULT); }, []);

  return { progress, setLevel, markVisit, reset };
}
