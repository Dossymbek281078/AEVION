// Trip Tracker — flag a date range as a "trip" with a daily / total budget.
// Operations within the range count toward trip spend; status reflects pace
// against the daily budget. Storage-only, mock-ready.

import type { Operation } from "./types";

const STORAGE_KEY = "aevion_bank_trip_v1";
export const TRIP_EVENT = "aevion:trip-changed";

export type Trip = {
  id: string;
  label: string;
  destination: string;
  startISO: string;
  endISO: string;
  budgetTotal: number;
  notes: string;
  createdAt: string;
  /** Trip is closed once endISO is in the past AND user has confirmed wrap-up. */
  closed: boolean;
};

function isTrip(x: unknown): x is Trip {
  if (!x || typeof x !== "object") return false;
  const t = x as Partial<Trip>;
  return (
    typeof t.id === "string" &&
    typeof t.label === "string" &&
    typeof t.destination === "string" &&
    typeof t.startISO === "string" &&
    typeof t.endISO === "string" &&
    typeof t.budgetTotal === "number" &&
    typeof t.notes === "string" &&
    typeof t.createdAt === "string" &&
    typeof t.closed === "boolean"
  );
}

export function loadTrips(): Trip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isTrip);
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    window.dispatchEvent(new Event(TRIP_EVENT));
  } catch {
    // quota — silent
  }
}

export function newTrip(input: {
  label: string;
  destination: string;
  startISO: string;
  endISO: string;
  budgetTotal: number;
  notes?: string;
}): Trip {
  const id = `trip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    label: input.label,
    destination: input.destination,
    startISO: input.startISO,
    endISO: input.endISO,
    budgetTotal: input.budgetTotal,
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
    closed: false,
  };
}

export function activeTrip(trips: Trip[], now: Date = new Date()): Trip | null {
  const ts = now.getTime();
  for (const t of trips) {
    if (t.closed) continue;
    const a = new Date(t.startISO).getTime();
    const b = new Date(t.endISO).getTime();
    if (ts >= a && ts <= b + 86_400_000) return t;
  }
  return null;
}

export type TripSummary = {
  trip: Trip;
  spent: number;
  ops: Operation[];
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  perDayBudget: number;
  paceRatio: number; // spent / (perDayBudget * daysElapsed)
  status: "ahead" | "ok" | "warn" | "over";
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function summarise(
  trip: Trip,
  operations: Operation[],
  myId: string,
  now: Date = new Date(),
): TripSummary {
  const a = startOfDay(new Date(trip.startISO)).getTime();
  const b = startOfDay(new Date(trip.endISO)).getTime() + 86_400_000;
  const ops = operations.filter((op) => {
    const ts = new Date(op.createdAt).getTime();
    if (ts < a || ts >= b) return false;
    // Outflows only — money I sent or paid out.
    return op.kind === "transfer" && op.from === myId;
  });
  const spent = ops.reduce((s, o) => s + o.amount, 0);

  const daysTotal = Math.max(1, Math.round((b - a) / 86_400_000));
  const today = startOfDay(now).getTime();
  const elapsedRaw = (today - a) / 86_400_000;
  const daysElapsed = Math.max(0, Math.min(daysTotal, Math.floor(elapsedRaw) + 1));
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);
  const perDayBudget = trip.budgetTotal > 0 ? trip.budgetTotal / daysTotal : 0;

  let paceRatio = 0;
  let status: TripSummary["status"] = "ok";
  if (perDayBudget > 0 && daysElapsed > 0) {
    paceRatio = spent / (perDayBudget * daysElapsed);
    if (paceRatio < 0.7) status = "ahead";
    else if (paceRatio < 1) status = "ok";
    else if (paceRatio < 1.2) status = "warn";
    else status = "over";
  } else if (trip.budgetTotal > 0 && spent >= trip.budgetTotal) {
    status = "over";
  }

  return {
    trip,
    spent,
    ops,
    daysTotal,
    daysElapsed,
    daysRemaining,
    perDayBudget,
    paceRatio,
    status,
  };
}

/** ISO date input value helper: "YYYY-MM-DD" of a Date. */
export function isoInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
