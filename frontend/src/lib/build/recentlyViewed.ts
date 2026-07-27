// Tiny localStorage-backed log of vacancies the user has visited.
// Cap at 10 entries; recency-ordered (most-recent first).

export type RecentVacancy = {
  id: string;
  title: string;
  salary: number;
  /**
   * Валюта записывается вместе с суммой: без неё карточка «недавно
   * просмотренных» форматировала зарплату дефолтной валютой и показывала
   * доллары рублями (гигиена витрины, 27.07).
   *
   * Необязательное: записи, сделанные до этой правки, поля не имеют —
   * formatSalary для них ведёт себя как прежде, и они вытесняются по мере
   * просмотра новых.
   */
  salaryCurrency?: string | null;
  city: string | null;
  ts: number;
};

const KEY = "qbuild.recentlyViewed.v1";
const MAX = 10;

function read(): RecentVacancy[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentVacancy[];
    return Array.isArray(parsed) ? parsed.filter((x) => x?.id && x?.title) : [];
  } catch {
    return [];
  }
}

export function recordVacancyView(v: {
  id: string;
  title: string;
  salary: number;
  salaryCurrency?: string | null;
  city?: string | null;
}) {
  if (typeof window === "undefined") return;
  const items = read().filter((x) => x.id !== v.id);
  items.unshift({
    id: v.id,
    title: v.title.slice(0, 80),
    salary: v.salary || 0,
    salaryCurrency: v.salaryCurrency ?? null,
    city: v.city ?? null,
    ts: Date.now(),
  });
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // Quota or private mode — silent ignore.
  }
}

export function getRecentVacancies(): RecentVacancy[] {
  return read();
}

export function clearRecentVacancies() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
