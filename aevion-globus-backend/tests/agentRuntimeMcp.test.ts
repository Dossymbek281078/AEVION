/**
 * Tests for the remote MCP bridge — the layer that lets the agent runtime
 * borrow tools from remote HTTP MCP servers (Higgsfield & co.).
 *
 * Deterministic: a fake `fetch` simulates the JSON-RPC handshake
 * (initialize → tools/list → tools/call); no network, no real MCP server.
 */
import { describe, test, expect } from "vitest";
import {
  McpHttpClient,
  parseRpcBody,
  flattenContent,
  type McpServerConfig,
} from "../src/services/agentRuntime/mcpClient";
import { parseMcpConfig, namespaceToolName, loadMcpBridge } from "../src/services/agentRuntime/mcpBridge";

// ── parseRpcBody ─────────────────────────────────────────────────────

describe("parseRpcBody", () => {
  test("parses a plain JSON body", () => {
    const obj = parseRpcBody('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}', "application/json");
    expect(obj.result).toEqual({ ok: true });
  });

  test("parses an SSE body and picks the frame carrying result", () => {
    const sse = [
      "event: message",
      'data: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}',
      "",
      "event: message",
      'data: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}',
      "",
    ].join("\n");
    const obj = parseRpcBody(sse, "text/event-stream; charset=utf-8");
    expect(obj.result).toEqual({ tools: [] });
  });
});

// ── flattenContent ───────────────────────────────────────────────────

describe("flattenContent", () => {
  test("joins text blocks into a string", () => {
    expect(flattenContent([{ type: "text", text: "a" }, { type: "text", text: "b" }])).toBe("a\nb");
  });
  test("keeps non-text blocks alongside text", () => {
    const out = flattenContent([{ type: "text", text: "hi" }, { type: "image", url: "u" }]) as {
      text: string;
      blocks: unknown[];
    };
    expect(out.text).toBe("hi");
    expect(out.blocks).toEqual([{ type: "image", url: "u" }]);
  });
});

// ── parseMcpConfig ───────────────────────────────────────────────────

describe("parseMcpConfig", () => {
  test("empty / undefined → no servers", () => {
    expect(parseMcpConfig(undefined)).toEqual([]);
    expect(parseMcpConfig("")).toEqual([]);
  });
  test("parses a valid array and drops non-http / malformed entries", () => {
    const cfg = parseMcpConfig(
      JSON.stringify([
        { name: "higgsfield", url: "https://mcp.higgsfield.ai/mcp", token: "t" },
        { name: "local", url: "stdio://nope" }, // dropped: not http
        { url: "https://x/mcp" }, // dropped: no name
      ]),
    );
    expect(cfg).toEqual([{ name: "higgsfield", url: "https://mcp.higgsfield.ai/mcp", token: "t" }]);
  });
  test("invalid JSON throws a clear error", () => {
    expect(() => parseMcpConfig("{not json")).toThrow(/not valid JSON/i);
  });
});

// ── namespaceToolName ────────────────────────────────────────────────

describe("namespaceToolName", () => {
  test("sanitises and namespaces", () => {
    expect(namespaceToolName("higgsfield", "generate_video")).toBe("mcp_higgsfield_generate_video");
    expect(namespaceToolName("hf.ai", "make image")).toBe("mcp_hf_ai_make_image");
  });
  test("result is Anthropic-tool-name safe (<=64, allowed chars)", () => {
    const n = namespaceToolName("server", "x".repeat(200));
    expect(n.length).toBeLessThanOrEqual(64);
    expect(n).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});

// ── McpHttpClient (fake transport) ───────────────────────────────────

/** Build a fake fetch that plays a scripted MCP server. */
function fakeMcpServer(script: {
  tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
  onCall?: (name: string, args: Record<string, unknown>) => { content: unknown; isError?: boolean };
  sessionId?: string;
}) {
  const calls: Array<{ method: string; params: unknown }> = [];
  const fetchImpl = (async (_url: string, init?: { body?: string }) => {
    const msg = JSON.parse(init?.body ?? "{}") as { id?: number; method: string; params?: unknown };
    calls.push({ method: msg.method, params: msg.params });
    const headers = {
      get: (k: string) =>
        k.toLowerCase() === "mcp-session-id" ? script.sessionId ?? "sess-1" : "application/json",
    };
    // Notifications get a 202 with no body.
    if (msg.id === undefined) return { ok: true, status: 202, headers, text: async () => "" };

    let result: unknown = {};
    if (msg.method === "initialize") result = { protocolVersion: "2025-06-18", capabilities: {} };
    else if (msg.method === "tools/list") result = { tools: script.tools ?? [] };
    else if (msg.method === "tools/call") {
      const p = msg.params as { name: string; arguments: Record<string, unknown> };
      const r = script.onCall?.(p.name, p.arguments) ?? { content: [{ type: "text", text: "ok" }] };
      result = { content: r.content, isError: Boolean(r.isError) };
    }
    return { ok: true, status: 200, headers, text: async () => JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }) };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("McpHttpClient", () => {
  const cfg: McpServerConfig = { name: "higgsfield", url: "https://mcp.higgsfield.ai/mcp", token: "tok" };

  test("initialize → tools/list returns the server's tools", async () => {
    const { fetchImpl, calls } = fakeMcpServer({
      tools: [{ name: "generate_video", description: "make a video" }],
    });
    const client = new McpHttpClient(cfg, fetchImpl);
    const tools = await client.listTools();
    expect(tools).toEqual([{ name: "generate_video", description: "make a video" }]);
    // initialize + initialized notification precede tools/list.
    expect(calls.map((c) => c.method)).toEqual(["initialize", "notifications/initialized", "tools/list"]);
  });

  test("callTool sends name+arguments and flattens the text result", async () => {
    let seen: { name: string; args: Record<string, unknown> } | undefined;
    const { fetchImpl } = fakeMcpServer({
      onCall: (name, args) => {
        seen = { name, args };
        return { content: [{ type: "text", text: "job queued" }] };
      },
    });
    const client = new McpHttpClient(cfg, fetchImpl);
    const r = await client.callTool("generate_video", { prompt: "a fox" });
    expect(seen).toEqual({ name: "generate_video", args: { prompt: "a fox" } });
    expect(r.isError).toBe(false);
    expect(r.content).toBe("job queued");
  });
});

// ── loadMcpBridge ────────────────────────────────────────────────────

describe("loadMcpBridge", () => {
  test("namespaces tools and routes a call to the owning server", async () => {
    const { fetchImpl } = fakeMcpServer({
      tools: [{ name: "generate_video", description: "make a video", inputSchema: { type: "object", properties: {} } }],
      onCall: () => ({ content: [{ type: "text", text: "done" }] }),
    });
    const bridge = await loadMcpBridge({
      config: [{ name: "higgsfield", url: "https://mcp.higgsfield.ai/mcp" }],
      fetchImpl,
    });

    expect(bridge.specs.map((s) => s.name)).toEqual(["mcp_higgsfield_generate_video"]);
    expect(bridge.specs[0].description).toContain("[higgsfield]");
    expect(bridge.owns.has("mcp_higgsfield_generate_video")).toBe(true);
    expect(bridge.servers).toEqual([{ name: "higgsfield", url: "https://mcp.higgsfield.ai/mcp", toolCount: 1 }]);

    const out = await bridge.exec({ id: "1", name: "mcp_higgsfield_generate_video", input: { prompt: "x" } });
    expect(out.ok).toBe(true);
    expect(out.content).toBe("done");
  });

  test("a call to an unknown MCP tool fails cleanly", async () => {
    const { fetchImpl } = fakeMcpServer({ tools: [] });
    const bridge = await loadMcpBridge({
      config: [{ name: "higgsfield", url: "https://mcp.higgsfield.ai/mcp" }],
      fetchImpl,
    });
    const out = await bridge.exec({ id: "1", name: "mcp_higgsfield_nope", input: {} });
    expect(out.ok).toBe(false);
    expect(String(out.content)).toMatch(/unknown mcp tool/i);
  });

  test("a broken server is reported in errors and does not sink the others", async () => {
    const good = fakeMcpServer({ tools: [{ name: "ok_tool" }] });
    // A client factory that fails only for the "bad" server.
    const bridge = await loadMcpBridge({
      config: [
        { name: "bad", url: "https://bad/mcp" },
        { name: "good", url: "https://good/mcp" },
      ],
      fetchImpl: good.fetchImpl,
      makeClient: (cfg, f) => {
        if (cfg.name === "bad") {
          return {
            listTools: async () => {
              throw new Error("connection refused");
            },
          } as unknown as McpHttpClient;
        }
        return new McpHttpClient(cfg, f);
      },
    });

    const bad = bridge.servers.find((s) => s.name === "bad");
    const ok = bridge.servers.find((s) => s.name === "good");
    expect(bad?.error).toMatch(/connection refused/);
    expect(bad?.toolCount).toBe(0);
    expect(ok?.toolCount).toBe(1);
    expect(bridge.specs.map((s) => s.name)).toEqual(["mcp_good_ok_tool"]);
  });
});
