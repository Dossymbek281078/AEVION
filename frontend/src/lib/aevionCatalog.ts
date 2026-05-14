/**
 * Singleton wrapper around `@aevion/catalog-client` for the frontend.
 *
 * Connects to the same backend that `apiUrl()` targets:
 *   - In the browser: `/api-backend` (Next rewrites to backend)
 *   - On SSR / RSC: internal HTTP URL (default 127.0.0.1:4001)
 *
 * Use `catalog` for unauthenticated endpoints and `catalogWithToken(t)`
 * for endpoints requiring a Bearer token (e.g. /me/streak, /star).
 *
 * The SDK lives in the monorepo at `packages/aevion-catalog-client/` and
 * is not (yet) listed in `frontend/package.json` dependencies, so we use
 * a relative import to its source entry. Once wired up via workspaces
 * the import can be swapped for `@aevion/catalog-client`.
 */
import { AevionCatalog } from "../../../packages/aevion-catalog-client/src/index";
import { getApiBase } from "@/lib/apiBase";

/** Default unauthenticated client. Cheap to construct; created once. */
export const catalog = new AevionCatalog({ baseUrl: getApiBase() });

/**
 * Returns a new `AevionCatalog` instance carrying the given Bearer token
 * on every sub-request. Use this for endpoints under `/me/*` and any
 * write actions (bookmarks, stars, creates).
 *
 * If `token` is null/empty, returns the shared unauthenticated `catalog`.
 */
export function catalogWithToken(token: string | null | undefined): AevionCatalog {
  if (!token) return catalog;
  return new AevionCatalog({
    baseUrl: getApiBase(),
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Convenience: read auth token from localStorage (browser-only). */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aevion_auth_token");
}
