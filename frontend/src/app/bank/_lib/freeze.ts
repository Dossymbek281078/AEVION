// Panic Freeze — one-tap emergency lock on all outgoing money movement.
// Triggers:
//  - Manual (button in Copilot)
//  - Future: anomaly auto-trigger (activity burst beyond threshold)
// Unfreeze:
//  - After sober window (default 5 min) AND either timer expiry OR biometric
//  - Future: support phone call / email confirmation

const STORAGE_KEY = "aevion_bank_freeze_v1";
const LOG_KEY = "aevion_bank_freeze_log_v1";
const MAX_LOG_KEPT = 50;
export const FREEZE_EVENT = "aevion:freeze-changed";
const DEFAULT_SOBER_MS = 5 * 60 * 1000; // 5 minutes

export type FreezeState = {
  frozenAt: string; // ISO
  soberUntil: string; // ISO, timestamp before which unfreeze is blocked
  reason: "manual" | "anomaly";
  note?: string;
};

/** Historical record of freeze / unfreeze events — drives UnifiedAuditFeed. */
export type FreezeEvent = {
  id: string;
  at: string;
  type: "freeze" | "unfreeze";
  reason: "manual" | "anomaly";
  note?: string;
};

function isFreezeEvent(x: unknown): x is FreezeEvent {
  if (!x || typeof x !== "object") return false;
  const e = x as Partial<FreezeEvent>;
  return (
    typeof e.id === "string" &&
    typeof e.at === "string" &&
    (e.type === "freeze" || e.type === "unfreeze") &&
    (e.reason === "manual" || e.reason === "anomaly")
  );
}

export function loadFreezeLog(): FreezeEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isFreezeEvent);
  } catch {
    return [];
  }
}

function appendFreezeEvent(e: FreezeEvent): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadFreezeLog();
    const next = [e, ...current].slice(0, MAX_LOG_KEPT);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function newEventId(): string {
  return `fe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isFreezeState(x: unknown): x is FreezeState {
  if (!x || typeof x !== "object") return false;
  const f = x as Partial<FreezeState>;
  return (
    typeof f.frozenAt === "string" &&
    typeof f.soberUntil === "string" &&
    (f.reason === "manual" || f.reason === "anomaly")
  );
}

export function loadFreeze(): FreezeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isFreezeState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persist(state: FreezeState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new Event(FREEZE_EVENT));
  } catch {
    /* ignore */
  }
}

/** Returns true if current wallet state blocks outgoing transfers. */
export function isFrozen(): boolean {
  return loadFreeze() !== null;
}

export function freezeNow(
  note?: string,
  soberMs: number = DEFAULT_SOBER_MS,
  reason: "manual" | "anomaly" = "manual",
): FreezeState {
  const now = new Date();
  const state: FreezeState = {
    frozenAt: now.toISOString(),
    soberUntil: new Date(now.getTime() + soberMs).toISOString(),
    reason,
    note,
  };
  persist(state);
  appendFreezeEvent({
    id: newEventId(),
    at: state.frozenAt,
    type: "freeze",
    reason,
    note,
  });
  return state;
}

export type UnfreezeAttempt =
  | { ok: true }
  | { ok: false; reason: "not-frozen" | "sober-window" | "biometric-failed"; secondsLeft?: number };

/** Attempt unfreeze. If biometric is required (per settings), the caller must
 *  verify first and pass `biometricVerified: true`. Sober window applies even
 *  with biometric — the user must still wait at least N seconds after freeze
 *  (this is the defining feature vs a plain PIN-unlock). */
export async function tryUnfreeze(biometricVerified: boolean): Promise<UnfreezeAttempt> {
  const state = loadFreeze();
  if (!state) return { ok: true };
  const sober = Date.parse(state.soberUntil);
  if (Number.isFinite(sober) && Date.now() < sober) {
    return {
      ok: false,
      reason: "sober-window",
      secondsLeft: Math.ceil((sober - Date.now()) / 1000),
    };
  }
  if (!biometricVerified) {
    return { ok: false, reason: "biometric-failed" };
  }
  persist(null);
  appendFreezeEvent({
    id: newEventId(),
    at: new Date().toISOString(),
    type: "unfreeze",
    reason: state.reason,
    note: state.note,
  });
  return { ok: true };
}

export function forceUnfreeze(): void {
  const prev = loadFreeze();
  persist(null);
  if (prev) {
    appendFreezeEvent({
      id: newEventId(),
      at: new Date().toISOString(),
      type: "unfreeze",
      reason: prev.reason,
      note: prev.note,
    });
  }
}

export function secondsUntilSober(state: FreezeState): number {
  const sober = Date.parse(state.soberUntil);
  if (!Number.isFinite(sober)) return 0;
  return Math.max(0, Math.ceil((sober - Date.now()) / 1000));
}
