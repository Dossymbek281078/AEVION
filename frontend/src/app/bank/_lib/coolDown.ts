// Cool-down Queue — anti-impulse 24h hold for "non-essential" outflows.
// User parks an intended payment with a label + amount; once the hold
// expires they can release it (executes via send) or cancel it. Pure
// localStorage so the moment of clarity is built into the flow.

const STORAGE_KEY = "aevion_bank_cooldown_v1";
export const COOLDOWN_EVENT = "aevion:cooldown-changed";

export type CoolDownItem = {
  id: string;
  to: string;
  amount: number;
  label: string;
  reason: string;
  createdAt: string;
  releaseAt: string;
  status: "waiting" | "ready" | "released" | "cancelled";
  releasedOpId: string | null;
  cancelledAt: string | null;
};

export const DEFAULT_HOLD_HOURS = 24;
export const HOLD_OPTIONS = [12, 24, 48, 72] as const;
export type HoldHours = (typeof HOLD_OPTIONS)[number];

function isItem(x: unknown): x is CoolDownItem {
  if (!x || typeof x !== "object") return false;
  const i = x as Partial<CoolDownItem>;
  return (
    typeof i.id === "string" &&
    typeof i.to === "string" &&
    typeof i.amount === "number" &&
    typeof i.label === "string" &&
    typeof i.reason === "string" &&
    typeof i.createdAt === "string" &&
    typeof i.releaseAt === "string" &&
    (i.status === "waiting" ||
      i.status === "ready" ||
      i.status === "released" ||
      i.status === "cancelled") &&
    (i.releasedOpId === null || typeof i.releasedOpId === "string") &&
    (i.cancelledAt === null || typeof i.cancelledAt === "string")
  );
}

export function loadCoolDown(): CoolDownItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isItem);
  } catch {
    return [];
  }
}

export function saveCoolDown(items: CoolDownItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(COOLDOWN_EVENT));
  } catch {
    // quota — silent
  }
}

export function newItem(input: {
  to: string;
  amount: number;
  label: string;
  reason: string;
  holdHours: HoldHours;
}): CoolDownItem {
  const id = `cd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const release = new Date(now.getTime() + input.holdHours * 3600_000);
  return {
    id,
    to: input.to,
    amount: input.amount,
    label: input.label,
    reason: input.reason,
    createdAt: now.toISOString(),
    releaseAt: release.toISOString(),
    status: "waiting",
    releasedOpId: null,
    cancelledAt: null,
  };
}

export function refreshStatus(items: CoolDownItem[], now: Date = new Date()): CoolDownItem[] {
  const ts = now.getTime();
  let mutated = false;
  const out = items.map((it) => {
    if (it.status === "waiting" && new Date(it.releaseAt).getTime() <= ts) {
      mutated = true;
      return { ...it, status: "ready" as const };
    }
    return it;
  });
  return mutated ? out : items;
}

export function timeRemaining(it: CoolDownItem, now: Date = new Date()): {
  ms: number;
  hours: number;
  minutes: number;
  totalHours: number;
} {
  const ms = Math.max(0, new Date(it.releaseAt).getTime() - now.getTime());
  const totalSec = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  return { ms, hours, minutes, totalHours: hours + minutes / 60 };
}

export function activeItems(items: CoolDownItem[]): CoolDownItem[] {
  return items.filter((i) => i.status === "waiting" || i.status === "ready");
}

export function totalHeld(items: CoolDownItem[]): number {
  return activeItems(items).reduce((s, i) => s + i.amount, 0);
}
