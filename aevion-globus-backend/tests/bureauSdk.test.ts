import { describe, test, expect, vi } from "vitest";
import { BureauClient, BureauError } from "../sdk/bureau-client/index";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("@aevion/bureau-client", () => {
  test("dashboard() sends bearer", async () => {
    let captured: Headers | null = null;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured = new Headers(init?.headers as HeadersInit);
      return jsonRes(200, { certificates: [], verifications: [], pricing: { verifiedTierCents: 1900, currency: "USD" } });
    }) as unknown as typeof fetch;
    const b = new BureauClient({ baseUrl: "http://x/api/bureau", token: "T", fetch: fetchMock });
    await b.dashboard();
    expect(captured!.get("Authorization")).toBe("Bearer T");
  });

  test("embedUrl/badgeUrl helpers (URL only, no fetch)", () => {
    const b = new BureauClient({ baseUrl: "http://x/api/bureau" });
    expect(b.embedUrl("c-1", { theme: "dark" })).toBe(
      "http://x/api/bureau/cert/c-1/embed?theme=dark",
    );
    expect(b.badgeUrl("c-2", { style: "shield" })).toBe(
      "http://x/api/bureau/cert/c-2/badge.svg?style=shield",
    );
    expect(b.embedUrl("c-3")).toBe("http://x/api/bureau/cert/c-3/embed");
  });

  test("non-2xx throws BureauError", async () => {
    const fetchMock = vi.fn(async () => jsonRes(403, { error: "forbidden" })) as unknown as typeof fetch;
    const b = new BureauClient({ baseUrl: "http://x/api/bureau", fetch: fetchMock });
    try {
      await b.notary("z");
      expect.fail("should have thrown");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(BureauError);
      expect((e as BureauError).status).toBe(403);
    }
  });

  test("upgrade(certId) URL-encodes the id", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(typeof input === "string" ? input : (input as URL).toString());
      return jsonRes(200, { success: true, certId: "c", level: "verified" });
    }) as unknown as typeof fetch;
    const b = new BureauClient({ baseUrl: "http://x/api/bureau", token: "T", fetch: fetchMock });
    await b.upgrade("cert with spaces");
    expect(calls[0]).toBe("http://x/api/bureau/upgrade/cert%20with%20spaces");
  });
});
