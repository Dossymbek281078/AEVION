import type { FintechClient } from "./client";
import type {
  Proposal,
  ProposalStatus,
  ProposalTallyRow,
  ProposalVoteMode,
  Vote,
} from "./types";

/** Body for {@link QChainGovModule.createProposal}. */
export interface CreateProposalBody {
  title: string;
  summary: string;
  body: string;
  category?: string;
  voteMode?: ProposalVoteMode;
  /** Vote options. Default for `yes-no-abstain` is `["yes","no","abstain"]`. */
  options?: string[];
  /** 1..100. Soft-quorum threshold (see backend MVP note). */
  quorumPercent?: number;
  /** 1..100. Pass threshold as a percent of yes-vs-no weight. */
  passThreshold?: number;
  /** ISO-8601 timestamp. */
  votesOpenAt?: string;
  /** ISO-8601 timestamp. */
  votesCloseAt?: string;
}

/** Filter options for {@link QChainGovModule.listProposals}. */
export interface ListProposalsOpts {
  status?: ProposalStatus;
  category?: string;
  /** Max rows. Backend default 30, cap 100. */
  limit?: number;
}

/** Body for {@link QChainGovModule.vote}. */
export interface CastVoteBody {
  /** Must match one of the proposal's `options`. */
  choice: string;
  /** Vote weight (default 1). Range 0..1_000_000. */
  weight?: number;
  rationale?: string;
}

/** Response from {@link QChainGovModule.getProposal}. */
export interface GetProposalResponse {
  proposal: Proposal;
  tally: ProposalTallyRow[];
  totals: { total: number; total_weight: number };
}

/** Response from {@link QChainGovModule.execute}. */
export interface ExecuteProposalResponse {
  ok: true;
  proposalId: string;
  status: "executed" | "rejected";
  quorumMet: boolean;
  threshold: { required: number; achieved: number };
  winningChoice: string | null;
  totalVotes: number;
  totalWeight: number;
  executedAt: string;
}

/** Response from {@link QChainGovModule.stats}. */
export interface QChainGovStatsResponse {
  total_proposals: number;
  open_proposals: number;
  closed_proposals: number;
  total_votes: number;
  unique_voters: number;
  service: "qchaingov";
}

/**
 * QChainGov — governance proposals + votes.
 *
 * Endpoints: `/api/qchaingov/*`. Authoring proposals + voting requires the
 * user JWT. Opening / closing / executing proposals requires admin JWT
 * (email in `QCHAINGOV_ADMIN_EMAILS`).
 *
 * Vote modes:
 *  - `yes-no-abstain` — yes vs no, pass-threshold compares yesWeight / (yes+no).
 *  - `weighted` — winner is the option with the most weight.
 *  - `ranked-choice` — MVP: same tally as weighted; full IRV TBD.
 */
export class QChainGovModule {
  constructor(private readonly client: FintechClient) {}

  /** Create a draft proposal. Admin must `openProposal` before voting starts. */
  createProposal(
    body: CreateProposalBody,
  ): Promise<{ id: string; status: "draft"; options: string[] }> {
    return this.client.request("POST", `/api/qchaingov/proposals`, body);
  }

  /** List proposals, optionally filtered by status / category. */
  listProposals(
    opts: ListProposalsOpts = {},
  ): Promise<{ proposals: Proposal[]; total: number }> {
    const qs = new URLSearchParams();
    if (opts.status) qs.set("status", opts.status);
    if (opts.category) qs.set("category", opts.category);
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return this.client.request("GET", `/api/qchaingov/proposals${tail}`);
  }

  /** Fetch a proposal with its current tally + totals. */
  getProposal(id: string): Promise<GetProposalResponse> {
    return this.client.request(
      "GET",
      `/api/qchaingov/proposals/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Cast a vote on an open proposal. Throws `SDKError` with `status: 409`
   * and `code: "already_voted"` if the user has already voted.
   */
  vote(
    proposalId: string,
    body: CastVoteBody,
  ): Promise<{ id: string; proposalId: string; choice: string; weight: number }> {
    return this.client.request(
      "POST",
      `/api/qchaingov/proposals/${encodeURIComponent(proposalId)}/votes`,
      body,
    );
  }

  /** List the votes cast on a proposal (up to 200, most recent first). */
  listVotes(
    proposalId: string,
  ): Promise<{ votes: Vote[]; total: number }> {
    return this.client.request(
      "GET",
      `/api/qchaingov/proposals/${encodeURIComponent(proposalId)}/votes`,
    );
  }

  /** Admin-only: flip a draft proposal to `open` (voting begins). */
  openProposal(
    id: string,
  ): Promise<{ ok: true; proposal: { id: string; status: "open" } }> {
    return this.client.request(
      "POST",
      `/api/qchaingov/proposals/${encodeURIComponent(id)}/open`,
    );
  }

  /** Admin-only: flip an open proposal to `closed` (voting ends). */
  closeProposal(
    id: string,
  ): Promise<{ ok: true; proposal: { id: string; status: "closed" } }> {
    return this.client.request(
      "POST",
      `/api/qchaingov/proposals/${encodeURIComponent(id)}/close`,
    );
  }

  /**
   * Admin-only: execute a closed proposal. Computes the tally, applies the
   * vote-mode rules, and flips to `"executed"` or `"rejected"` accordingly.
   */
  execute(id: string): Promise<ExecuteProposalResponse> {
    return this.client.request(
      "POST",
      `/api/qchaingov/proposals/${encodeURIComponent(id)}/execute`,
    );
  }

  /** Aggregate stats — proposal counts by status + total votes / unique voters. */
  stats(): Promise<QChainGovStatsResponse> {
    return this.client.request("GET", `/api/qchaingov/stats`);
  }
}
