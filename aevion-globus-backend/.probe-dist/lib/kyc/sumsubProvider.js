"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumsubKycProvider = void 0;
function need(envKey) {
    const v = process.env[envKey];
    if (!v || v.trim().length === 0) {
        throw new Error(`Sumsub KYC: ${envKey} env is not set. Either configure it or set BUREAU_KYC_PROVIDER=stub for development.`);
    }
    return v;
}
exports.sumsubKycProvider = {
    id: "sumsub",
    async startSession(_input) {
        need("SUMSUB_APP_TOKEN");
        need("SUMSUB_SECRET_KEY");
        need("SUMSUB_LEVEL_NAME");
        // TODO: POST /resources/applicants?levelName=<level>
        // TODO: POST /resources/accessTokens?userId=<userId>&ttlInSecs=1800
        // TODO: return { sessionId: applicantId, redirectUrl: hosted-flow URL with token, status: "pending", expiresAt }
        throw new Error("Sumsub provider not yet implemented — populate startSession with API call");
    },
    async getSession(_sessionId) {
        need("SUMSUB_APP_TOKEN");
        // TODO: GET /resources/applicants/<applicantId>/status
        // TODO: map reviewAnswer (GREEN/RED) → KycStatus and projects fields
        throw new Error("Sumsub provider not yet implemented — populate getSession with status fetch");
    },
    parseWebhook(_headers, _rawBody) {
        need("SUMSUB_SECRET_KEY");
        // TODO: verify x-payload-digest header — HMAC-SHA256(rawBody, SECRET_KEY)
        // TODO: parse {applicantId, reviewResult: {reviewAnswer}} and map
        throw new Error("Sumsub provider not yet implemented — populate parseWebhook with HMAC verification");
    },
};
