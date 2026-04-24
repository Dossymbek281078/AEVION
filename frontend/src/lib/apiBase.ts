const stripTrailingSlash = (s: string) => s.replace(/\/+$/, "");

/**
 * База для fetch: без `/api` в конце.
 * - Браузер: по умолчанию `/api-backend` → rewrites в next.config.ts на бекенд.
 * - RSC/SSR: прямой `http://127.0.0.1:4001`, если не задано иначе (не зависит от порта Next).
 */
export function getApiBase(): string {
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (pub) {
    if (pub.startsWith("/")) {
      if (typeof window === "undefined") {
        const internal = process.env.API_INTERNAL_BASE_URL?.trim() || process.env.BACKEND_PROXY_TARGET?.trim();
        if (internal) return stripTrailingSlash(internal);
        return "http://127.0.0.1:4001";
      }
      return pub.replace(/\/+$/, "") || "/api-backend";
    }
    return stripTrailingSlash(pub);
  }

  if (typeof window !== "undefined") return "/api-backend";

  const internal = process.env.API_INTERNAL_BASE_URL?.trim() || process.env.BACKEND_PROXY_TARGET?.trim();
  if (internal) return stripTrailingSlash(internal);

  return "http://127.0.0.1:4001";
}

/**
 * Абсолютный origin бекенда для ссылок `<a href>` (OpenAPI, health), не для прокси.
 */
export function getBackendOrigin(): string {
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (pub && /^https?:\/\//i.test(pub)) return stripTrailingSlash(pub);
  const internal = process.env.API_INTERNAL_BASE_URL?.trim();
  if (internal) return stripTrailingSlash(internal);
  return "http://127.0.0.1:4001";
}

/** Путь вида `/api/...` → полный URL для fetch. */
export function apiUrl(apiPath: string): string {
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (!p.startsWith("/api/")) {
    throw new Error(`apiUrl: ожидается путь с /api/, получено: ${apiPath}`);
  }
  const base = getApiBase();
  return `${base}${p}`;
}
