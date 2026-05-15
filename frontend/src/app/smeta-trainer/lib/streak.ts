"use client";

/**
 * Daily streak tracker — считает последовательные дни активности студента.
 * Активность = любой quiz check (saveLessonProgress / recordReview / capstone).
 *
 * Хранит:
 *  - days: Set<YYYY-MM-DD> — все дни, в которые была активность
 *  - lastSeen: timestamp последней активности (для UI)
 *
 * Streak = последовательные дни до сегодня (или вчера, если сегодня ещё не было).
 */

const KEY = "aevion-smeta-streak-v1";

interface StreakStore {
  /** Множество дат «YYYY-MM-DD». */
  days: string[];
  lastSeen: number;
}

function isoDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function loadStore(): StreakStore {
  if (typeof window === "undefined") return { days: [], lastSeen: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StreakStore;
  } catch {}
  return { days: [], lastSeen: 0 };
}

function saveStore(s: StreakStore): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** Зафиксировать активность сегодня. Вызывается из всех мест, где
 *  студент «делает что-то учебное». Идемпотентно — повторный вызов в тот же
 *  день не добавляет дубликата. */
export function markActivity(): void {
  if (typeof window === "undefined") return;
  const today = isoDate(Date.now());
  const s = loadStore();
  if (!s.days.includes(today)) {
    s.days.push(today);
    // Обрезаем хранилище до 365 дней для ограничения роста
    if (s.days.length > 365) s.days = s.days.slice(-365);
  }
  s.lastSeen = Date.now();
  saveStore(s);
  window.dispatchEvent(new CustomEvent("aevion-smeta-progress-update"));
}

/** Текущий streak: сколько последовательных дней до сегодня (или вчера). */
export function currentStreak(): number {
  const s = loadStore();
  if (s.days.length === 0) return 0;
  const set = new Set(s.days);
  const today = isoDate(Date.now());
  // Если сегодня ещё нет активности, начинаем со вчера
  let cursor = new Date();
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(isoDate(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Самый длинный streak за всё время. */
export function longestStreak(): number {
  const s = loadStore();
  if (s.days.length === 0) return 0;
  const sorted = [...new Set(s.days)].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1]);
    const b = new Date(sorted[i]);
    const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
    if (diff === 1) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

/** Дни активности за последние N дней (для heatmap). */
export function activeDaysSet(): Set<string> {
  return new Set(loadStore().days);
}
