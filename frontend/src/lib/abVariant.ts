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

export type ABKey = "hero" | "tierCards";
export type ABValue = "A" | "B" | "C";

const VARIANT_KEYS: ABKey[] = ["hero", "tierCards"];
const DEFAULT_VARIANTS: Record<ABKey, ABValue> = {
  hero: "A",
  tierCards: "A",
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

/**
 * 🔴 КАКИЕ ВАРИАНТЫ РАЗРЕШЕНЫ ПО КЛЮЧУ (12.10.2026).
 *
 * Повод: вариант «C» ключа `hero` обещал на /pricing «14 ДНЕЙ FREE · NO CREDIT
 * CARD» и «Free trial 14 дней, Customer Success включён бесплатно». Триала
 * касса НЕ даёт — ни одного дня и ни по одному тарифу. Треть посетителей
 * страницы цен читала обещание, которого продукт не выполняет; это ровно тот
 * класс, который мы сами называем ложным обещанием на продающей странице.
 *
 * Опыт не «выключен» и не удалён: `hero` просто идёт двумя честными
 * вариантами. Вернуть третий можно будет тогда, когда триал появится в кассе,
 * — одной строкой здесь.
 */
const РАЗРЕШЁННЫЕ: Record<ABKey, ABValue[]> = {
  hero: ["A", "B"],
  tierCards: ["A", "B", "C"],
};

function pickRandom(key: ABKey): ABValue {
  const можно = РАЗРЕШЁННЫЕ[key];
  return можно[Math.floor(Math.random() * можно.length)] ?? "A";
}

function getOrAssign(key: ABKey): ABValue {
  const cookieName = COOKIE_PREFIX + key;
  const fromCookie = readCookie(cookieName);
  /*
   * Запрещённый вариант из КУКИ не принимается — иначе человек, которому «C»
   * достался до 12.10, продолжал бы видеть обещание триала ещё месяц: кука
   * живёт дольше правки. Починка, которая не достаёт до уже помеченных
   * посетителей, — половина починки.
   */
  const разрешён = (v: string | null): v is ABValue =>
    (v === "A" || v === "B" || v === "C") && РАЗРЕШЁННЫЕ[key].includes(v);
  if (разрешён(fromCookie)) {
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
  // Та же мера и для хранилища: запрещённый вариант оттуда тоже не принимаем.
  if (разрешён(fromLs)) {
    writeCookie(cookieName, fromLs, COOKIE_DAYS);
    return fromLs;
  }
  const newValue = pickRandom(key);
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
