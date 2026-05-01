/**
 * Sumsub KYC provider — production skeleton.
 *
 * Wire this up by setting:
 *   BUREAU_KYC_PROVIDER=sumsub
 *   SUMSUB_APP_TOKEN=<from sumsub dashboard>
 *   SUMSUB_SECRET_KEY=<for HMAC-SHA256 webhook signature>
 *   SUMSUB_LEVEL_NAME=<applicant level configured for AEVION Bureau>
 *
 * Reference:
 *   https://developers.sumsub.com/api-reference/
 *
 * Until the env keys are present, this provider throws on every call so
 * misconfigured prod fails loudly rather than silently letting unverified
 * users through. Switch back to BUREAU_KYC_PROVIDER=stub for offline dev.
 */
import { KycProvider, KycResult, KycSession, KycSessionStart } from "./provider";

function need(envKey: string): string {
  const v = process.env[envKey];
  if (!v || v.trim().length === 0) {
    throw new Error(
      `Sumsub KYC: ${envKey} env is not set. Either configure it or set BUREAU_KYC_PROVIDER=stub for development.`,
    );
  }
  return v;
}

export const sumsubKycProvider: KycProvider = {
  id: "sumsub",

  async startSession(_input: KycSessionStart): Promise<KycSession> {
    need("SUMSUB_APP_TOKEN");
    need("SUMSUB_SECRET_KEY");
    need("SUMSUB_LEVEL_NAME");
    // TODO: POST /resources/applicants?levelName=<level>
    // TODO: POST /resources/accessTokens?userId=<userId>&ttlInSecs=1800
    // TODO: return { sessionId: applicantId, redirectUrl: hosted-flow URL with token, status: "pending", expiresAt }
    throw new Error("Sumsub provider not yet implemented — populate startSession with API call");
  },

  async getSession(_sessionId: string): Promise<KycResult> {
    need("SUMSUB_APP_TOKEN");
    // TODO: GET /resources/applicants/<applicantId>/status
    // TODO: map reviewAnswer (GREEN/RED) → KycStatus and projects fields
    throw new Error("Sumsub provider not yet implemented — populate getSession with status fetch");
  },

  parseWebhook(_headers: Record<string, string>, _rawBody: string) {
    need("SUMSUB_SECRET_KEY");
    // TODO: verify x-payload-digest header — HMAC-SHA256(rawBody, SECRET_KEY)
    // TODO: parse {applicantId, reviewResult: {reviewAnswer}} and map
    throw new Error("Sumsub provider not yet implemented — populate parseWebhook with HMAC verification");
  },
};
