"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stubPaymentProvider = void 0;
exports.__resetStubPaymentIntents = __resetStubPaymentIntents;
const crypto_1 = __importDefault(require("crypto"));
const intents = new Map();
exports.stubPaymentProvider = {
    id: "stub",
    async createIntent(input) {
        const intentId = "pay-stub-" + crypto_1.default.randomBytes(8).toString("hex");
        intents.set(intentId, { input, status: "unpaid", paidAt: null });
        return {
            intentId,
            checkoutUrl: `/bureau/pay-stub/${intentId}`,
            status: "unpaid",
            amountCents: input.amountCents,
            currency: input.currency,
        };
    },
    async getIntent(intentId) {
        const i = intents.get(intentId);
        if (!i) {
            return {
                status: "expired",
                paidAt: null,
                reason: "Stub intent not found",
                raw: null,
            };
        }
        // Auto-complete on first poll so the demo flow works without a click.
        if (i.status === "unpaid") {
            i.status = "paid";
            i.paidAt = new Date().toISOString();
        }
        return {
            status: i.status,
            paidAt: i.paidAt,
            reason: null,
            raw: { stub: true, input: i.input },
        };
    },
    parseWebhook(_headers, rawBody) {
        let body;
        try {
            body = JSON.parse(rawBody);
        }
        catch {
            throw new Error("Stub webhook: body is not valid JSON");
        }
        const intentId = typeof body.intentId === "string" ? body.intentId : null;
        if (!intentId)
            throw new Error("Stub webhook: intentId missing");
        const i = intents.get(intentId);
        if (!i)
            throw new Error(`Stub webhook: unknown intentId ${intentId}`);
        i.status = "paid";
        i.paidAt = new Date().toISOString();
        return {
            intentId,
            result: {
                status: "paid",
                paidAt: i.paidAt,
                reason: null,
                raw: { stub: true, webhook: true },
            },
        };
    },
};
/** Test-only helper. */
function __resetStubPaymentIntents() {
    intents.clear();
}
