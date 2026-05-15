import { describe, test, expect, vi } from "vitest";
import { QRightClient, QRightError } from "../sdk/qright-client/index";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("@aevion/qright-client", () => {
  test("listObjects() composes query string from filters", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(typeof input === "string" ? input : (input as URL).toString());
      return jsonRes(200, { objects: [], total: 0, limit: 0, offset: 0 });
    }) as unknown as typeof fetch;
    const qr = new QRightClient({ baseUrl: "http://x/api/qright", fetch: fetchMock });
    await qr.listObjects({ kind: "music", q: "hello world", limit: 10 });
    const url = calls[0];
    expect(url).toContain("kind=music");
    expect(url).toContain("q=hello+world");
    expect(url).toContain("limit=10");
  });

  test("embedUrl/badgeUrl helpers (URL only, no fetch)", () => {
    const qr = new QRightClient({ baseUrl: "http://x/api/qright" });
    expect(qr.embedUrl("o-1", { theme: "dark" })).toBe(
      "http://x/api/qright/embed/o-1?theme=dark",
    );
    expect(qr.badgeUrl("o-2", { style: "shield" })).toBe(
      "http://x/api/qright/badge/o-2.svg?style=shield",
    );
    // No params → no trailing ?
    expect(qr.embedUrl("o-3")).toBe("http://x/api/qright/embed/o-3");
  });

  test("non-2xx throws QRightError", async () => {
    const fetchMock = vi.fn(async () => jsonRes(403, { error: "forbidden" })) as unknown as typeof fetch;
    const qr = new QRightClient({ baseUrl: "http://x/api/qright", fetch: fetchMock });
    try {
      await qr.getObject("z");
      expect.fail("should have thrown");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(QRightError);
      expect((e as QRightError).status).toBe(403);
    }
  });

  test("createObject() sends bearer + JSON body when token set", async () => {
    let captured: { headers: Headers; body: string } | null = null;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured = {
        headers: new Headers(init?.headers as HeadersInit),
        body: typeof init?.body === "string" ? init!.body : "",
      };
      return jsonRes(200, { id: "o-1" });
    }) as unknown as typeof fetch;
    const qr = new QRightClient({ baseUrl: "http://x/api/qright", token: "T", fetch: fetchMock });
    await qr.createObject({ title: "t", kind: "music", authorName: "A", contentHash: "h" });
    expect(captured!.headers.get("Authorization")).toBe("Bearer T");
    expect(JSON.parse(captured!.body).title).toBe("t");
  });
});
