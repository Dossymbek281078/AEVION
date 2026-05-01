import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyQSignWebhookSignature,
  qsignWebhookMiddleware,
} from "../sdk/qsign-webhook-receiver";

const SECRET = "shared-secret-for-tests-32chars-min";

function signBody(body: string | Buffer): string {
  const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return crypto.createHmac("sha256", SECRET).update(buf).digest("hex");
}

describe("qsign-webhook-receiver: verifyQSignWebhookSignature", () => {
  it("returns true for a valid raw-string body + correct signature", () => {
    const body = JSON.stringify({ event: "sign", data: { id: "abc" } });
    expect(verifyQSignWebhookSignature(body, signBody(body), SECRET)).toBe(true);
  });

  it("returns true for Buffer body", () => {
    const body = Buffer.from('{"event":"revoke"}', "utf8");
    expect(verifyQSignWebhookSignature(body, signBody(body), SECRET)).toBe(true);
  });

  it("rejects tampered body", () => {
    const body = '{"event":"sign","data":{"id":"abc"}}';
    const sig = signBody(body);
    const tampered = '{"event":"sign","data":{"id":"BAD"}}';
    expect(verifyQSignWebhookSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects mismatched secret", () => {
    const body = '{"event":"sign"}';
    const sig = signBody(body);
    expect(verifyQSignWebhookSignature(body, sig, "wrong-secret")).toBe(false);
  });

  it("rejects missing or empty signature header", () => {
    const body = "x";
    expect(verifyQSignWebhookSignature(body, undefined, SECRET)).toBe(false);
    expect(verifyQSignWebhookSignature(body, "", SECRET)).toBe(false);
  });

  it("rejects non-hex signature", () => {
    expect(verifyQSignWebhookSignature("x", "not-hex-at-all-not-64-chars-long", SECRET)).toBe(false);
  });

  it("rejects array-valued header (multi-value abuse)", () => {
    const body = "x";
    const sig = signBody(body);
    expect(verifyQSignWebhookSignature(body, [sig, sig] as any, SECRET)).toBe(false);
  });

  it("rejects empty secret", () => {
    expect(verifyQSignWebhookSignature("x", "0".repeat(64), "")).toBe(false);
  });

  it("is case-insensitive on the hex header", () => {
    const body = "x";
    const sig = signBody(body);
    expect(verifyQSignWebhookSignature(body, sig.toUpperCase(), SECRET)).toBe(true);
  });
});

describe("qsign-webhook-receiver: qsignWebhookMiddleware", () => {
  type FakeReq = {
    rawBody?: Buffer | string;
    body?: any;
    headers: Record<string, any>;
    qsignEvent?: any;
  };
  type FakeRes = {
    statusCode?: number;
    payload?: any;
    status: (s: number) => FakeRes;
    json: (p: any) => FakeRes;
    end: () => FakeRes;
  };
  function makeRes(): FakeRes {
    const res: FakeRes = {
      status(s) {
        this.statusCode = s;
        return this;
      },
      json(p) {
        this.payload = p;
        return this;
      },
      end() {
        return this;
      },
    };
    return res;
  }

  it("calls next() on valid signature", () => {
    const body = '{"event":"sign","data":{"id":"abc"}}';
    const sig = signBody(body);
    const req: FakeReq = {
      rawBody: body,
      body: JSON.parse(body),
      headers: { "x-qsign-signature": sig },
    };
    const res = makeRes();
    let called = false;
    const mw = qsignWebhookMiddleware({ secret: SECRET });
    mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.qsignEvent?.event).toBe("sign");
  });

  it("rejects with 401 on bad signature", () => {
    const req: FakeReq = {
      rawBody: '{"event":"sign"}',
      headers: { "x-qsign-signature": "0".repeat(64) },
    };
    const res = makeRes();
    let called = false;
    qsignWebhookMiddleware({ secret: SECRET })(req, res, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.payload?.error).toBe("qsign_webhook_invalid_signature");
  });

  it("returns 400 if rawBody missing (parser misconfigured)", () => {
    const req: FakeReq = { headers: { "x-qsign-signature": "x" } };
    const res = makeRes();
    qsignWebhookMiddleware({ secret: SECRET })(req, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toBe("qsign_webhook_no_raw_body");
  });
});
