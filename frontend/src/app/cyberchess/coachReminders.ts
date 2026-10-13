/**
 * Напоминания о повторении изученного (1 / 3 / 7 дней). Вынесены из coachKnowledge.ts
 * волной 122 (13.10.2026): page.tsx звал getDueReminders на старте и этим тянул весь
 * модуль знаний тренера (чанк ~45 КБ сжатого) в путь до первого возможного хода.
 * Здесь только localStorage — без данных.
 */
type ReminderState = {
  v: 1;
  // entryId → { firstStudyAt: ISO, dismissedMilestones: number[] (1, 3, 7) }
  entries: Record<string, { firstStudyAt: string; dismissed: number[] }>;
};

const REMINDER_KEY = "aevion_coach_reminders_v1";

export function ldReminderState(): ReminderState {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (!raw) return { v: 1, entries: {} };
    const r = JSON.parse(raw);
    if (r?.v === 1) return r;
  } catch {}
  return { v: 1, entries: {} };
}

export function svReminderState(s: ReminderState) {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(s)) } catch {}
}

/** Mark an entry as first-studied today (does nothing if already marked). */
export function markFirstStudy(entryId: string): ReminderState {
  const cur = ldReminderState();
  if (cur.entries[entryId]) return cur;
  cur.entries[entryId] = { firstStudyAt: new Date().toISOString(), dismissed: [] };
  svReminderState(cur);
  return cur;
}

/** Mark a specific milestone (1/3/7) as dismissed for an entry. */
export function dismissReminder(entryId: string, milestone: 1 | 3 | 7): ReminderState {
  const cur = ldReminderState();
  if (!cur.entries[entryId]) return cur;
  if (!cur.entries[entryId].dismissed.includes(milestone)) {
    cur.entries[entryId].dismissed.push(milestone);
  }
  svReminderState(cur);
  return cur;
}

/**
 * Return entries with due milestones right now.
 * dueMilestone = 1/3/7 days passed since firstStudyAt and milestone not yet dismissed.
 */
export function getDueReminders(): Array<{ entryId: string; milestone: 1 | 3 | 7; daysSinceStudy: number }> {
  const cur = ldReminderState();
  const now = Date.now();
  const out: Array<{ entryId: string; milestone: 1 | 3 | 7; daysSinceStudy: number }> = [];
  for (const [entryId, info] of Object.entries(cur.entries)) {
    const ageMs = now - new Date(info.firstStudyAt).getTime();
    const days = ageMs / 86400000;
    for (const ms of [1, 3, 7] as const) {
      if (days >= ms && !info.dismissed.includes(ms)) {
        out.push({ entryId, milestone: ms, daysSinceStudy: Math.floor(days) });
      }
    }
  }
  return out;
}
