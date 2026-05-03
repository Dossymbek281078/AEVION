import { describe, test, expect, vi } from "vitest";
import { PlanetClient, PlanetError } from "../sdk/planet-client/index";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("@aevion/planet-client", () => {
  test("stats() composes optional productKeyPrefix query", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(typeof input === "string" ? input : (input as URL).toString());
      return jsonRes(200, { eligibleParticipants: 0 });
    }) as unknown as typeof fetch;
    const p = new PlanetClient({ baseUrl: "http://x/api/planet", fetch: fetchMock });
    await p.stats();
    await p.stats("aevion_award");
    expect(calls[0]).toBe("http://x/api/planet/stats");
    expect(calls[1]).toBe("http://x/api/planet/stats?productKeyPrefix=aevion_award");
  });

  test("recentArtifacts() composes filters", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(typeof input === "string" ? input : (input as URL).toString());
      return jsonRes(200, { items: [], total: 0 });
    }) as unknown as typeof fetch;
    const p = new PlanetClient({ baseUrl: "http://x/api/planet", fetch: fetchMock });
    await p.recentArtifacts({ artifactType: "music", limit: 10, sort: "votes" });
    expect(calls[0]).toContain("artifactType=music");
    expect(calls[0]).toContain("limit=10");
    expect(calls[0]).toContain("sort=votes");
  });

  test("non-2xx throws PlanetError", async () => {
    const fetchMock = vi.fn(async () => jsonRes(500, { error: "boom" })) as unknown as typeof fetch;
    const p = new PlanetClient({ baseUrl: "http://x/api/planet", fetch: fetchMock });
    try {
      await p.stats();
      expect.fail("should have thrown");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(PlanetError);
      expect((e as PlanetError).status).toBe(500);
    }
  });

  test("submit() sends bearer + body", async () => {
    let captured: { headers: Headers; body: string } | null = null;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured = {
        headers: new Headers(init?.headers as HeadersInit),
        body: typeof init?.body === "string" ? init!.body : "",
      };
      return jsonRes(200, { submissionId: "s-1" });
    }) as unknown as typeof fetch;
    const p = new PlanetClient({ baseUrl: "http://x/api/planet", token: "T", fetch: fetchMock });
    await p.submit({ artifactType: "code", title: "t", productKey: "k", codeFiles: [] });
    expect(captured!.headers.get("Authorization")).toBe("Bearer T");
    expect(JSON.parse(captured!.body).artifactType).toBe("code");
  });
});
