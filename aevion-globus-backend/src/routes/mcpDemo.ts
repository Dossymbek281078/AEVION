/**
 * mcpDemo — a REAL, first-party MCP server hosted inside AEVION.
 *
 * It speaks the same Streamable-HTTP JSON-RPC that our agent-runtime MCP bridge
 * (services/agentRuntime/mcpClient.ts) consumes, so it proves the full path
 * "runtime → MCP bridge → external MCP server → tool result" end to end using
 * only our own zone — no third-party client-gating (unlike Higgsfield).
 *
 * Tools are not toys and not only reads: alongside registry lookups it can
 * perform real ecosystem OPERATIONS (QSign HMAC signing; optionally QRight
 * object creation) by internal-fetching the existing endpoints — the same reuse
 * pattern as the DevHub tool executors, with no coupling to their code.
 *
 * Safety: write tools (create_qright_object) are exposed only when
 * MCP_DEMO_WRITES is truthy, so an open endpoint can't create prod records by
 * default. Read + no-persistence tools (list_modules, module_info, qsign_sign)
 * are always available.
 *
 * Protocol handling is a function (handleDemoMcp) driven by an injected
 * ToolContext (baseUrl + fetch + allowWrites), so it is unit tested without a
 * live server; the router is a thin wrapper that adds optional bearer auth.
 */

import { Router } from "express";
import { projects } from "../data/projects";

const PROTOCOL_VERSION = "2025-06-18";

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolContext {
  baseUrl: string;
  fetchImpl: typeof fetch;
  allowWrites: boolean;
}

const READ_TOOLS: McpToolDef[] = [
  {
    name: "list_modules",
    description: "List AEVION product modules with their id, code and status.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", description: "Optional filter, e.g. 'live', 'mvp', 'idea'." } },
    },
  },
  {
    name: "module_info",
    description: "Get one AEVION module's code, name, status, kind and description by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Module id, e.g. 'qright'." } },
      required: ["id"],
    },
  },
  {
    name: "qsign_sign",
    description: "Sign a JSON payload with AEVION QSign (HMAC-SHA256, no persistence). Real cryptographic operation.",
    inputSchema: {
      type: "object",
      properties: { payload: { type: "object", description: "Any JSON object to sign." } },
      required: ["payload"],
    },
  },
];

const WRITE_TOOLS: McpToolDef[] = [
  {
    name: "create_qright_object",
    description: "Register an intellectual-property object in AEVION QRight (creates a real record).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        kind: { type: "string", description: "e.g. 'idea', 'work', 'brand'." },
      },
      required: ["title"],
    },
  },
];

/** Tools visible to the client, gated by write-permission. */
export function toolsFor(allowWrites: boolean): McpToolDef[] {
  return allowWrites ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
}

function textContent(value: unknown) {
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }];
}

/** Execute a demo tool. Read tools use the registry; operation tools internal-fetch. */
export async function runDemoTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ content: unknown; isError: boolean }> {
  if (name === "list_modules") {
    const status = typeof args.status === "string" ? args.status.toLowerCase() : "";
    const list = projects
      .filter((p) => !status || p.status.toLowerCase() === status)
      .map((p) => ({ id: p.id, code: p.code, status: p.status }));
    return { content: textContent({ count: list.length, modules: list }), isError: false };
  }

  if (name === "module_info") {
    const id = typeof args.id === "string" ? args.id : "";
    const p = projects.find((x) => x.id === id || x.code.toLowerCase() === id.toLowerCase());
    if (!p) return { content: textContent(`No module with id "${id}".`), isError: true };
    return {
      content: textContent({ id: p.id, code: p.code, name: p.name, status: p.status, kind: p.kind, description: p.description }),
      isError: false,
    };
  }

  if (name === "qsign_sign") {
    if (args.payload === undefined || args.payload === null) {
      return { content: textContent("payload is required"), isError: true };
    }
    try {
      const r = await ctx.fetchImpl(`${ctx.baseUrl}/api/qsign/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.payload),
      });
      const data = await r.json().catch(() => ({}));
      return { content: textContent(data), isError: !r.ok };
    } catch (e) {
      return { content: textContent((e as Error).message), isError: true };
    }
  }

  if (name === "create_qright_object") {
    if (!ctx.allowWrites) {
      return { content: textContent("create_qright_object is disabled (set MCP_DEMO_WRITES=1 to enable)."), isError: true };
    }
    const title = typeof args.title === "string" ? args.title : "";
    if (!title.trim()) return { content: textContent("title is required"), isError: true };
    try {
      const r = await ctx.fetchImpl(`${ctx.baseUrl}/api/qright/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: typeof args.description === "string" ? args.description : "",
          kind: typeof args.kind === "string" ? args.kind : "idea",
        }),
      });
      const data = await r.json().catch(() => ({}));
      return { content: textContent(data), isError: !r.ok };
    } catch (e) {
      return { content: textContent((e as Error).message), isError: true };
    }
  }

  return { content: textContent(`Unknown tool: ${name}`), isError: true };
}

export interface DemoMcpOutcome {
  status: number;
  body: JsonRpcResponse | null;
}

/** Handle one JSON-RPC MCP request. Notifications (no id) yield 202/no body. */
export async function handleDemoMcp(msg: JsonRpcMessage, ctx: ToolContext): Promise<DemoMcpOutcome> {
  const isNotification = msg.id === undefined || msg.id === null;

  if (msg.method === "initialize") {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "aevion-registry", version: "0.2.0" },
        },
      },
    };
  }

  if (msg.method === "notifications/initialized" || isNotification) {
    return { status: 202, body: null };
  }

  if (msg.method === "tools/list") {
    return { status: 200, body: { jsonrpc: "2.0", id: msg.id, result: { tools: toolsFor(ctx.allowWrites) } } };
  }

  if (msg.method === "tools/call") {
    const name = typeof msg.params?.name === "string" ? msg.params.name : "";
    const args = (msg.params?.arguments as Record<string, unknown>) || {};
    const r = await runDemoTool(name, args, ctx);
    return { status: 200, body: { jsonrpc: "2.0", id: msg.id, result: r } };
  }

  return {
    status: 200,
    body: { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } },
  };
}

export const mcpDemoRouter = Router();

mcpDemoRouter.post("/", async (req, res) => {
  const required = process.env.MCP_DEMO_TOKEN?.trim();
  if (required) {
    const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (got !== required) return res.status(401).json({ error: "Unauthorized" });
  }
  const port = process.env.PORT || "4001";
  const ctx: ToolContext = {
    baseUrl: process.env.SELF_BASE_URL || `http://127.0.0.1:${port}`,
    fetchImpl: fetch,
    allowWrites: /^(1|true|yes)$/i.test(process.env.MCP_DEMO_WRITES || ""),
  };
  const outcome = await handleDemoMcp((req.body || {}) as JsonRpcMessage, ctx);
  res.setHeader("Mcp-Session-Id", "aevion-demo");
  if (outcome.body === null) return res.status(outcome.status).end();
  res.status(outcome.status).json(outcome.body);
});
