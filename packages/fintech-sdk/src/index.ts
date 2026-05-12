/**
 * @aevion/fintech-sdk — TypeScript client for the AEVION fintech ecosystem.
 *
 * Modules:
 *   QGood       — charity campaigns + donations
 *   QMaskCard   — virtual payment card masks
 *   VeilNetX    — privacy-blinded settlement ledger
 *   Z-Tide      — reputation / contribution layer
 *   QChainGov   — on-chain governance proposals + voting
 */

export interface AevionFintechConfig {
  baseUrl: string;
  token?: string;
}

type Fetch = typeof globalThis.fetch;

class AevionBase {
  protected baseUrl: string;
  protected token?: string;
  protected _fetch: Fetch;

  constructor(config: AevionFintechConfig, fetchImpl?: Fetch) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this._fetch = fetchImpl ?? globalThis.fetch;
  }

  protected headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  protected async get<T>(path: string): Promise<T> {
    const r = await this._fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!r.ok) throw new AevionError(r.status, await r.json().catch(() => ({})));
    return r.json() as Promise<T>;
  }

  protected async post<T>(path: string, body: unknown): Promise<T> {
    const r = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new AevionError(r.status, await r.json().catch(() => ({})));
    return r.json() as Promise<T>;
  }
}

export class AevionError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) {
    super(`AEVION API error ${status}: ${body.error ?? "unknown"}`);
    this.name = "AevionError";
  }
}

// ── QGood ──────────────────────────────────────────────────────────────────

export interface QGoodCampaign {
  id: string; title: string; description: string; goal: number;
  raised: number; donorCount: number; endsAt: string | null; status: string;
}

export class QGoodClient extends AevionBase {
  async listCampaigns(params?: { status?: string; limit?: number }): Promise<{ campaigns: QGoodCampaign[]; total: number }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.get(`/api/qgood/campaigns?${qs}`);
  }

  async getCampaign(id: string): Promise<QGoodCampaign> {
    return this.get(`/api/qgood/campaigns/${encodeURIComponent(id)}`);
  }

  async donate(campaignId: string, amount: number, message?: string): Promise<{ donationId: string }> {
    return this.post("/api/qgood/donate", { campaignId, amount, message });
  }

  async stats(): Promise<{ totalRaised: number; activeCampaigns: number; donors: number }> {
    return this.get("/api/qgood/stats");
  }
}

// ── QMaskCard ──────────────────────────────────────────────────────────────

export interface VirtualCard {
  id: string; pan: string; expiry: string; cvv: string;
  spendLimit: number | null; merchantLock: string | null; status: string;
}

export class QMaskCardClient extends AevionBase {
  async createMask(opts: { spendLimit?: number; merchantLock?: string; label?: string }): Promise<VirtualCard> {
    return this.post("/api/qmaskcard/masks", opts);
  }

  async listMasks(): Promise<{ masks: VirtualCard[] }> {
    return this.get("/api/qmaskcard/masks");
  }

  async killMask(id: string): Promise<{ success: boolean }> {
    return this.post(`/api/qmaskcard/masks/${encodeURIComponent(id)}/kill`, {});
  }

  async chargeHistory(id: string): Promise<{ charges: Array<{ id: string; amount: number; merchant: string; at: string }> }> {
    return this.get(`/api/qmaskcard/masks/${encodeURIComponent(id)}/charges`);
  }
}

// ── VeilNetX ───────────────────────────────────────────────────────────────

export interface VeilEntry {
  entryHash: string; prevHash: string; amount: number;
  currency: string; timestamp: string; note?: string;
}

export class VeilNetXClient extends AevionBase {
  async addEntry(data: { amount: number; currency: string; note?: string }): Promise<VeilEntry> {
    return this.post("/api/veilnetx-ledger/entries", data);
  }

  async chain(limit = 20): Promise<{ entries: VeilEntry[]; head: string }> {
    return this.get(`/api/veilnetx-ledger/chain?limit=${limit}`);
  }

  async verifyIntegrity(): Promise<{ valid: boolean; brokenAt?: string }> {
    return this.get("/api/veilnetx-ledger/verify");
  }

  async search(hashPrefix: string): Promise<{ entries: VeilEntry[] }> {
    return this.get(`/api/veilnetx-ledger/search?q=${encodeURIComponent(hashPrefix)}`);
  }
}

// ── Z-Tide ─────────────────────────────────────────────────────────────────

export interface ZTideScore {
  userId: string; score: number; rank: number; badges: string[];
}

export class ZTideClient extends AevionBase {
  async getScore(userId: string): Promise<ZTideScore> {
    return this.get(`/api/ztide/score/${encodeURIComponent(userId)}`);
  }

  async addContribution(kind: string, metadata?: Record<string, unknown>): Promise<{ delta: number; newScore: number }> {
    return this.post("/api/ztide/contribute", { kind, metadata });
  }

  async leaderboard(limit = 10): Promise<{ entries: ZTideScore[] }> {
    return this.get(`/api/ztide/leaderboard?limit=${limit}`);
  }
}

// ── QChainGov ──────────────────────────────────────────────────────────────

export interface Proposal {
  id: string; title: string; description: string; status: string;
  votesFor: number; votesAgainst: number; endsAt: string;
}

export class QChainGovClient extends AevionBase {
  async listProposals(params?: { status?: string }): Promise<{ proposals: Proposal[]; total: number }> {
    const qs = params?.status ? `?status=${params.status}` : "";
    return this.get(`/api/qchaingov/proposals${qs}`);
  }

  async getProposal(id: string): Promise<Proposal> {
    return this.get(`/api/qchaingov/proposals/${encodeURIComponent(id)}`);
  }

  async vote(proposalId: string, vote: "for" | "against"): Promise<{ success: boolean }> {
    return this.post(`/api/qchaingov/proposals/${encodeURIComponent(proposalId)}/vote`, { vote });
  }

  async createProposal(data: { title: string; description: string; endsAt: string }): Promise<Proposal> {
    return this.post("/api/qchaingov/proposals", data);
  }
}

// ── Unified client ─────────────────────────────────────────────────────────

export class AevionFintechClient {
  readonly qgood: QGoodClient;
  readonly qmaskcard: QMaskCardClient;
  readonly veilnetx: VeilNetXClient;
  readonly ztide: ZTideClient;
  readonly qchaingov: QChainGovClient;

  constructor(config: AevionFintechConfig, fetchImpl?: Fetch) {
    this.qgood = new QGoodClient(config, fetchImpl);
    this.qmaskcard = new QMaskCardClient(config, fetchImpl);
    this.veilnetx = new VeilNetXClient(config, fetchImpl);
    this.ztide = new ZTideClient(config, fetchImpl);
    this.qchaingov = new QChainGovClient(config, fetchImpl);
  }
}

export function createClient(config: AevionFintechConfig): AevionFintechClient {
  return new AevionFintechClient(config);
}
