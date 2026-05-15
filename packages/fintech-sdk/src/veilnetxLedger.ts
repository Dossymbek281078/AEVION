import type { FintechClient } from "./client";
import type { LedgerEntry } from "./types";

/** Body for {@link VeilNetXLedgerModule.appendEntry}. */
export interface AppendEntryBody {
  /** Source module emitting the entry — e.g. `"qmaskcard"`, `"qgood"`. */
  module: string;
  /** Entry kind — e.g. `"settlement"`, `"donation"`, `"refund"`. */
  kind: string;
  /** Raw sender identifier; will be blinded server-side. */
  fromIdentifier?: string;
  /** Raw recipient identifier; will be blinded server-side. */
  toIdentifier?: string;
  /** Amount in cents. May be a string for values that exceed JS `Number.MAX_SAFE_INTEGER`. */
  amountCents: number | string;
  currency?: string;
  meta?: Record<string, unknown>;
}

/** Response from {@link VeilNetXLedgerModule.appendEntry}. */
export interface AppendEntryResponse {
  id: string;
  entryHash: string;
  prevHash: string;
  module: string;
  kind: string;
  blindedFrom: string;
  blindedTo: string;
  /** Big-int cents; serialized as a string. */
  amountCents: string;
  currency: string;
  createdAt: string;
}

/** Response from {@link VeilNetXLedgerModule.chainHead}. */
export interface ChainHeadResponse {
  /** Latest chain tip hash, or the genesis hash if the chain is empty. */
  head: string;
  length: number;
  tipAt?: string;
}

/** Response from {@link VeilNetXLedgerModule.verifyChain}. */
export interface VerifyChainResponse {
  verified: boolean;
  /** Sequence number at which the chain is first inconsistent, else null. */
  brokenAt: number | null;
  length: number;
  head: string;
}

/** Response from {@link VeilNetXLedgerModule.stats}. */
export interface VeilNetXStatsResponse {
  service: "veilnetx-ledger";
  total: number;
  perModule: Array<{
    module: string;
    entries: number;
    volume_cents: string;
  }>;
}

/**
 * VeilNetX — append-only privacy-preserving settlement ledger.
 *
 * Endpoints: `/api/veilnetx-ledger/*`. Append requires auth; reads are public.
 *
 * The ledger maintains a hash chain: each entry's `entryHash` is computed from
 * the previous head's `entryHash` plus the entry's payload, so any tampering
 * is detectable via {@link VeilNetXLedgerModule.verifyChain}.
 */
export class VeilNetXLedgerModule {
  constructor(private readonly client: FintechClient) {}

  /**
   * Append a new ledger entry. Identifiers are blinded server-side via sha256
   * before being persisted — the raw identifier never hits the database.
   */
  appendEntry(body: AppendEntryBody): Promise<AppendEntryResponse> {
    return this.client.request("POST", `/api/veilnetx-ledger/entries`, body);
  }

  /**
   * List recent entries, optionally filtered by module or sender (the latter
   * filter blinds the supplied identifier server-side before matching).
   */
  listEntries(
    opts: { module?: string; fromIdentifier?: string; limit?: number } = {},
  ): Promise<{ entries: LedgerEntry[]; total: number }> {
    const qs = new URLSearchParams();
    if (opts.module) qs.set("module", opts.module);
    if (opts.fromIdentifier) qs.set("fromIdentifier", opts.fromIdentifier);
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return this.client.request("GET", `/api/veilnetx-ledger/entries${tail}`);
  }

  /**
   * Fetch one entry by id. Response includes `integrity: "ok" | "broken"` from
   * a server-side recomputation of the entry's hash.
   */
  getEntry(id: string): Promise<{
    entry: LedgerEntry;
    integrity: "ok" | "broken";
    recomputedHash: string;
  }> {
    return this.client.request(
      "GET",
      `/api/veilnetx-ledger/entries/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Search for entries by hash prefix (min 4 hex chars). Matches against both
   * `entryHash` and `prevHash`.
   */
  search(
    hashPrefix: string,
    limit = 20,
  ): Promise<{
    query: { hash: string; limit: number };
    matches: LedgerEntry[];
    total: number;
  }> {
    const qs = new URLSearchParams({
      hash: hashPrefix,
      limit: String(limit),
    });
    return this.client.request(
      "GET",
      `/api/veilnetx-ledger/search?${qs.toString()}`,
    );
  }

  /** Get the current chain tip — head hash + length. */
  chainHead(): Promise<ChainHeadResponse> {
    return this.client.request("GET", `/api/veilnetx-ledger/chain/head`);
  }

  /**
   * Walk the whole chain and verify each link. Returns `verified: true` if the
   * chain is intact, or `brokenAt: <sequenceNumber>` at the first break.
   *
   * Note: the backend currently scans up to the first 10000 entries.
   */
  verifyChain(): Promise<VerifyChainResponse> {
    return this.client.request("GET", `/api/veilnetx-ledger/chain/verify`);
  }

  /** Aggregate stats — per-module entry counts + volume. */
  stats(): Promise<VeilNetXStatsResponse> {
    return this.client.request("GET", `/api/veilnetx-ledger/stats`);
  }
}
