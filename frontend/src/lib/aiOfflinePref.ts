// Platform-wide "run AI offline / on-prem" preference. One switch that every
// smart-call surface (AskAi, askSmart, any module routing through
// /api/qcoreai/smart) reads, so a regulated / air-gapped operator flips the
// whole ecosystem to the local fleet at once instead of per module.
//
// Persisted in localStorage and broadcast via a custom event so header toggle
// and in-page boxes stay in sync within a tab; the native `storage` event keeps
// separate tabs in sync too. SSR-safe: every access guards `window`.

const KEY = "aevion_ai_offline";
const EVENT = "aevion-ai-offline-change";

/** Current preference. False (cloud fleet) on the server and before hydration. */
export function isAiOffline(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Set the preference and notify listeners in this tab (and, via storage, others). */
export function setAiOffline(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* private mode / storage disabled — the toggle still works for this render */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

/** Subscribe to changes (same-tab custom event + cross-tab storage event).
 *  Returns an unsubscribe function. */
export function subscribeAiOffline(cb: (on: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => cb(isAiOffline());
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb(isAiOffline());
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
