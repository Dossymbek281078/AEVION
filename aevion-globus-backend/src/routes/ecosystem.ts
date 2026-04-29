import { Router, type Request } from "express";
import { requireAuth } from "../lib/authJwt";
import { readJsonFile, writeJsonFile } from "../lib/jsonFileStore";

export const ecosystemRouter = Router();

ecosystemRouter.use(requireAuth);

// ----------------------------------------------------------------------------
// Persisted ecosystem ledger.
//
// Three separate ledgers, all keyed by user email, all stored together in
// ecosystem.json (atomic write via jsonFileStore). Load-once on first access,
// persist-after-mutation in the same chain pattern qtrade uses.
//
// Why one file: the three arrays naturally aggregate into the single
// /earnings response, so co-locating their persistence keeps a snapshot
// representation consistent for backups + diff inspection.
// ----------------------------------------------------------------------------

export type RoyaltyEvent = {
  id: string;
  email: string;
  productKey: string;
  period: string;
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

const STORE_REL = "ecosystem.json";

let loaded = false;
let loading: Promise<void> | null = null;

export async function ensureEcosystemLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = (async () => {
      const data = await readJsonFile<{
        royaltyEvents?: RoyaltyEvent[];
        chessPrizes?: ChessPrize[];
        planetCerts?: PlanetCert[];
      }>(STORE_REL, { royaltyEvents: [], chessPrizes: [], planetCerts: [] });
      const r = Array.isArray(data.royaltyEvents) ? data.royaltyEvents : [];
      const c = Array.isArray(data.chessPrizes) ? data.chessPrizes : [];
      const p = Array.isArray(data.planetCerts) ? data.planetCerts : [];
      royaltyEvents.splice(0, royaltyEvents.length, ...r);
      chessPrizes.splice(0, chessPrizes.length, ...c);
      planetCerts.splice(0, planetCerts.length, ...p);
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
    .then(() => writeJsonFile(STORE_REL, snapshot))
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
