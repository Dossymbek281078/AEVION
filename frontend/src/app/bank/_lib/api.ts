// Thin typed client over /api/qtrade/* and /api/auth/me.
// Backend gaps tracked separately (see bank/page.tsx header): no JWT middleware on qtrade,
// no pagination, no email→accountId resolver.

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

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `${fallback} (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function fetchMe(): Promise<Me | null> {
  const token = readToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data && typeof data === "object" && "user" in data ? (data as { user: Me }).user : null) ?? null;
  } catch {
    return null;
  }
}

export async function listAccounts(): Promise<Account[]> {
  const res = await fetch(apiUrl("/api/qtrade/accounts"));
  const data = await unwrap<{ items: Account[] }>(res, "Load accounts failed");
  return Array.isArray(data.items) ? data.items : [];
}

export async function createAccount(owner: string): Promise<Account> {
  const res = await fetch(apiUrl("/api/qtrade/accounts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner }),
  });
  return unwrap<Account>(res, "Create account failed");
}

export async function listOperations(): Promise<Operation[]> {
  const res = await fetch(apiUrl("/api/qtrade/operations"));
  const data = await unwrap<{ items: Operation[] }>(res, "Load operations failed");
  return Array.isArray(data.items) ? data.items : [];
}

export async function topUp(accountId: string, amount: number): Promise<{ id: string; balance: number; updatedAt: string }> {
  const res = await fetch(apiUrl("/api/qtrade/topup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, amount }),
  });
  return unwrap<{ id: string; balance: number; updatedAt: string }>(res, "Top-up failed");
}

export async function transfer(from: string, to: string, amount: number): Promise<Transfer> {
  const res = await fetch(apiUrl("/api/qtrade/transfer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, amount }),
  });
  return unwrap<Transfer>(res, "Transfer failed");
}

export async function signPayload(payload: unknown): Promise<SignResult> {
  const res = await fetch(apiUrl("/api/qsign/sign"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrap<SignResult>(res, "Sign failed");
}

export async function verifySignature(payload: unknown, signature: string): Promise<VerifyResult> {
  const res = await fetch(apiUrl("/api/qsign/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, signature }),
  });
  return unwrap<VerifyResult>(res, "Verify failed");
}

export function operationsCsvUrl(): string {
  return apiUrl("/api/qtrade/operations.csv");
}
