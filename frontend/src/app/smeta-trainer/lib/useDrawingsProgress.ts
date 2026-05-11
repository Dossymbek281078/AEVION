"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "aevion-smeta-drawings-v1";

export interface DrawingsProgress {
  /** Кол-во завершённых базовых упражнений (L2). */
  basicDone: number;
  basicTotal: number;
  /** Кол-во завершённых продвинутых упражнений (L4). */
  advancedDone: number;
  advancedTotal: number;
  /** Кол-во найденных ошибок (L5). */
  errorsDone: number;
  errorsTotal: number;
  lastUpdated: number;
}

const DEFAULTS: DrawingsProgress = {
  basicDone: 0, basicTotal: 5,
  advancedDone: 0, advancedTotal: 6,  // 3 основных + 3 фундамент
  errorsDone: 0, errorsTotal: 3,
  lastUpdated: 0,
};

export function loadDrawingsProgress(): DrawingsProgress {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function saveDrawingsProgress(p: Partial<DrawingsProgress>): void {
  if (typeof window === "undefined") return;
  try {
    const cur = loadDrawingsProgress();
    localStorage.setItem(KEY, JSON.stringify({ ...cur, ...p, lastUpdated: Date.now() }));
    window.dispatchEvent(new CustomEvent("aevion-smeta-progress-update"));
  } catch {}
}

export function useDrawingsProgress() {
  const [progress, setProgress] = useState<DrawingsProgress>(DEFAULTS);

  useEffect(() => {
    setProgress(loadDrawingsProgress());
    function onUpdate() { setProgress(loadDrawingsProgress()); }
    window.addEventListener("aevion-smeta-progress-update", onUpdate);
    return () => window.removeEventListener("aevion-smeta-progress-update", onUpdate);
  }, []);

  const update = useCallback((p: Partial<DrawingsProgress>) => {
    saveDrawingsProgress(p);
    setProgress(loadDrawingsProgress());
  }, []);

  const totalDone = progress.basicDone + progress.advancedDone + progress.errorsDone;
  const totalAll  = progress.basicTotal + progress.advancedTotal + progress.errorsTotal;
  const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  return { progress, update, totalDone, totalAll, pct };
}
