import { Router, type Request } from "express";
import { requireAuth } from "../lib/authJwt";

export const ecosystemRouter = Router();

ecosystemRouter.use(requireAuth);

// ----------------------------------------------------------------------------
// In-memory ecosystem ledger.
//
// Three separate ledgers, all keyed by user email:
//   - royaltyEvents: per-product royalty payouts (qright)
//   - chessPrizes:   tournament prize awards (cyberchess)
//   - planetCerts:   one-off rewards for a certified Planet artifact (planet)
//
// /api/ecosystem/earnings rolls these up into one summary the bank UI can
// render directly. Items here represent *credited* events — i.e. the user
// has already received the AEC. Webhook routes (in cyberchess.ts and the
// royalties sub-router below) are what append entries to these arrays.
// ----------------------------------------------------------------------------

export type RoyaltyEvent = {
  id: string;
  email: string;
  productKey: string;
  period: string; // ISO date or "2026-Q1"
  amount: number;
  paidAt: string;
  transferId: string | null;
  source: "qright";
};

export type ChessPrize = {
  id: string;
  email: string;
  tournamentId: string;
  place: number;
  amount: number;
  finalizedAt: string;
  transferId: string | null;
  source: "cyberchess";
};

export type PlanetCert = {
  id: string;
  email: string;
  artifactVersionId: string;
  amount: number;
  certifiedAt: string;
  source: "planet";
};

export const royaltyEvents: RoyaltyEvent[] = [];
export const chessPrizes: ChessPrize[] = [];
export const planetCerts: PlanetCert[] = [];

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
