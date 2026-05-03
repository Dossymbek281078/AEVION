import { Router, type Request, type Response } from "express";
import { requireAuth } from "../lib/authJwt";
import { csvFromRows } from "../lib/csv";
import {
  describeBackend,
  loadSnapshot,
  persistSnapshot,
} from "../lib/ecosystemStore";
import type {
  ChessPrize,
  PlanetCert,
  RoyaltyEvent,
} from "./ecosystem.types";

export type { ChessPrize, PlanetCert, RoyaltyEvent };

function sendCsv(
  res: Response,
  baseName: string,
  rows: (string | number | null | undefined)[][],
): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csvFromRows(rows));
}

export const ecosystemRouter = Router();

ecosystemRouter.use(requireAuth);

// ----------------------------------------------------------------------------
// Persisted ecosystem ledger.
//
// Three separate ledgers, all keyed by user email. The storage backend is
// chosen at runtime by src/lib/ecosystemStore.ts:
//   - Postgres (when DATABASE_URL is set) — append-only tables in
//     ecosystem_royalty_events / ecosystem_chess_prizes / ecosystem_planet_certs.
//   - JSON file (.aevion-data/ecosystem.json) — dev/test fallback.
//
// In-memory arrays keep being a write-through cache for read latency; routes
// mutate them and call scheduleEcosystemPersist() to flush asynchronously.
// ----------------------------------------------------------------------------

export const royaltyEvents: RoyaltyEvent[] = [];
export const chessPrizes: ChessPrize[] = [];
export const planetCerts: PlanetCert[] = [];

export function getEcosystemMetrics(): {
  royaltyEvents: number;
  chessPrizes: number;
  planetCerts: number;
  backend: "postgres" | "json";
} {
  return {
    royaltyEvents: royaltyEvents.length,
    chessPrizes: chessPrizes.length,
    planetCerts: planetCerts.length,
    backend: describeBackend().kind,
  };
}

let loaded = false;
let loading: Promise<void> | null = null;

export async function ensureEcosystemLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = (async () => {
      const snap = await loadSnapshot();
      royaltyEvents.splice(0, royaltyEvents.length, ...snap.royaltyEvents);
      chessPrizes.splice(0, chessPrizes.length, ...snap.chessPrizes);
      planetCerts.splice(0, planetCerts.length, ...snap.planetCerts);
      loaded = true;
    })();
  }
  await loading;
}

let persistChain: Promise<void> = Promise.resolve();

export function scheduleEcosystemPersist(): void {
  const snapshot = {
    royaltyEvents: [...royaltyEvents],
    chessPrizes: [...chessPrizes],
    planetCerts: [...planetCerts],
  };
  persistChain = persistChain
    .then(() => persistSnapshot(snapshot))
    .catch((err) => {
      console.error("[ecosystem] persist failed", err);
    });
}

ecosystemRouter.use((_req, _res, next) => {
  ensureEcosystemLoaded()
    .then(() => next())
    .catch(next);
});

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

ecosystemRouter.get("/earnings", (req, res) => {
  const email = ownerEmail(req);
  const r = royaltyEvents.filter((x) => x.email === email);
  const c = chessPrizes.filter((x) => x.email === email);
  const p = planetCerts.filter((x) => x.email === email);

  const sumR = r.reduce((s, x) => s + x.amount, 0);
  const sumC = c.reduce((s, x) => s + x.amount, 0);
  const sumP = p.reduce((s, x) => s + x.amount, 0);

  res.json({
    totals: {
      qright: Math.round(sumR * 100) / 100,
      cyberchess: Math.round(sumC * 100) / 100,
      planet: Math.round(sumP * 100) / 100,
      all: Math.round((sumR + sumC + sumP) * 100) / 100,
    },
    perSource: [
      { source: "qright", amount: sumR, count: r.length, last: r[r.length - 1]?.paidAt ?? null },
      { source: "cyberchess", amount: sumC, count: c.length, last: c[c.length - 1]?.finalizedAt ?? null },
      { source: "planet", amount: sumP, count: p.length, last: p[p.length - 1]?.certifiedAt ?? null },
    ],
  });
});

ecosystemRouter.get("/earnings.csv", (req, res) => {
  const email = ownerEmail(req);
  const r = royaltyEvents.filter((x) => x.email === email);
  const c = chessPrizes.filter((x) => x.email === email);
  const p = planetCerts.filter((x) => x.email === email);
  const round = (n: number) => Math.round(n * 100) / 100;
  const rows: (string | number | null | undefined)[][] = [
    ["source", "amount_aec", "event_count", "last_at"],
    ["qright", round(r.reduce((s, x) => s + x.amount, 0)), r.length, r[r.length - 1]?.paidAt ?? null],
    ["cyberchess", round(c.reduce((s, x) => s + x.amount, 0)), c.length, c[c.length - 1]?.finalizedAt ?? null],
    ["planet", round(p.reduce((s, x) => s + x.amount, 0)), p.length, p[p.length - 1]?.certifiedAt ?? null],
  ];
  sendCsv(res, "ecosystem-earnings", rows);
});
