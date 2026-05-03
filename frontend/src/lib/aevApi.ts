// AEV wallet backend client. Opt-in via NEXT_PUBLIC_AEV_BACKEND_URL.
// When the env-var НЕ задан → каждый wrapper возвращает { ok: false, skip: true }
// и frontend продолжает работать на pure-localStorage. С env-var → POST/GET
// идут к /api/aev/* эндпоинтам backend'а; ошибки сети/4xx/5xx swallow'нем
// и помечаем { ok: false, error } — caller fallback'ит на local state.
//
// Никогда не throws.

const BASE = process.env.NEXT_PUBLIC_AEV_BACKEND_URL?.trim() || "";

export const isAevBackendEnabled = () => BASE.length > 0;

const DEVICE_ID_KEY = "aevion_aev_device_id_v1";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr-no-device";
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (id && /^[a-zA-Z0-9._-]{6,128}$/.test(id)) return id;
    const fresh = `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return `tmp-${Math.random().toString(36).slice(2, 10)}`;
  }
}

type ApiOk<T> = { ok: true; data: T };
type ApiSkip = { ok: false; skip: true };
type ApiErr = { ok: false; skip?: false; error: string; status?: number };
type ApiResult<T> = ApiOk<T> | ApiSkip | ApiErr;

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<ApiResult<T>> {
  if (!isAevBackendEnabled()) return { ok: false, skip: true };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      // backend lives on different origin — no cookies for now
      credentials: "omit",
    });
    if (!res.ok) {
      let msg = `http_${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = String(j.error); } catch {/**/}
      return { ok: false, error: msg, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

// ── Public surface ──────────────────────────────────────────────────

export type AevWalletSnapshot = {
  deviceId: string;
  userId: string | null;
  balance: number;
  lifetimeMined: number;
  lifetimeSpent: number;
  globalSupplyMined: number;
  dividendsClaimed: number;
  modes: { play: boolean; compute: boolean; stewardship: boolean };
  startTs: number;
  updatedAt: number;
  createdAt: number;
};

export type AevLedgerEntry = {
  id: string;
  deviceId: string;
  kind: "mint" | "spend";
  amount: number;
  sourceKind?: string;
  sourceModule?: string;
  sourceAction?: string;
  reason?: string;
  balanceAfter: number;
  ts: number;
};

export function fetchWallet() {
  const id = getDeviceId();
  return call<{ ok: true; wallet: AevWalletSnapshot }>("GET", `/api/aev/wallet/${id}`);
}

export function syncWallet(snapshot: Partial<AevWalletSnapshot>) {
  const id = getDeviceId();
  return call<{ ok: true; wallet: AevWalletSnapshot }>("POST", `/api/aev/wallet/${id}/sync`, snapshot);
}

export function postMint(amount: number, meta?: { sourceKind?: string; sourceModule?: string; sourceAction?: string; reason?: string }) {
  const id = getDeviceId();
  return call<{ ok: true; wallet: AevWalletSnapshot; entry: AevLedgerEntry }>("POST", `/api/aev/wallet/${id}/mint`, { amount, ...(meta || {}) });
}

export function postSpend(amount: number, meta?: { sourceKind?: string; sourceModule?: string; sourceAction?: string; reason?: string }) {
  const id = getDeviceId();
  return call<{ ok: true; wallet: AevWalletSnapshot; entry: AevLedgerEntry }>("POST", `/api/aev/wallet/${id}/spend`, { amount, ...(meta || {}) });
}

export function fetchLedger(limit = 100) {
  const id = getDeviceId();
  return call<{ ok: true; deviceId: string; count: number; entries: AevLedgerEntry[] }>("GET", `/api/aev/ledger/${id}?limit=${limit}`);
}

export function fetchAevStats() {
  return call<{
    ok: true;
    wallets: number;
    ledgerEntries: number;
    aggregate: { totalMined: number; totalSpent: number; totalBalance: number };
    capRemaining: number;
  }>("GET", `/api/aev/stats`);
}
