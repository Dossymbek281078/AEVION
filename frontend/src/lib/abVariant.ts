"use client";

import { useEffect, useState } from "react";

/**
 * Простая A/B/C variant-система для GTM-страниц.
 * - Cookie + localStorage (cookie приоритет, если оба — sync)
 * - 30-дневный TTL, sticky после первого assignment
 * - Доступна на сервере (SSR) — возвращает default 'A' если cookie ещё не выставлен
 *
 * Расширение: чтобы добавить новый эксперимент — расширьте VARIANT_KEYS и
 * добавьте дефолт-значения в DEFAULT_VARIANTS.
 *
 * События `track()` должны передавать `variant` в `meta`, чтобы аналитика
 * могла агрегировать конверсии по варианту.
 */

export type ABKey = "hero";
export type ABValue = "A" | "B" | "C";

const VARIANT_KEYS: ABKey[] = ["hero"];
const DEFAULT_VARIANTS: Record<ABKey, ABValue> = {
  hero: "A",
};

const COOKIE_PREFIX = "aevion_ab_";
const COOKIE_DAYS = 30;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; samesite=lax`;
}

function pickRandom(): ABValue {
  const r = Math.random();
  if (r < 1 / 3) return "A";
  if (r < 2 / 3) return "B";
  return "C";
}

function getOrAssign(key: ABKey): ABValue {
  const cookieName = COOKIE_PREFIX + key;
  const fromCookie = readCookie(cookieName);
  if (fromCookie === "A" || fromCookie === "B" || fromCookie === "C") {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(cookieName, fromCookie);
      } catch {
        // localStorage может быть недоступен в private mode
      }
    }
    return fromCookie;
  }
  let fromLs: string | null = null;
  if (typeof window !== "undefined") {
    try {
      fromLs = window.localStorage.getItem(cookieName);
    } catch {
      fromLs = null;
    }
  }
  if (fromLs === "A" || fromLs === "B" || fromLs === "C") {
    writeCookie(cookieName, fromLs, COOKIE_DAYS);
    return fromLs;
  }
  const newValue = pickRandom();
  writeCookie(cookieName, newValue, COOKIE_DAYS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(cookieName, newValue);
    } catch {
      // ignore
    }
  }
  return newValue;
}

/**
 * React-hook: возвращает текущий variant.
 * На SSR — default. После hydrate в useEffect — assignment.
 */
export function useABVariant(key: ABKey): ABValue {
  const [variant, setVariant] = useState<ABValue>(DEFAULT_VARIANTS[key]);

  useEffect(() => {
    setVariant(getOrAssign(key));
  }, [key]);

  return variant;
}

/**
 * Получить все активные варианты — для передачи в track() meta.
 */
export function getAllVariants(): Record<string, ABValue> {
  const out: Record<string, ABValue> = {};
  for (const k of VARIANT_KEYS) {
    out[k] = getOrAssign(k);
  }
  return out;
}

/**
 * Утилита для дебага: посмотреть/принудительно установить вариант через консоль.
 * window.__aevion_ab.set('hero', 'B') / .get('hero') / .reset('hero')
 */
if (typeof window !== "undefined") {
  (window as unknown as { __aevion_ab: unknown }).__aevion_ab = {
    get: (k: ABKey) => readCookie(COOKIE_PREFIX + k),
    set: (k: ABKey, v: ABValue) => {
      writeCookie(COOKIE_PREFIX + k, v, COOKIE_DAYS);
      try {
        window.localStorage.setItem(COOKIE_PREFIX + k, v);
      } catch {
        // ignore
      }
      console.log(`[aevion-ab] ${k} → ${v} (reload to apply)`);
    },
    reset: (k: ABKey) => {
      writeCookie(COOKIE_PREFIX + k, "", -1);
      try {
        window.localStorage.removeItem(COOKIE_PREFIX + k);
      } catch {
        // ignore
      }
      console.log(`[aevion-ab] ${k} reset (reload to re-assign)`);
    },
    all: () => getAllVariants(),
  };
}
