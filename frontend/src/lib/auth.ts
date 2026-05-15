/**
 * Canonical AEVION-wide auth-token helpers.
 *
 * Single source of truth for the localStorage key that carries the user's
 * Bearer JWT across the entire frontend. Historically two keys coexisted:
 *
 *   - `aevion_auth_token_v1` — used by /auth/page.tsx, /account/*, bureau/*,
 *     bank/*, planet/*, admin/*, qcoreai/*, and most other surfaces.
 *   - `aevion_auth_token`    — used by /coach, /qstore, /qlearn, and the
 *     `aevionCatalog` SDK helper.
 *
 * This module canonicalises everything onto `aevion_auth_token_v1` and
 * provides a one-shot migration that copies any legacy `aevion_auth_token`
 * value over to the `_v1` slot, then clears the old key. The migration is
 * idempotent and SSR-safe.
 *
 * Usage:
 *   import { getAuthToken, setAuthToken, clearAuthToken,
 *            getAuthHeaders, isAuthenticated, migrateAuthToken,
 *            AUTH_TOKEN_KEY } from "@/lib/auth";
 *
 * SSR rules:
 *   - Every reader/writer guards on `typeof window !== "undefined"`.
 *   - `getAuthToken()` returns `null` on the server; `isAuthenticated()`
 *     returns `false` on the server.
 *
 * The migration helper should be called once at app mount (e.g. from the
 * root layout's client provider). Calling it more than once is a no-op.
 */

/** Canonical localStorage key for the AEVION Bearer JWT. */
export const AUTH_TOKEN_KEY = "aevion_auth_token_v1";

/**
 * Legacy key (no `_v1` suffix) used by /coach, /qstore, /qlearn and the
 * AevionCatalog SDK helper before unification. Kept around solely so
 * `migrateAuthToken()` can move existing sessions onto the canonical key.
 */
const LEGACY_AUTH_TOKEN_KEY = "aevion_auth_token";

/** Returns the current Bearer JWT, or `null` on SSR / when signed out. */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    // localStorage can throw in privacy mode / disabled storage.
    return null;
  }
}

/** Persists the Bearer JWT. No-op on SSR. */
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* ignore — see getAuthToken */
  }
}

/** Removes the Bearer JWT (and any straggling legacy copy). No-op on SSR. */
export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Convenience: returns `{ Authorization: "Bearer <jwt>" }` when signed in,
 * otherwise an empty object. Safe to spread into a `fetch` headers init.
 */
export function getAuthHeaders(): Record<string, string> {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Whether the user has a token in storage. SSR-safe. */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Move any legacy `aevion_auth_token` value to the canonical
 * `aevion_auth_token_v1` slot, then delete the legacy entry.
 *
 * Idempotent:
 *   - If the canonical key already holds a value, the legacy entry is
 *     simply deleted (canonical wins — fresher logins always land on v1).
 *   - If neither key holds a value, this is a no-op.
 *   - Safe to call from a `useEffect` on every render; the second call
 *     finds an empty legacy slot and exits immediately.
 *
 * SSR-safe: returns `false` and does nothing on the server.
 *
 * @returns `true` iff a migration actually copied data; `false` otherwise.
 */
export function migrateAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const legacy = window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
    if (!legacy) return false;
    const canonical = window.localStorage.getItem(AUTH_TOKEN_KEY);
    let migrated = false;
    if (!canonical) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, legacy);
      migrated = true;
    }
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    return migrated;
  } catch {
    return false;
  }
}
