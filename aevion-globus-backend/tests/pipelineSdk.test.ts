import { describe, test, expect, vi } from "vitest";
import { PipelineClient, PipelineError, publicVerifyUrl } from "../sdk/pipeline-client/index";

function fakeFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return vi.fn(handler) as unknown as typeof fetch;
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("@aevion/pipeline-client", () => {
  test("baseUrl trailing slashes are stripped", () => {
    const c = new PipelineClient({ baseUrl: "http://x/api/pipeline///" });
    expect((c as any).baseUrl).toBe("http://x/api/pipeline");
  });

  test("verify() composes correct GET path and parses body", async () => {
    const calls: string[] = [];
    const fetchMock = fakeFetch(async (input) => {
      calls.push(typeof input === "string" ? input : (input as URL).toString());
      return jsonRes(200, { valid: true, certificate: { id: "cert-1" } });
    });
    const c = new PipelineClient({ baseUrl: "http://x/api/pipeline", fetch: fetchMock });
    const out = await c.verify("cert with spaces");
    expect(calls[0]).toBe("http://x/api/pipeline/verify/cert%20with%20spaces");
    expect(out.valid).toBe(true);
  });

  test("protect() sends bearer + JSON body when token set", async () => {
    let captured: { headers: Headers; body: string } | null = null;
    const fetchMock = fakeFetch(async (_input, init) => {
      captured = {
        headers: new Headers(init?.headers as HeadersInit),
        body: typeof init?.body === "string" ? init!.body : "",
      };
      return jsonRes(200, { shield: {}, certificate: {} });
    });
    const c = new PipelineClient({ baseUrl: "http://x/api/pipeline", token: "T", fetch: fetchMock });
    await c.protect({ title: "x" });
    expect(captured!.headers.get("Authorization")).toBe("Bearer T");
    expect(JSON.parse(captured!.body)).toEqual({ title: "x" });
  });

  test("non-2xx throws PipelineError carrying status + body", async () => {
    const fetchMock = fakeFetch(async () => jsonRes(404, { error: "missing" }));
    const c = new PipelineClient({ baseUrl: "http://x/api/pipeline", fetch: fetchMock });
    try {
      await c.verify("nope");
      expect.fail("should have thrown");
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(PipelineError);
      const pe = e as PipelineError;
      expect(pe.status).toBe(404);
      expect((pe.body as Record<string, unknown>).error).toBe("missing");
    }
  });

  test("pdf() / otsProof() return raw ArrayBuffer", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = fakeFetch(async () =>
      new Response(bytes, { status: 200, headers: { "Content-Type": "application/pdf" } }),
    );
    const c = new PipelineClient({ baseUrl: "http://x/api/pipeline", fetch: fetchMock });
    const buf = await c.pdf("cert-1");
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(buf).length).toBe(4);
  });

  test("publicVerifyUrl helper", () => {
    expect(publicVerifyUrl("cert-x")).toBe("https://aevion.com/verify/cert-x");
    expect(publicVerifyUrl("a/b", "http://localhost:3000/")).toBe(
      "http://localhost:3000/verify/a%2Fb",
    );
  });
});
