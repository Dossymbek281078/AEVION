/**
 * Shared TypeScript types for the AEVION fintech SDK.
 *
 * These shapes mirror the response payloads of the backend routes:
 *  - /api/qgood/*           (qgood.ts route)
 *  - /api/qmaskcard/*       (qmaskcard.ts route)
 *  - /api/veilnetx-ledger/* (veilnetxLedger.ts route)
 *  - /api/ztide/*           (ztide.ts route)
 *  - /api/qchaingov/*       (qchaingov.ts route)
 *
 * Big-integer counters (cents, weights) are returned as `string` by Postgres,
 * so we type them as `string` here even when their semantic value is numeric.
 * Smaller counters that fit in a JS number safely are typed as `number`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// QGood — charity campaigns + donations + matching pools
// ─────────────────────────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "active" | "closed" | "rejected";

export interface Campaign {
  id: string;
  title: string;
  description: string;
  category: string;
  country: string | null;
  /** Big-int cents; serialized as a string by Postgres. */
  targetCents: string;
  /** Big-int cents; serialized as a string by Postgres. */
  raisedCents: string;
  donorCount: number;
  currency: string;
  status: CampaignStatus;
  imageUrl: string | null;
  createdAt: string;
}

export interface Donation {
  id: string;
  campaignId: string;
  amountCents: number;
  currency: string;
  donorName: string | null;
  messageText: string | null;
  anonymous: boolean;
  createdAt: string;
}

export type MatchingPoolStatus = "active" | "paused" | "exhausted";

export interface MatchingPool {
  id: string;
  label: string;
  currency: string;
  /** Big-int cents; serialized as a string by Postgres. */
  totalCents: string;
  /** Big-int cents; serialized as a string by Postgres. */
  remainingCents: string;
  matchRatio: number;
  /** Big-int cents; serialized as a string by Postgres. */
  maxMatchPerDonationCents: string;
  status: MatchingPoolStatus;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// QMaskCard — virtual cards + charges
// ─────────────────────────────────────────────────────────────────────────────

export type MaskKind =
  | "single-use"
  | "recurring"
  | "merchant-locked"
  | "category-locked";

export interface Mask {
  id: string;
  virtualPan: string;
  kind: MaskKind;
  label: string;
  currency: string;
  /** Big-int cents; serialized as a string. */
  spendLimitCents: string;
  /** Big-int cents; serialized as a string. */
  remainingCents: string;
  lockedToMerchant?: string | null;
  lockedToCategory?: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export type ChargeStatus = "authorized" | "declined";

export interface Charge {
  id: string;
  maskId: string;
  /** Big-int cents; serialized as a string. */
  amountCents: string;
  currency: string;
  merchantName: string | null;
  merchantCategory: string | null;
  geoCountry: string | null;
  status: ChargeStatus;
  declineReason: string | null;
  riskScore: number;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VeilNetX — privacy-preserving settlement ledger
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  id: string;
  sequenceNumber: number;
  module: string;
  kind: string;
  /** Blinded sender identifier (sha256-derived). */
  blindedFrom: string;
  /** Blinded recipient identifier (sha256-derived). */
  blindedTo: string;
  /** Big-int cents; serialized as a string. Can be negative (refunds). */
  amountCents: string;
  currency: string;
  prevHash: string;
  entryHash: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Z-Tide — reputation / standing scoring
// ─────────────────────────────────────────────────────────────────────────────

export type ZTideRankId =
  | "seedling"
  | "current"
  | "wave"
  | "stream"
  | "tide"
  | "river"
  | "ocean"
  | string;

export interface ZTideRank {
  id: ZTideRankId;
  label: string;
  min: number;
  next: number | null;
}

export interface ZTideEvent {
  id: string;
  kind: string;
  sourceModule: string;
  weight: number;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface ZTideLeaderboardRow {
  position: number;
  userId: string;
  score: number;
  eventCount: number;
  rank: ZTideRankId;
  lastEventAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// QChainGov — governance proposals + votes
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalStatus =
  | "draft"
  | "open"
  | "closed"
  | "executed"
  | "rejected";

export type ProposalVoteMode = "yes-no-abstain" | "ranked-choice" | "weighted";

export interface Proposal {
  id: string;
  authorUserId: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  voteMode: ProposalVoteMode;
  options: string[];
  quorumPercent: number;
  passThreshold: number;
  status: ProposalStatus;
  votesOpenAt: string | null;
  votesCloseAt: string | null;
  executedAt: string | null;
  createdAt: string;
}

export interface Vote {
  id: string;
  proposalId: string;
  voterUserId: string;
  choice: string;
  weight: number;
  rationale: string | null;
  createdAt: string;
}

export interface ProposalTallyRow {
  choice: string;
  votes: number;
  weight: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error envelope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown by `FintechClient.request` on any non-2xx response. The `code` is the
 * backend's machine-readable error tag (e.g. `"auth required"`,
 * `"invalid_module"`, `"already_voted"`); `message` is an optional human hint.
 */
export interface SDKError {
  status: number;
  code: string;
  message?: string;
}
