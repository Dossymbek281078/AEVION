import type { FintechClient } from "./client";
import type {
  Campaign,
  CampaignStatus,
  Donation,
  MatchingPool,
} from "./types";

/** Filter options for {@link QGoodModule.listCampaigns}. */
export interface ListCampaignsOpts {
  /** Filter by status. Backend default is `"active"` when omitted. */
  status?: CampaignStatus | string;
  category?: string;
  /** Max rows to return; backend caps at 100. */
  limit?: number;
}

/** Request body for {@link QGoodModule.createCampaign}. */
export interface CreateCampaignBody {
  title: string;
  description: string;
  category?: string;
  country?: string;
  /** Fundraising target in minor units (cents). */
  targetCents: number;
  currency?: string;
  imageUrl?: string;
}

/** Request body for {@link QGoodModule.donate}. */
export interface DonateBody {
  amountCents: number;
  currency?: string;
  donorName?: string;
  donorEmail?: string;
  messageText?: string;
  anonymous?: boolean;
  /** Optional client-side reference (e.g. Stripe charge id) for reconciliation. */
  paymentRef?: string;
}

/** Response from {@link QGoodModule.donate}. */
export interface DonateResponse {
  id: string;
  campaignId: string;
  amountCents: number;
  /** Matched amount from a {@link MatchingPool}, if any pool was eligible. */
  match: { amountCents: number; poolId: string } | null;
}

/** Response from {@link QGoodModule.stats}. */
export interface QGoodStatsResponse {
  total_campaigns: number;
  active_campaigns: number;
  total_raised_cents: string;
  total_donors: number;
  topCategories?: Array<{
    category: string;
    total_raised_cents: string;
    campaign_count: number;
    donor_count: number;
  }>;
}

/**
 * QGood — charity / fundraising campaigns.
 *
 * Endpoints: `/api/qgood/*`. Donation endpoint requires auth.
 */
export class QGoodModule {
  constructor(private readonly client: FintechClient) {}

  /** List campaigns, optionally filtered by status / category. */
  listCampaigns(
    opts: ListCampaignsOpts = {},
  ): Promise<{ campaigns: Campaign[]; total: number }> {
    const qs = new URLSearchParams();
    if (opts.status) qs.set("status", opts.status);
    if (opts.category) qs.set("category", opts.category);
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return this.client.request("GET", `/api/qgood/campaigns${tail}`);
  }

  /** Fetch one campaign and its recent donations. */
  getCampaign(
    id: string,
  ): Promise<{ campaign: Campaign; donations: Donation[] }> {
    return this.client.request(
      "GET",
      `/api/qgood/campaigns/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Create a draft campaign. Returns the new id; campaign is in `"draft"`
   * status and must be approved before it can accept donations.
   */
  createCampaign(
    body: CreateCampaignBody,
  ): Promise<{ id: string; status: "draft" }> {
    return this.client.request("POST", `/api/qgood/campaigns`, body);
  }

  /** Admin-only: approve a draft campaign so it can accept donations. */
  approveCampaign(id: string): Promise<{ ok: true; id: string; status: "active" }> {
    return this.client.request(
      "POST",
      `/api/qgood/campaigns/${encodeURIComponent(id)}/approve`,
    );
  }

  /**
   * Make a donation to a campaign. Returns the new donation id and any
   * matched amount from a {@link MatchingPool}.
   */
  donate(campaignId: string, body: DonateBody): Promise<DonateResponse> {
    return this.client.request(
      "POST",
      `/api/qgood/campaigns/${encodeURIComponent(campaignId)}/donations`,
      body,
    );
  }

  /** List active matching pools (matched-giving funds). */
  listMatchingPools(): Promise<{ pools: MatchingPool[]; total: number }> {
    return this.client.request("GET", `/api/qgood/matching-pools`);
  }

  /** Admin-only: create a matching pool. */
  createMatchingPool(body: {
    label: string;
    currency?: string;
    totalCents: number;
    matchRatio?: number;
    maxMatchPerDonationCents?: number;
  }): Promise<{ id: string; label: string; status: "active" }> {
    return this.client.request("POST", `/api/qgood/matching-pools`, body);
  }

  /** Admin-only: pause a matching pool (stops new matches). */
  pauseMatchingPool(id: string): Promise<{ ok: true; status: "paused" }> {
    return this.client.request(
      "POST",
      `/api/qgood/matching-pools/${encodeURIComponent(id)}/pause`,
    );
  }

  /** Admin-only: resume a paused matching pool. */
  resumeMatchingPool(id: string): Promise<{ ok: true; status: "active" }> {
    return this.client.request(
      "POST",
      `/api/qgood/matching-pools/${encodeURIComponent(id)}/resume`,
    );
  }

  /** Aggregate stats — total campaigns / raised / donors / top categories. */
  stats(): Promise<QGoodStatsResponse> {
    return this.client.request("GET", `/api/qgood/stats`);
  }
}
