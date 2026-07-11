/**
 * mcpDemo — a REAL, first-party MCP server hosted inside AEVION.
 *
 * It speaks the same Streamable-HTTP JSON-RPC that our agent-runtime MCP bridge
 * (services/agentRuntime/mcpClient.ts) consumes, so it proves the full path
 * "runtime → MCP bridge → external MCP server → tool result" end to end using
 * only our own zone — no third-party client-gating (unlike Higgsfield).
 *
 * The tools are not toys: they read the live product registry, so the agent can
 * answer "what's the status of qright?" by CALLING a tool instead of guessing.
 *
 * The protocol handling is a pure function (handleDemoMcp) so it is unit tested
 * without express; the router is a thin wrapper that adds optional bearer auth.
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

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const DEMO_TOOLS: McpToolDef[] = [
  {
    name: "list_modules",
    description: "List AEVION product modules with their id, code and status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Optional filter, e.g. 'live', 'mvp', 'idea'." },
      },
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
];

function textContent(value: unknown) {
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }];
}

/** Execute a demo tool against the live registry. */
export function runDemoTool(name: string, args: Record<string, unknown>): { content: unknown; isError: boolean } {
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
  return { content: textContent(`Unknown tool: ${name}`), isError: true };
}

export interface DemoMcpOutcome {
  /** HTTP status to send. */
  status: number;
  /** JSON-RPC body, or null for a notification (202, empty). */
  body: JsonRpcMessage | null;
}

/**
 * Pure MCP message handler — maps one JSON-RPC request to its response.
 * Notifications (no id) yield a 202 with no body.
 */
export function handleDemoMcp(msg: JsonRpcMessage): DemoMcpOutcome {
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
          serverInfo: { name: "aevion-registry", version: "0.1.0" },
        },
      } as JsonRpcMessage,
    };
  }

  if (msg.method === "notifications/initialized" || isNotification) {
    return { status: 202, body: null };
  }

  if (msg.method === "tools/list") {
    return { status: 200, body: { jsonrpc: "2.0", id: msg.id, result: { tools: DEMO_TOOLS } } as JsonRpcMessage };
  }

  if (msg.method === "tools/call") {
    const name = typeof msg.params?.name === "string" ? msg.params.name : "";
    const args = (msg.params?.arguments as Record<string, unknown>) || {};
    const r = runDemoTool(name, args);
    return { status: 200, body: { jsonrpc: "2.0", id: msg.id, result: r } as JsonRpcMessage };
  }

  return {
    status: 200,
    body: { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } } as JsonRpcMessage,
  };
}

export const mcpDemoRouter = Router();

// Optional static-token gate — demonstrates the bridge's bearer-token path.
mcpDemoRouter.post("/", (req, res) => {
  const required = process.env.MCP_DEMO_TOKEN?.trim();
  if (required) {
    const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (got !== required) return res.status(401).json({ error: "Unauthorized" });
  }
  const outcome = handleDemoMcp((req.body || {}) as JsonRpcMessage);
  res.setHeader("Mcp-Session-Id", "aevion-demo");
  if (outcome.body === null) return res.status(outcome.status).end();
  res.status(outcome.status).json(outcome.body);
});
