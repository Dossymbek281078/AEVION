// Client-side recurring payments — subscriptions, salaries, scheduled transfers.
// Stored in localStorage and executed by useRecurring hook every 30s.
// TODO backend: POST /api/qtrade/recurring for server-side cron execution
// (so schedules run even when browser is closed). For demo this is client-only.

const STORAGE_KEY = "aevion_bank_recurring_v1";

export type RecurrencePeriod = "daily" | "weekly" | "biweekly" | "monthly";

export type Recurring = {
  id: string;
  toAccountId: string;
  recipientNickname: string;
  amount: number;
  period: RecurrencePeriod;
  label: string;
  startsAt: string;
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
  createdAt: string;
  runs: number;
};

export const PERIOD_LABEL: Record<RecurrencePeriod, string> = {
  daily: "daily",
  weekly: "weekly",
  biweekly: "bi-weekly",
  monthly: "monthly",
};

export function addPeriod(from: Date, period: RecurrencePeriod): Date {
  const d = new Date(from);
  switch (period) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

function isRecurring(x: unknown): x is Recurring {
  if (!x || typeof x !== "object") return false;
  const r = x as Partial<Recurring>;
  return (
    typeof r.id === "string" &&
    typeof r.toAccountId === "string" &&
    typeof r.amount === "number" &&
    typeof r.period === "string" &&
    typeof r.label === "string" &&
    typeof r.nextRunAt === "string" &&
    typeof r.active === "boolean"
  );
}

export function loadRecurring(): Recurring[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isRecurring);
  } catch {
    return [];
  }
}

export function saveRecurring(items: Recurring[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage quota — best effort
  }
}

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function formatCountdown(iso: string, tr?: Translator): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const diff = ms - Date.now();
  if (diff <= 0) return tr ? tr("rec.countdown.due") : "due now";
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return tr ? tr("rec.countdown.dh", { days, hours: hours % 24 }) : `in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return tr ? tr("rec.countdown.hm", { hours, minutes: mins % 60 }) : `in ${hours}h ${mins % 60}m`;
  }
  const m = Math.max(1, mins);
  return tr ? tr("rec.countdown.m", { minutes: m }) : `in ${m}m`;
}

export function formatPast(iso: string | null, tr?: Translator): string {
  if (!iso) return tr ? tr("rec.past.never") : "never run";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return tr ? tr("rec.past.d", { days }) : `ran ${days}d ago`;
  if (hours > 0) return tr ? tr("rec.past.h", { hours }) : `ran ${hours}h ago`;
  if (mins > 0) return tr ? tr("rec.past.m", { minutes: mins }) : `ran ${mins}m ago`;
  return tr ? tr("rec.past.justNow") : "ran just now";
}
