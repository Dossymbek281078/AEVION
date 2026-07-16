// Shared convention for "silent success" bugs: a route that returns HTTP 2xx
// because the upstream call didn't error, but the upstream's own response body
// signals it didn't fully do what was asked (e.g. a 3rd-party API accepts a
// request but omits the id that would confirm it was actually queued, or an
// internal fallback path substituted a placeholder for the real result).
//
// Attach these fields alongside the normal 200 payload instead of silently
// returning `{ ok: true }` — the frontend's ToastProvider (`ToastVariant`)
// and DevHub's local Toast component both support a "warning" variant for
// exactly this case, so callers can show something other than a plain
// success toast when `degraded` is true.
//
// Found via two independent DevHub bugs on 2026-07-16 (credit-metering that
// silently didn't enforce limits, and AI code-gen that silently returned a
// placeholder) — this file exists so the next module doesn't reinvent the
// same field names.
export interface DegradedFields {
  degraded: true;
  degradedReason: string;
}

export function degraded(reason: string): DegradedFields {
  return { degraded: true, degradedReason: reason };
}
