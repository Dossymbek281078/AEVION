"use client";

import { useCallback, useEffect, useState } from "react";
import type { Ks2Period } from "./types";

/**
 * Общий store периодов КС-2 для конкретной ЛСР.
 * Используют Ks2View (read+write) и Ks3View (read для накопительной справки).
 */
const KEY_PREFIX = "aevion-smeta-ks2-v1:";

export function useKs2Periods(lsrId: string) {
  const key = KEY_PREFIX + lsrId;
  const [periods, setPeriodsState] = useState<Ks2Period[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setPeriodsState(JSON.parse(raw));
    } catch {}
  }, [key]);

  const setPeriods = useCallback(
    (updater: Ks2Period[] | ((prev: Ks2Period[]) => Ks2Period[])) => {
      setPeriodsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [key],
  );

  return { periods, setPeriods };
}
