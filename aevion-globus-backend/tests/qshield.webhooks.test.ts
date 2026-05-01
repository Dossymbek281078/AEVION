import { describe, test, expect } from "vitest";
import crypto from "crypto";
import { signWebhookBody } from "../src/lib/qshield/webhooks";

describe("qshield webhook HMAC signing", () => {
  test("signWebhookBody returns deterministic SHA-256 hex of correct length", () => {
    const secret = "smoke-secret-1234";
    const body = JSON.stringify({ event: "shield.created", id: "qs-abc" });
    const sig = signWebhookBody(secret, body);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(signWebhookBody(secret, body)).toBe(sig);
  });

  test("different secrets → different signatures for same body", () => {
    const body = JSON.stringify({ a: 1 });
    expect(signWebhookBody("secret-a", body)).not.toBe(signWebhookBody("secret-b", body));
  });

  test("different bodies → different signatures for same secret", () => {
    const secret = "k";
    expect(signWebhookBody(secret, "{}")).not.toBe(signWebhookBody(secret, "{ }"));
  });

  test("signature matches what the receiver would compute via Node crypto", () => {
    const secret = "consumer-side";
    const body = JSON.stringify({ x: 42 });
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(signWebhookBody(secret, body)).toBe(expected);
  });
});
