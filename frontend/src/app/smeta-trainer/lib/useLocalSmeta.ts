"use client";

import { useState, useEffect, useCallback } from "react";
import type { Lsr } from "./types";

const STORAGE_KEY_PREFIX = "aevion-smeta-v2-";

function storageKey(lsrId: string) {
  return `${STORAGE_KEY_PREFIX}${lsrId}`;
}

export function useLocalSmeta(initial: Lsr): {
  lsr: Lsr;
  setLsr: (updater: Lsr | ((prev: Lsr) => Lsr)) => void;
  reset: () => void;
  hasSaved: boolean;
} {
  const key = storageKey(initial.id);

  const [lsr, setLsrState] = useState<Lsr>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Lsr;
        // Базовая проверка совместимости
        if (parsed.id === initial.id && Array.isArray(parsed.sections)) {
          return parsed;
        }
      }
    } catch {
      // ignore parse errors
    }
    return initial;
  });

  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const existing = localStorage.getItem(key);
      setHasSaved(!!existing);
    } catch {}
  }, [key]);

  // Сохранение при каждом изменении (debounce 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(key, JSON.stringify(lsr));
        setHasSaved(true);
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [lsr, key]);

  const setLsr = useCallback(
    (updater: Lsr | ((prev: Lsr) => Lsr)) => {
      setLsrState((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    []
  );

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    setLsrState(initial);
    setHasSaved(false);
  }, [key, initial]);

  return { lsr, setLsr, reset, hasSaved };
}
