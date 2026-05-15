// Shared shapes for the ecosystem ledger (royalty events / chess prizes /
// planet certs). Extracted into a leaf module so the Postgres-aware store
// driver in src/lib/ecosystemStore.ts can import without forming a cycle
// with src/routes/ecosystem.ts.

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
