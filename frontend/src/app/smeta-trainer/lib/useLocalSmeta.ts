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

  // ⚠️  Всегда начинаем с `initial` — это устраняет hydration mismatch.
  //     localStorage читается в useEffect ПОСЛЕ гидрации.
  const [lsr, setLsrState]   = useState<Lsr>(initial);
  const [hasSaved, setHasSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Загрузка из localStorage после монтирования
  useEffect(() => {
    setHydrated(true);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Lsr;
        if (parsed.id === initial.id && Array.isArray(parsed.sections)) {
          setLsrState(parsed);
          setHasSaved(true);
          return;
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Автосохранение (debounce 500ms) — только после гидрации
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(lsr));
        setHasSaved(true);
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [lsr, key, hydrated]);

  const setLsr = useCallback(
    (updater: Lsr | ((prev: Lsr) => Lsr)) => {
      setLsrState((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    []
  );

  const reset = useCallback(() => {
    try { localStorage.removeItem(key); } catch {}
    setLsrState(initial);
    setHasSaved(false);
  }, [key, initial]);

  return { lsr, setLsr, reset, hasSaved };
}
