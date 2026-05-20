/**
 * Singleton wrapper around `@aevion-io/catalog-client` for the frontend.
 *
 * Connects to the same backend that `apiUrl()` targets:
 *   - In the browser: `/api-backend` (Next rewrites to backend)
 *   - On SSR / RSC: internal HTTP URL (default 127.0.0.1:4001)
 *
 * Use `catalog` for unauthenticated endpoints and `catalogWithToken(t)`
 * for endpoints requiring a Bearer token (e.g. /me/streak, /star).
 *
 * The SDK lives in the monorepo at `packages/aevion-catalog-client/` and
 * is wired into `frontend/package.json` as `file:` dep plus a tsconfig
 * `paths` alias, so the `@aevion-io/catalog-client` import below resolves
 * to the package's TS source.
 */
// Relative import to workspace package — Turbopack prod build не резолвит
// bare specifier `@aevion-io/catalog-client` через file:../ npm dep + symlink.
// Используем явный путь к built dist (package main).
import { AevionCatalog } from "../../../packages/aevion-catalog-client/dist/index.js";
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
