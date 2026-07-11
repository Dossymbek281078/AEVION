/**
 * Tests for the first-party AEVION MCP server (routes/mcpDemo) — its protocol
 * handler, its registry-backed reads, its real operation tools (qsign_sign and
 * the write-gated create_qright_object), and a real cross-component integration:
 * the actual agent-runtime MCP bridge (McpHttpClient) driven against this
 * server's actual handler through an in-process fake fetch. That proves our
 * client and server speak the same MCP wire protocol — the exact path exercised
 * on prod by GET /api/agent-runtime/mcp-selftest.
 */
import { describe, test, expect } from "vitest";
import { handleDemoMcp, runDemoTool, toolsFor, type ToolContext } from "../src/routes/mcpDemo";
import { loadMcpBridge } from "../src/services/agentRuntime/mcpBridge";

/** A fetch that answers the internal endpoints the operation tools call. */
function opFetch(overrides?: { qsignOk?: boolean; qrightOk?: boolean }) {
  const seen: Array<{ url: string; body: unknown }> = [];
  const fetchImpl = (async (url: string, init?: { body?: string }) => {
    seen.push({ url, body: JSON.parse(init?.body ?? "{}") });
    if (url.endsWith("/api/qsign/sign")) {
      return { ok: overrides?.qsignOk !== false, json: async () => ({ signature: "abc123", algo: "HMAC-SHA256" }) };
    }
    if (url.endsWith("/api/qright/objects")) {
      return { ok: overrides?.qrightOk !== false, json: async () => ({ id: "qr_1", title: "T" }) };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

const ctx = (over?: Partial<ToolContext>): ToolContext => ({
  baseUrl: "http://127.0.0.1:4001",
  fetchImpl: opFetch().fetchImpl,
  allowWrites: false,
  ...over,
});

describe("toolsFor (write gating)", () => {
  test("read-only by default; write tool appears only when allowed", () => {
    expect(toolsFor(false).map((t) => t.name)).toEqual(["list_modules", "module_info", "qsign_sign"]);
    expect(toolsFor(true).map((t) => t.name)).toContain("create_qright_object");
  });
});

describe("runDemoTool — reads", () => {
  test("list_modules returns real registry entries", async () => {
    const r = await runDemoTool("list_modules", {}, ctx());
    const payload = JSON.parse((r.content as Array<{ text: string }>)[0].text);
    expect(r.isError).toBe(false);
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.modules[0]).toHaveProperty("status");
  });

  test("list_modules filters by status", async () => {
    const all = JSON.parse(((await runDemoTool("list_modules", {}, ctx())).content as Array<{ text: string }>)[0].text);
    const live = JSON.parse(((await runDemoTool("list_modules", { status: "live" }, ctx())).content as Array<{ text: string }>)[0].text);
    expect(live.count).toBeLessThanOrEqual(all.count);
    expect(live.modules.every((m: { status: string }) => m.status === "live")).toBe(true);
  });

  test("module_info known + unknown", async () => {
    expect((await runDemoTool("module_info", { id: "qright" }, ctx())).isError).toBe(false);
    expect((await runDemoTool("module_info", { id: "nope" }, ctx())).isError).toBe(true);
  });
});

describe("runDemoTool — operations", () => {
  test("qsign_sign internal-fetches /api/qsign/sign with the payload", async () => {
    const { fetchImpl, seen } = opFetch();
    const r = await runDemoTool("qsign_sign", { payload: { a: 1 } }, ctx({ fetchImpl }));
    expect(r.isError).toBe(false);
    expect(String((r.content as Array<{ text: string }>)[0].text)).toMatch(/signature/);
    expect(seen[0].url).toBe("http://127.0.0.1:4001/api/qsign/sign");
    expect(seen[0].body).toEqual({ a: 1 });
  });

  test("qsign_sign requires a payload", async () => {
    const r = await runDemoTool("qsign_sign", {}, ctx());
    expect(r.isError).toBe(true);
  });

  test("create_qright_object is blocked unless writes are allowed", async () => {
    const blocked = await runDemoTool("create_qright_object", { title: "X" }, ctx({ allowWrites: false }));
    expect(blocked.isError).toBe(true);
    expect(String((blocked.content as Array<{ text: string }>)[0].text)).toMatch(/disabled/i);
  });

  test("create_qright_object writes when allowed", async () => {
    const { fetchImpl, seen } = opFetch();
    const r = await runDemoTool("create_qright_object", { title: "My IP", kind: "work" }, ctx({ allowWrites: true, fetchImpl }));
    expect(r.isError).toBe(false);
    expect(seen[0].url).toBe("http://127.0.0.1:4001/api/qright/objects");
    expect((seen[0].body as { title: string }).title).toBe("My IP");
  });
});

describe("handleDemoMcp (protocol)", () => {
  test("initialize returns serverInfo", async () => {
    const out = await handleDemoMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, ctx());
    expect((out.body as { result: { serverInfo: { name: string } } }).result.serverInfo.name).toBe("aevion-registry");
  });

  test("initialized notification → 202/null", async () => {
    const out = await handleDemoMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx());
    expect(out.status).toBe(202);
    expect(out.body).toBeNull();
  });

  test("tools/list reflects write gating", async () => {
    const ro = await handleDemoMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx({ allowWrites: false }));
    const rw = await handleDemoMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx({ allowWrites: true }));
    const roNames = (ro.body as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
    const rwNames = (rw.body as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
    expect(roNames).not.toContain("create_qright_object");
    expect(rwNames).toContain("create_qright_object");
  });

  test("tools/call runs the tool", async () => {
    const out = await handleDemoMcp(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "module_info", arguments: { id: "qsign" } } },
      ctx(),
    );
    const result = (out.body as { result: { isError: boolean; content: Array<{ text: string }> } }).result;
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toMatch(/qsign/i);
  });

  test("unknown method → -32601", async () => {
    const out = await handleDemoMcp({ jsonrpc: "2.0", id: 4, method: "nope" }, ctx());
    expect((out.body as { error: { code: number } }).error.code).toBe(-32601);
  });
});

describe("bridge ↔ demo server (in-process integration)", () => {
  // Fake fetch that routes both the MCP endpoint AND the internal op endpoints.
  const fakeFetch = (async (url: string, init?: { body?: string }) => {
    if (url.endsWith("/api/mcp-demo")) {
      const msg = JSON.parse(init?.body ?? "{}");
      const innerCtx: ToolContext = { baseUrl: "http://x", fetchImpl: fakeFetch, allowWrites: false };
      const outcome = await handleDemoMcp(msg, innerCtx);
      return {
        ok: outcome.status < 400,
        status: outcome.status,
        headers: { get: (k: string) => (k.toLowerCase() === "mcp-session-id" ? "aevion-demo" : "application/json") },
        text: async () => (outcome.body === null ? "" : JSON.stringify(outcome.body)),
      };
    }
    if (url.endsWith("/api/qsign/sign")) {
      return { ok: true, headers: { get: () => "application/json" }, text: async () => "", json: async () => ({ signature: "sig" }) };
    }
    return { ok: false, headers: { get: () => "application/json" }, text: async () => "", json: async () => ({}) };
  }) as unknown as typeof fetch;

  test("the real client lists and calls the real server's tools", async () => {
    const bridge = await loadMcpBridge({
      config: [{ name: "aevion", url: "http://x/api/mcp-demo" }],
      fetchImpl: fakeFetch,
    });
    expect(bridge.specs.map((s) => s.name)).toEqual([
      "mcp_aevion_list_modules",
      "mcp_aevion_module_info",
      "mcp_aevion_qsign_sign",
    ]);
    const out = await bridge.exec({ id: "1", name: "mcp_aevion_module_info", input: { id: "qright" } });
    expect(out.ok).toBe(true);
    expect(String(out.content)).toMatch(/qright/i);
  });
});
