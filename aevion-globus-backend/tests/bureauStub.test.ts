import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetStubKycSessions,
  __seedStubKycSession,
  stubKycProvider,
} from "../src/lib/kyc/stubProvider";
import {
  __resetStubPaymentIntents,
  stubPaymentProvider,
} from "../src/lib/payment/stubProvider";
import { getKycProvider } from "../src/lib/kyc";
import { getPaymentProvider } from "../src/lib/payment";

describe("bureau provider abstractions", () => {
  beforeEach(() => {
    __resetStubKycSessions();
    __resetStubPaymentIntents();
    delete process.env.BUREAU_KYC_PROVIDER;
    delete process.env.BUREAU_PAYMENT_PROVIDER;
  });

  describe("KYC stub provider", () => {
    it("starts a session and returns a redirect URL", async () => {
      const session = await stubKycProvider.startSession({
        email: "user@example.com",
        userId: "u-1",
        declaredName: "Alice Test",
        declaredCountry: "KZ",
      });
      expect(session.sessionId).toMatch(/^kyc-stub-/);
      expect(session.redirectUrl).toContain(session.sessionId);
      expect(session.status).toBe("pending");
      expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("approves a normal session and surfaces the declared name", async () => {
      const session = await stubKycProvider.startSession({
        email: null,
        userId: null,
        declaredName: "Bob Sample",
        declaredCountry: "US",
      });
      const result = await stubKycProvider.getSession(session.sessionId);
      expect(result.status).toBe("approved");
      expect(result.verifiedName).toBe("Bob Sample");
      expect(result.verifiedCountry).toBe("US");
      expect(result.verifiedDocType).toBe("passport");
    });

    it("rejects sessions whose declared name starts with FAIL_KYC_", async () => {
      const session = await stubKycProvider.startSession({
        email: null,
        userId: null,
        declaredName: "FAIL_KYC_test",
      });
      const result = await stubKycProvider.getSession(session.sessionId);
      expect(result.status).toBe("rejected");
      expect(result.reason).toMatch(/synthetic rejection/);
    });

    it("returns expired for unknown session ids", async () => {
      const result = await stubKycProvider.getSession("kyc-stub-bogus");
      expect(result.status).toBe("expired");
    });

    it("webhook parses sessionId and returns deterministic decision", async () => {
      __seedStubKycSession("kyc-stub-seeded", {
        email: null,
        userId: null,
        declaredName: "Webhook User",
      });
      const parsed = stubKycProvider.parseWebhook(
        {},
        JSON.stringify({ sessionId: "kyc-stub-seeded" }),
      );
      expect(parsed.sessionId).toBe("kyc-stub-seeded");
      expect(parsed.result.status).toBe("approved");
      expect(parsed.result.verifiedName).toBe("Webhook User");
    });

    it("webhook throws on unknown sessionId — never silently passes", () => {
      expect(() =>
        stubKycProvider.parseWebhook(
          {},
          JSON.stringify({ sessionId: "kyc-stub-unknown" }),
        ),
      ).toThrowError(/unknown sessionId/);
    });
  });

  describe("Payment stub provider", () => {
    it("creates an intent with the requested amount + currency", async () => {
      const intent = await stubPaymentProvider.createIntent({
        reference: "ref-1",
        amountCents: 1900,
        currency: "USD",
        description: "Test",
      });
      expect(intent.intentId).toMatch(/^pay-stub-/);
      expect(intent.amountCents).toBe(1900);
      expect(intent.currency).toBe("USD");
      expect(intent.status).toBe("unpaid");
    });

    it("auto-completes the intent on first poll (so demos work)", async () => {
      const intent = await stubPaymentProvider.createIntent({
        reference: "ref-2",
        amountCents: 1900,
        currency: "USD",
        description: "Test",
      });
      const r1 = await stubPaymentProvider.getIntent(intent.intentId);
      expect(r1.status).toBe("paid");
      expect(r1.paidAt).toBeTruthy();
    });

    it("returns expired for unknown intent ids", async () => {
      const r = await stubPaymentProvider.getIntent("pay-stub-bogus");
      expect(r.status).toBe("expired");
    });

    it("webhook marks the intent paid", async () => {
      const intent = await stubPaymentProvider.createIntent({
        reference: "ref-3",
        amountCents: 1900,
        currency: "USD",
        description: "Test",
      });
      const parsed = stubPaymentProvider.parseWebhook(
        {},
        JSON.stringify({ intentId: intent.intentId }),
      );
      expect(parsed.intentId).toBe(intent.intentId);
      expect(parsed.result.status).toBe("paid");
    });
  });

  describe("provider selection via env", () => {
    it("getKycProvider defaults to stub when env unset", () => {
      expect(getKycProvider().id).toBe("stub");
    });

    it("getPaymentProvider defaults to stub when env unset", () => {
      expect(getPaymentProvider().id).toBe("stub");
    });

    it("throws on unknown provider id", () => {
      process.env.BUREAU_KYC_PROVIDER = "veriff";
      expect(() => getKycProvider()).toThrowError(/Unknown BUREAU_KYC_PROVIDER/);
    });
  });
});
