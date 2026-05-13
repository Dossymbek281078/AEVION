import { QGoodModule } from "./qgood";
import { QMaskCardModule } from "./qmaskcard";
import { VeilNetXLedgerModule } from "./veilnetxLedger";
import { ZTideModule } from "./ztide";
import { QChainGovModule } from "./qchaingov";
import { QPayNetModule } from "./qpaynet";
import type { SDKError } from "./types";

/** Options passed to the {@link FintechClient} constructor. */
export interface FintechClientOptions {
  /**
   * Backend base URL.
   *
   * @example "https://aevion-production-a70c.up.railway.app"
   * @example "http://localhost:4001"
   */
  baseUrl: string;

  /** Optional Bearer JWT. When set, sent as `Authorization: Bearer <token>` on every request. */
  token?: string;

  /**
   * Override the fetch implementation. Useful in Node <18 (where global fetch
   * does not exist) or in test environments. Defaults to global `fetch`.
   */
  fetch?: typeof fetch;

  /** Per-request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number;
}

/** HTTP methods accepted by {@link FintechClient.request}. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Root client for the AEVION fintech ecosystem.
 *
 * Holds a base URL + optional auth token, and exposes one typed sub-client
 * per backend module:
 *
 *  - {@link FintechClient.qgood} — charity campaigns and donations.
 *  - {@link FintechClient.qmaskcard} — virtual single-use / merchant-locked cards.
 *  - {@link FintechClient.veilnetxLedger} — append-only privacy-preserving ledger.
 *  - {@link FintechClient.ztide} — reputation/standing scoring.
 *  - {@link FintechClient.qchaingov} — governance proposals and votes.
 *  - {@link FintechClient.qpaynet} — wallets, transfers, payment requests, merchant rail.
 *
 * The client is immutable. To bind a token, use {@link FintechClient.withToken},
 * which returns a fresh client sharing the same fetch / baseUrl / timeout.
 *
 * @example
 * ```ts
 * import { FintechClient } from "@aevion/fintech-sdk";
 *
 * const client = new FintechClient({
 *   baseUrl: "https://aevion-production-a70c.up.railway.app",
 * });
 *
 * const { campaigns } = await client.qgood.listCampaigns({ status: "active", limit: 10 });
 * const head = await client.veilnetxLedger.chainHead();
 *
 * const authed = client.withToken(jwt);
 * const me = await authed.ztide.me();
 * ```
 */
export class FintechClient {
  /** QGood charity module — campaigns, donations, matching pools. */
  readonly qgood: QGoodModule;
  /** QMaskCard virtual card module — masks, charges. */
  readonly qmaskcard: QMaskCardModule;
  /** VeilNetX append-only settlement ledger. */
  readonly veilnetxLedger: VeilNetXLedgerModule;
  /** Z-Tide reputation / rank scoring. */
  readonly ztide: ZTideModule;
  /** QChainGov governance proposals + votes. */
  readonly qchaingov: QChainGovModule;
  /** QPayNet wallets, transfers, payment requests, merchant rail. */
  readonly qpaynet: QPayNetModule;

  constructor(public readonly opts: FintechClientOptions) {
    this.qgood = new QGoodModule(this);
    this.qmaskcard = new QMaskCardModule(this);
    this.veilnetxLedger = new VeilNetXLedgerModule(this);
    this.ztide = new ZTideModule(this);
    this.qchaingov = new QChainGovModule(this);
    this.qpaynet = new QPayNetModule(this);
  }

  /**
   * Return a new {@link FintechClient} bound to the given Bearer token. The
   * existing client is unchanged. Use this when you obtain a token mid-flight
   * (e.g. after `/api/auth/login`).
   */
  withToken(token: string): FintechClient {
    return new FintechClient({ ...this.opts, token });
  }

  /**
   * Low-level request helper. Module classes call this internally — most users
   * will never need it. Exposed so partners can hit endpoints not yet wrapped
   * by a typed method.
   *
   * On non-2xx responses, throws an {@link SDKError} object (not an `Error`
   * instance — it's a plain shape so it serializes nicely over IPC / logs).
   */
  async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const f = this.opts.fetch ?? fetch;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.opts.token) headers["Authorization"] = `Bearer ${this.opts.token}`;
    const url = `${this.opts.baseUrl.replace(/\/+$/, "")}${path}`;

    let signal: AbortSignal | undefined;
    const timeoutMs = this.opts.timeoutMs ?? 10_000;
    // `AbortSignal.timeout` is available in Node 18+ and all modern browsers.
    // Fall back to no-signal if the runtime lacks it — fetch will hang at most
    // until the platform default kicks in.
    if (typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === "function") {
      signal = (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout(timeoutMs);
    }

    const res = await f(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      json = {};
    }
    const payload = (json ?? {}) as Record<string, unknown>;

    if (!res.ok) {
      const err: SDKError = {
        status: res.status,
        code: typeof payload.error === "string" ? payload.error : "request_failed",
        message: typeof payload.message === "string" ? payload.message : undefined,
      };
      throw err;
    }
    return payload as T;
  }
}
