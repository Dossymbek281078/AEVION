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
 * Детерминированная база для ОТОБРАЖЕНИЯ в JSX (текст сниппетов, `href`, `src`).
 * В отличие от `getApiBase()`, НЕ ветвится по `typeof window`, поэтому возвращает
 * одинаковую строку при SSR и на клиенте → не вызывает hydration mismatch (#418).
 * Использует только `NEXT_PUBLIC_*` (инлайнится одинаково в обе сборки) и относительный
 * `/api-backend` по умолчанию. Для fetch по-прежнему используйте `apiUrl()`/`getApiBase()`.
 */
export function getClientApiBase(): string {
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (pub) return stripTrailingSlash(pub) || "/api-backend";
  return "/api-backend";
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Server-side fetch of a backend API path, with retry on a cold backend.
 *
 * The first request to hit the API right after a deploy often fails — the
 * backend is still spinning up (network error or a 5xx) — and a single-shot
 * server fetch then bakes that failure into whatever it renders: an OG card
 * cached with placeholder text, a page rendered as not-found. This was seen
 * live: a deploy left the QVenture demo OG card showing "Report demo-neu"
 * because the very first render fetched null and got cached.
 *
 * Retries ONLY transient failures — a thrown fetch (network/timeout/abort) and
 * 5xx responses. A 4xx (notably 404) is a real answer and returns immediately.
 * Returns the Response, or null once retries are exhausted, so callers keep
 * their existing `if (!res) / if (!res.ok)` handling. Server-only (uses
 * getApiBase, which resolves to an absolute base off the window).
 */
export async function serverFetch(
  apiPath: string,
  opts: RequestInit & { retries?: number; timeoutMs?: number } = {},
): Promise<Response | null> {
  const { retries = 2, timeoutMs = 4000, ...init } = opts;
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const url = `${getApiBase()}${p}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, { cache: "no-store", ...init, signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      // A cold backend answers 5xx; retry those. A 4xx is a real answer — return it.
      if (res.status >= 500 && attempt < retries) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      return res;
    } catch {
      // Network error / timeout / abort — the classic cold-start symptom.
      if (attempt < retries) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}
