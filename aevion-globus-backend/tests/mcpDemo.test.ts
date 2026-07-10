/**
 * Tests for the first-party AEVION MCP server (routes/mcpDemo) — both its pure
 * protocol handler and, crucially, a real cross-component integration: the
 * actual agent-runtime MCP bridge (McpHttpClient) driven against this server's
 * actual handler through an in-process fake fetch. That proves our client and
 * our server speak the same MCP wire protocol — the exact path exercised on prod
 * by GET /api/agent-runtime/mcp-selftest.
 */
import { describe, test, expect } from "vitest";
import { handleDemoMcp, runDemoTool, DEMO_TOOLS } from "../src/routes/mcpDemo";
import { loadMcpBridge } from "../src/services/agentRuntime/mcpBridge";

describe("runDemoTool", () => {
  test("list_modules returns real registry entries", () => {
    const r = runDemoTool("list_modules", {});
    const payload = JSON.parse((r.content as Array<{ text: string }>)[0].text);
    expect(r.isError).toBe(false);
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.modules[0]).toHaveProperty("id");
    expect(payload.modules[0]).toHaveProperty("status");
  });

  test("list_modules filters by status", () => {
    const all = JSON.parse((runDemoTool("list_modules", {}).content as Array<{ text: string }>)[0].text);
    const live = JSON.parse((runDemoTool("list_modules", { status: "live" }).content as Array<{ text: string }>)[0].text);
    expect(live.count).toBeLessThanOrEqual(all.count);
    expect(live.modules.every((m: { status: string }) => m.status === "live")).toBe(true);
  });

  test("module_info returns a known module and errors on unknown", () => {
    const ok = runDemoTool("module_info", { id: "qright" });
    expect(ok.isError).toBe(false);
    expect((ok.content as Array<{ text: string }>)[0].text).toMatch(/qright/i);

    const bad = runDemoTool("module_info", { id: "does-not-exist" });
    expect(bad.isError).toBe(true);
  });
});

describe("handleDemoMcp (protocol)", () => {
  test("initialize returns serverInfo + capabilities", () => {
    const out = handleDemoMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(out.status).toBe(200);
    const result = (out.body as { result: { serverInfo: { name: string }; capabilities: unknown } }).result;
    expect(result.serverInfo.name).toBe("aevion-registry");
    expect(result.capabilities).toHaveProperty("tools");
  });

  test("initialized notification → 202 with no body", () => {
    const out = handleDemoMcp({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(out.status).toBe(202);
    expect(out.body).toBeNull();
  });

  test("tools/list returns the demo tools", () => {
    const out = handleDemoMcp({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const tools = (out.body as { result: { tools: typeof DEMO_TOOLS } }).result.tools;
    expect(tools.map((t) => t.name)).toEqual(["list_modules", "module_info"]);
  });

  test("tools/call runs the tool", () => {
    const out = handleDemoMcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "module_info", arguments: { id: "qsign" } },
    });
    const result = (out.body as { result: { isError: boolean; content: Array<{ text: string }> } }).result;
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toMatch(/qsign/i);
  });

  test("unknown method → JSON-RPC error -32601", () => {
    const out = handleDemoMcp({ jsonrpc: "2.0", id: 4, method: "nope" });
    expect((out.body as { error: { code: number } }).error.code).toBe(-32601);
  });
});

describe("bridge ↔ demo server (in-process integration)", () => {
  // A fake fetch that runs the demo server's real handler in-process.
  const fakeFetch = (async (_url: string, init?: { body?: string }) => {
    const msg = JSON.parse(init?.body ?? "{}");
    const outcome = handleDemoMcp(msg);
    return {
      ok: outcome.status < 400,
      status: outcome.status,
      headers: {
        get: (k: string) => (k.toLowerCase() === "mcp-session-id" ? "aevion-demo" : "application/json"),
      },
      text: async () => (outcome.body === null ? "" : JSON.stringify(outcome.body)),
    };
  }) as unknown as typeof fetch;

  test("the real client lists and calls the real server's tools", async () => {
    const bridge = await loadMcpBridge({
      config: [{ name: "aevion", url: "http://x/api/mcp-demo" }],
      fetchImpl: fakeFetch,
    });

    expect(bridge.specs.map((s) => s.name)).toEqual(["mcp_aevion_list_modules", "mcp_aevion_module_info"]);
    expect(bridge.servers[0]).toMatchObject({ name: "aevion", toolCount: 2 });

    const out = await bridge.exec({ id: "1", name: "mcp_aevion_module_info", input: { id: "qright" } });
    expect(out.ok).toBe(true);
    expect(String(out.content)).toMatch(/qright/i);
  });
});
