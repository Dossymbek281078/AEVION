import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { readJsonFile, writeJsonFile } from "../lib/jsonFileStore";

// AEV wallet + append-only ledger backend. MVP storage via jsonFileStore
// (atomic JSON files in AEVION_DATA_DIR). Prisma schema готов для миграции
// на Postgres когда DATABASE_URL будет задан.
//
// Endpoints:
//  GET  /api/aev/wallet/:deviceId           — read wallet snapshot
//  POST /api/aev/wallet/:deviceId/sync      — upsert (idempotent) wallet snapshot
//  POST /api/aev/wallet/:deviceId/mint      — append mint entry, update balance
//  POST /api/aev/wallet/:deviceId/spend     — append spend entry, update balance
//  GET  /api/aev/ledger/:deviceId?limit=    — append-only ledger tail
//  GET  /api/aev/stats                      — global aggregates (lifetime, ledger size)

export const aevRouter = Router();

// Flat filename — jsonFileStore mkdirs only top-level AEVION_DATA_DIR;
// subdirectories aren't autocreated.
const WALLETS_FILE = "aev_wallets.json";
const LEDGER_FILE = "aev_ledger.json";

type WalletRecord = {
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

type LedgerEntry = {
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

const DEFAULT_WALLET = (deviceId: string, userId: string | null): WalletRecord => ({
  deviceId,
  userId,
  balance: 0,
  lifetimeMined: 0,
  lifetimeSpent: 0,
  globalSupplyMined: 0,
  dividendsClaimed: 0,
  modes: { play: true, compute: false, stewardship: true },
  startTs: Date.now(),
  updatedAt: Date.now(),
  createdAt: Date.now(),
});

async function loadWallets(): Promise<Record<string, WalletRecord>> {
  return readJsonFile<Record<string, WalletRecord>>(WALLETS_FILE, {});
}

async function loadLedger(): Promise<LedgerEntry[]> {
  return readJsonFile<LedgerEntry[]>(LEDGER_FILE, []);
}

async function saveWallets(w: Record<string, WalletRecord>) {
  await writeJsonFile(WALLETS_FILE, w);
}

async function saveLedger(l: LedgerEntry[]) {
  await writeJsonFile(LEDGER_FILE, l);
}

function sanitizeDeviceId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!/^[a-zA-Z0-9._-]{6,128}$/.test(t)) return null;
  return t;
}

function clampAmount(raw: unknown, maxPerCall = 1000): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > maxPerCall) return null;
  return Math.round(n * 1_000_000) / 1_000_000;
}

const LEDGER_MAX = 50_000;

// ── GET /api/aev/wallet/:deviceId ──────────────────────────────────
aevRouter.get("/wallet/:deviceId", async (req: Request, res: Response) => {
  const deviceId = sanitizeDeviceId(req.params.deviceId);
  if (!deviceId) return res.status(400).json({ error: "invalid_device_id" });

  const wallets = await loadWallets();
  const w = wallets[deviceId];
  if (!w) return res.status(404).json({ error: "not_found", deviceId });
  res.json({ ok: true, wallet: w });
});

// ── POST /api/aev/wallet/:deviceId/sync ────────────────────────────
// Idempotent upsert. Frontend periodically pushes its localStorage
// snapshot — server takes max() of monotonic counters to converge
// with offline mints (last-writer-wins на balance/modes).
aevRouter.post("/wallet/:deviceId/sync", async (req: Request, res: Response) => {
  const deviceId = sanitizeDeviceId(req.params.deviceId);
  if (!deviceId) return res.status(400).json({ error: "invalid_device_id" });
  const body = req.body ?? {};

  const wallets = await loadWallets();
  const existing = wallets[deviceId] ?? DEFAULT_WALLET(deviceId, null);

  const merged: WalletRecord = {
    ...existing,
    userId: typeof body.userId === "string" ? body.userId : existing.userId,
    balance: Number.isFinite(body.balance) ? Number(body.balance) : existing.balance,
    lifetimeMined: Math.max(existing.lifetimeMined, Number(body.lifetimeMined) || 0),
    lifetimeSpent: Math.max(existing.lifetimeSpent, Number(body.lifetimeSpent) || 0),
    globalSupplyMined: Math.max(existing.globalSupplyMined, Number(body.globalSupplyMined) || 0),
    dividendsClaimed: Math.max(existing.dividendsClaimed, Number(body.dividendsClaimed) || 0),
    modes: {
      play: !!(body.modes?.play ?? existing.modes.play),
      compute: !!(body.modes?.compute ?? existing.modes.compute),
      stewardship: !!(body.modes?.stewardship ?? existing.modes.stewardship),
    },
    startTs: Math.min(existing.startTs, Number(body.startTs) || existing.startTs),
    updatedAt: Date.now(),
  };

  wallets[deviceId] = merged;
  await saveWallets(wallets);
  res.json({ ok: true, wallet: merged });
});

// ── POST /api/aev/wallet/:deviceId/mint ────────────────────────────
aevRouter.post("/wallet/:deviceId/mint", async (req: Request, res: Response) => {
  const deviceId = sanitizeDeviceId(req.params.deviceId);
  if (!deviceId) return res.status(400).json({ error: "invalid_device_id" });
  const amount = clampAmount(req.body?.amount);
  if (amount === null) return res.status(400).json({ error: "invalid_amount" });

  const [wallets, ledger] = await Promise.all([loadWallets(), loadLedger()]);
  const w = wallets[deviceId] ?? DEFAULT_WALLET(deviceId, null);
  w.balance = Math.round((w.balance + amount) * 1_000_000) / 1_000_000;
  w.lifetimeMined = Math.round((w.lifetimeMined + amount) * 1_000_000) / 1_000_000;
  w.globalSupplyMined = Math.round((w.globalSupplyMined + amount) * 1_000_000) / 1_000_000;
  w.updatedAt = Date.now();
  wallets[deviceId] = w;

  const entry: LedgerEntry = {
    id: randomUUID(),
    deviceId,
    kind: "mint",
    amount,
    sourceKind: typeof req.body?.sourceKind === "string" ? req.body.sourceKind : undefined,
    sourceModule: typeof req.body?.sourceModule === "string" ? req.body.sourceModule : undefined,
    sourceAction: typeof req.body?.sourceAction === "string" ? req.body.sourceAction : undefined,
    reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 256) : undefined,
    balanceAfter: w.balance,
    ts: Date.now(),
  };
  ledger.push(entry);
  // Trim oldest if we're over cap (append-only — but bounded for MVP)
  const trimmed = ledger.length > LEDGER_MAX ? ledger.slice(-LEDGER_MAX) : ledger;

  await Promise.all([saveWallets(wallets), saveLedger(trimmed)]);
  res.json({ ok: true, wallet: w, entry });
});

// ── POST /api/aev/wallet/:deviceId/spend ───────────────────────────
aevRouter.post("/wallet/:deviceId/spend", async (req: Request, res: Response) => {
  const deviceId = sanitizeDeviceId(req.params.deviceId);
  if (!deviceId) return res.status(400).json({ error: "invalid_device_id" });
  const amount = clampAmount(req.body?.amount);
  if (amount === null) return res.status(400).json({ error: "invalid_amount" });

  const [wallets, ledger] = await Promise.all([loadWallets(), loadLedger()]);
  const w = wallets[deviceId];
  if (!w) return res.status(404).json({ error: "not_found", deviceId });
  if (w.balance < amount) return res.status(409).json({ error: "insufficient_funds", balance: w.balance, requested: amount });

  w.balance = Math.round((w.balance - amount) * 1_000_000) / 1_000_000;
  w.lifetimeSpent = Math.round((w.lifetimeSpent + amount) * 1_000_000) / 1_000_000;
  w.updatedAt = Date.now();
  wallets[deviceId] = w;

  const entry: LedgerEntry = {
    id: randomUUID(),
    deviceId,
    kind: "spend",
    amount,
    sourceKind: typeof req.body?.sourceKind === "string" ? req.body.sourceKind : undefined,
    sourceModule: typeof req.body?.sourceModule === "string" ? req.body.sourceModule : undefined,
    sourceAction: typeof req.body?.sourceAction === "string" ? req.body.sourceAction : undefined,
    reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 256) : undefined,
    balanceAfter: w.balance,
    ts: Date.now(),
  };
  ledger.push(entry);
  const trimmed = ledger.length > LEDGER_MAX ? ledger.slice(-LEDGER_MAX) : ledger;

  await Promise.all([saveWallets(wallets), saveLedger(trimmed)]);
  res.json({ ok: true, wallet: w, entry });
});

// ── GET /api/aev/ledger/:deviceId ──────────────────────────────────
aevRouter.get("/ledger/:deviceId", async (req: Request, res: Response) => {
  const deviceId = sanitizeDeviceId(req.params.deviceId);
  if (!deviceId) return res.status(400).json({ error: "invalid_device_id" });
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 1000 ? limitRaw : 100;

  const ledger = await loadLedger();
  const filtered = ledger.filter((e) => e.deviceId === deviceId);
  const tail = filtered.slice(-limit).reverse(); // newest first
  res.json({ ok: true, deviceId, count: filtered.length, entries: tail });
});

// ── GET /api/aev/stats ─────────────────────────────────────────────
aevRouter.get("/stats", async (_req: Request, res: Response) => {
  const [wallets, ledger] = await Promise.all([loadWallets(), loadLedger()]);
  const walletList = Object.values(wallets);
  const totalMined = walletList.reduce((s, w) => s + w.lifetimeMined, 0);
  const totalSpent = walletList.reduce((s, w) => s + w.lifetimeSpent, 0);
  const totalBalance = walletList.reduce((s, w) => s + w.balance, 0);
  res.json({
    ok: true,
    wallets: walletList.length,
    ledgerEntries: ledger.length,
    aggregate: {
      totalMined: Math.round(totalMined * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalBalance: Math.round(totalBalance * 100) / 100,
    },
    capRemaining: Math.max(0, 21_000_000 - totalMined),
  });
});
