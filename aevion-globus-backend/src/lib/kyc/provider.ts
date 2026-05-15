/**
 * KYC provider abstraction.
 *
 * The bureau needs identity attestation but should not be locked to a
 * specific KYC vendor. Concrete providers (Sumsub, Veriff, IDnow, Onfido,
 * Persona) implement this interface; the route layer is provider-agnostic.
 *
 * For development and CI we use stubProvider, which returns deterministic
 * "approved" decisions for test sessions. Production deployments select
 * a real provider via env BUREAU_KYC_PROVIDER + the provider's API keys.
 */

export type KycStatus =
  | "pending" // session created, user has not finished
  | "review" // user finished, provider is reviewing (manual or auto)
  | "approved" // identity confirmed
  | "rejected" // failed identity check
  | "expired"; // user did not complete in time

export interface KycSessionStart {
  email: string | null;
  userId: string | null;
  // Optional client-supplied data the user already filled — providers can
  // pre-populate forms with this; verifying it is the provider's job.
  declaredName?: string | null;
  declaredCountry?: string | null;
}

export interface KycSession {
  /** Provider-specific session identifier — opaque to us. */
  sessionId: string;
  /** URL the user is sent to (hosted KYC widget). */
  redirectUrl: string;
  /** Initial status — usually "pending". */
  status: KycStatus;
  /** When the session expires; user must finish before this. */
  expiresAt: string;
}

export interface KycResult {
  status: KycStatus;
  /** When status changed to terminal (approved/rejected). */
  decidedAt: string | null;
  /** Free-form provider reason; surface to user if rejected. */
  reason: string | null;
  /** What the provider actually verified. */
  verifiedName: string | null;
  verifiedDocType: string | null;
  verifiedCountry: string | null;
  /** Raw provider JSON, persisted in BureauVerification.kycRawJson. */
  raw: unknown;
}

export interface KycProvider {
  readonly id: string;
  startSession(input: KycSessionStart): Promise<KycSession>;
  getSession(sessionId: string): Promise<KycResult>;
  /**
   * Verify a webhook signature + extract the session id from the body.
   * Throws on tampered or malformed webhooks.
   */
  parseWebhook(headers: Record<string, string>, rawBody: string): {
    sessionId: string;
    result: KycResult;
  };
}
