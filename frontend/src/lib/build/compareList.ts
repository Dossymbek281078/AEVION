// Persistent "compare these vacancies" selection (max 3, localStorage-backed).
// Decoupled from the feed page so the sticky bar can mount on any /build/* route
// and read the same state.

const KEY = "qbuild.compare.v1";
const MAX = 3;

export type CompareEntry = {
  id: string;
  title: string;
  salary: number;
  city?: string | null;
};

export function readCompare(): CompareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX) as CompareEntry[];
  } catch {
    return [];
  }
}

export function writeCompare(items: CompareEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent("qbuild-compare-change"));
  } catch {
    // ignore
  }
}

export function toggleCompare(entry: CompareEntry): CompareEntry[] {
  const cur = readCompare();
  const next = cur.find((e) => e.id === entry.id)
    ? cur.filter((e) => e.id !== entry.id)
    : [entry, ...cur].slice(0, MAX);
  writeCompare(next);
  return next;
}

export function isCompareFull(): boolean {
  return readCompare().length >= MAX;
}

export const COMPARE_MAX = MAX;
