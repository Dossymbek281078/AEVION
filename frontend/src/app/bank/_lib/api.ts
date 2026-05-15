// Thin typed client over /api/qtrade/* and /api/auth/me.
//
// Frontend-side hardening:
//   - All qtrade calls now send Bearer token (backend may or may not enforce yet,
//     but we no longer leak unauth requests).
//   - request() distinguishes network errors (typed as "network") from HTTP errors
//     so the UI can render targeted messages.
//   - lookupAccountByEmail() resolves an email → accountId by querying the
//     accounts list, removing the requirement that recipients use raw acc_<uuid>.
//   - pingBackend() drives the health banner.
//   - newIdempotencyKey() / topUp+transfer accept idempotencyKey: caller-side
//     defence so a double-click or retry under flaky network does not produce
//     duplicate ledger entries. Header is `Idempotency-Key`. Backend enforcement
//     is a separate concern; the wire-level contract is set correctly here.

import { apiUrl } from "@/lib/apiBase";
import type { Account, Me, Operation } from "./types";

export type Transfer = {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: string;
};

export type SignResult = {
  payload: unknown;
  signature: string;
  algo: string;
  createdAt: string;
};

export type VerifyResult = {
  valid: boolean;
  expected: string;
  provided: string;
};

const TOKEN_KEY = "aevion_auth_token_v1";

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = readToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Generates a stable, opaque key suitable for the `Idempotency-Key` HTTP header.
 * Prefer crypto.randomUUID() (RFC 4122 v4) when available, otherwise fall back
 * to a timestamp + base-36 random pair that preserves uniqueness with extremely
 * high probability (1e-12 collision in a single-tab session).
 */
export function newIdempotencyKey(prefix = "aev"): string {
  const c = typeof crypto !== "undefined" ? (crypto as Crypto & { randomUUID?: () => string }) : undefined;
  if (c?.randomUUID) return `${prefix}-${c.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

class ApiError extends Error {
  kind: "network" | "http";
  status: number;
  constructor(kind: "network" | "http", status: number, message: string) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError("network", 0, "Network: backend unreachable");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `${fallbackMessage} (${res.status})`;
    throw new ApiError("http", res.status, msg);
  }
  return data as T;
}

export async function fetchMe(): Promise<Me | null> {
  const token = readToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data && typeof data === "object" && "user" in data ? (data as { user: Me }).user : null) ?? null;
  } catch {
    return null;
  }
}

export async function listAccounts(): Promise<Account[]> {
  const data = await request<{ items: Account[] }>(
    "/api/qtrade/accounts",
    { headers: authHeaders() },
    "Load accounts failed",
  );
  return Array.isArray(data.items) ? data.items : [];
}

export async function createAccount(owner: string): Promise<Account> {
  return request<Account>(
    "/api/qtrade/accounts",
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ owner }),
    },
    "Create account failed",
  );
}

// Walks the cursor chain so callers see complete history rather than the
// first 50 rows. Bounded by fetchAllPages' MAX_PAGES * PAGE_LIMIT ceiling.
// For new wallets this is one round-trip — same cost as before.
export async function listOperations(): Promise<Operation[]> {
  const { items } = await fetchAllPages<Operation>("/api/qtrade/operations");
  return items;
}

// Walks a cursor-paginated GET endpoint until exhausted.
// Caps at MAX_PAGES * 200 rows so a runaway server can't hang the UI.
// Returns { items, total } — total is the server-reported count when
// available (ecosystem routes), otherwise the materialised length.
const PAGE_LIMIT = 200;
const MAX_PAGES = 20;

export async function fetchAllPages<T>(
  path: string,
): Promise<{ items: T[]; total: number; truncated: boolean }> {
  const out: T[] = [];
  let cursor: string | null = null;
  let serverTotal: number | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const cursorPart: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const qs: string = `${path}${sep}limit=${PAGE_LIMIT}${cursorPart}`;

    let data: { items?: T[]; nextCursor?: string | null; total?: number } | null;
    try {
      data = await request<{ items?: T[]; nextCursor?: string | null; total?: number }>(
        qs,
        { headers: authHeaders() },
        `Load ${path} failed`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.kind === "http") return { items: out, total: out.length, truncated };
      throw err;
    }

    const items = Array.isArray(data?.items) ? (data!.items as T[]) : [];
    out.push(...items);
    if (typeof data?.total === "number") serverTotal = data.total;

    const next: string | null = data?.nextCursor ?? null;
    if (!next) return { items: out, total: serverTotal ?? out.length, truncated };
    cursor = next;
  }

  truncated = true;
  return { items: out, total: serverTotal ?? out.length, truncated };
}

export async function topUp(
  accountId: string,
  amount: number,
  options?: { idempotencyKey?: string },
): Promise<{ id: string; balance: number; updatedAt: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  return request<{ id: string; balance: number; updatedAt: string }>(
    "/api/qtrade/topup",
    {
      method: "POST",
      headers: authHeaders(headers),
      body: JSON.stringify({ accountId, amount }),
    },
    "Top-up failed",
  );
}

export async function transfer(
  from: string,
  to: string,
  amount: number,
  options?: { idempotencyKey?: string; memo?: string },
): Promise<Transfer> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  const body: Record<string, unknown> = { from, to, amount };
  if (options?.memo) body.memo = options.memo;
  return request<Transfer>(
    "/api/qtrade/transfer",
    {
      method: "POST",
      headers: authHeaders(headers),
      body: JSON.stringify(body),
    },
    "Transfer failed",
  );
}

export async function signPayload(payload: unknown): Promise<SignResult> {
  return request<SignResult>(
    "/api/qsign/sign",
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
    "Sign failed",
  );
}

export async function verifySignature(payload: unknown, signature: string): Promise<VerifyResult> {
  return request<VerifyResult>(
    "/api/qsign/verify",
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ payload, signature }),
    },
    "Verify failed",
  );
}

export function operationsCsvUrl(): string {
  return apiUrl("/api/qtrade/operations.csv");
}

// Resolve an email or account ID into a concrete account ID.
// Accepts: "acc_…" (returns as-is), or "user@host" (looks up via /api/qtrade/accounts).
// Returns null when no match found. Pure email matching is case-insensitive.
export async function lookupAccountByEmail(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("acc_")) return trimmed;
  if (!trimmed.includes("@")) return null;
  try {
    const items = await listAccounts();
    const target = trimmed.toLowerCase();
    const match = items.find((a) => (a.owner || "").toLowerCase() === target);
    return match?.id ?? null;
  } catch {
    return null;
  }
}

// Lightweight liveness check. Used by the BackendStatus banner — fires on mount
// and every 60s. Returns true if the backend responds at all (any HTTP status).
export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/api/health"), {
      method: "GET",
      cache: "no-store",
    });
    return res.ok || res.status === 404; // 404 = endpoint missing but server alive
  } catch {
    return false;
  }
}

export { ApiError };
