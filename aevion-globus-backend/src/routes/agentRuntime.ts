/**
 * agentRuntime route — POST /api/agent-runtime/run.
 *
 * Our own agent runtime: a real provider tool-use loop (Anthropic function-
 * calling) that can carry out actions through existing DevHub endpoints. Kept
 * separate from qcoreai so the other work stream stays untouched.
 *
 * On top of the native DevHub tools it can also borrow tools from REMOTE HTTP
 * MCP servers (e.g. Higgsfield) when AGENT_RUNTIME_MCP_SERVERS is configured —
 * see services/agentRuntime/mcpBridge.ts. With nothing configured it behaves
 * exactly as before (native tools only).
 */

import { Router } from "express";
import { runAgentLoop } from "../services/agentRuntime/loop";
import type { ExecTool, ToolCall } from "../services/agentRuntime/loop";
import { TOOL_SPECS, makeExecutor } from "../services/agentRuntime/tools";
import { makeAnthropicCallModel } from "../services/agentRuntime/anthropicClient";
import { parseMcpConfig, loadMcpBridge } from "../services/agentRuntime/mcpBridge";

export const agentRuntimeRouter = Router();

const SYSTEM_PROMPT =
  "You are AEVION Agent. Answer briefly. When the user asks for an artifact — an image, a voice or music " +
  "clip, a sound effect, a payment link, an email, an SMS, a translation, a code file in their open DevHub " +
  "project, a GitHub pull request (or merging one), or anything a connected tool can do — call the matching " +
  "tool instead of describing it. Prefer one tool call at a time, then summarise the result for the user. " +
  "Use read_project_file when you need to see a file that isn't already in your context before generating or " +
  "editing code — e.g. shared types or a config file a new file must match. If generate_code, " +
  "create_pull_request, merge_pull_request, or read_project_file reports it has no open project, tell the " +
  "user to open a DevHub project first instead of retrying. If create_pull_request or merge_pull_request " +
  "reports no GitHub repo is linked yet, tell the user to push to GitHub from the project first instead of " +
  "retrying. Never call merge_pull_request unless the user explicitly asked you to merge — opening a PR does " +
  "not imply permission to merge it.";

agentRuntimeRouter.get("/health", async (_req, res) => {
  const mcpConfigured = parseMcpConfig(process.env.AGENT_RUNTIME_MCP_SERVERS);
  // Mirror /run: surface our first-party demo MCP server when it is enabled, so
  // the dock's tool indicator reflects exactly what /run would expose.
  if (/^(1|true|yes)$/i.test(process.env.AGENT_RUNTIME_MCP_DEMO || "")) {
    const port = process.env.PORT || "4001";
    const baseUrl = process.env.SELF_BASE_URL || `http://127.0.0.1:${port}`;
    mcpConfigured.push({
      name: "aevion",
      url: `${baseUrl}/api/mcp-demo`,
      ...(process.env.MCP_DEMO_TOKEN ? { token: process.env.MCP_DEMO_TOKEN } : {}),
    });
  }
  // List remote MCP tools too, but never let a slow/broken server fail /health.
  let mcpServers: Array<{ name: string; url: string; toolCount: number; error?: string }> = [];
  let mcpTools: string[] = [];
  if (mcpConfigured.length) {
    try {
      const bridge = await loadMcpBridge({ config: mcpConfigured });
      mcpServers = bridge.servers;
      mcpTools = bridge.specs.map((t) => t.name);
    } catch (e) {
      mcpServers = [{ name: "(all)", url: "", toolCount: 0, error: (e as Error).message }];
    }
  }
  res.json({
    service: "agent-runtime",
    ok: true,
    keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.AGENT_RUNTIME_MODEL || "claude-sonnet-5",
    tools: [...TOOL_SPECS.map((t) => t.name), ...mcpTools],
    nativeTools: TOOL_SPECS.map((t) => t.name),
    mcpServers,
  });
});

agentRuntimeRouter.post("/run", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "message required" });

  const port = process.env.PORT || "4001";
  const baseUrl = process.env.SELF_BASE_URL || `http://127.0.0.1:${port}`;
  const maxSteps = Math.min(8, Math.max(1, Number(req.body?.maxSteps) || 5));
  const projectId = typeof req.body?.projectId === "string" && req.body.projectId.trim() ? req.body.projectId.trim() : undefined;

  try {
    const devhubExec = makeExecutor(baseUrl, fetch, { projectId, authHeader: req.headers.authorization });

    // Optionally fold in remote MCP tools (Higgsfield & co.). Native tools always
    // win a name clash; MCP tools are dispatched to their owning server.
    const mcpConfig = parseMcpConfig(process.env.AGENT_RUNTIME_MCP_SERVERS);
    // Wire our own first-party MCP server (AEVION registry) when enabled by env
    // (AGENT_RUNTIME_MCP_DEMO=1, for the live dock) or opted-in per request
    // (includeDemoMcp:true, e.g. for a prod proof) — proves runtime→bridge→MCP.
    const demoOn = /^(1|true|yes)$/i.test(process.env.AGENT_RUNTIME_MCP_DEMO || "") || req.body?.includeDemoMcp === true;
    if (demoOn) {
      mcpConfig.push({
        name: "aevion",
        url: `${baseUrl}/api/mcp-demo`,
        ...(process.env.MCP_DEMO_TOKEN ? { token: process.env.MCP_DEMO_TOKEN } : {}),
      });
    }
    const bridge = mcpConfig.length ? await loadMcpBridge({ config: mcpConfig }) : null;
    const tools = bridge ? [...TOOL_SPECS, ...bridge.specs] : TOOL_SPECS;

    const execTool: ExecTool = bridge
      ? async (call: ToolCall) => (bridge.owns.has(call.name) ? bridge.exec(call) : devhubExec(call))
      : devhubExec;

    const result = await runAgentLoop({
      messages: [{ role: "user", text: message }],
      tools,
      callModel: makeAnthropicCallModel({ system: SYSTEM_PROMPT }),
      execTool,
      maxSteps,
    });
    res.json({
      ok: true,
      finalText: result.finalText,
      steps: result.steps,
      hitMaxSteps: result.hitMaxSteps,
      transcript: result.transcript,
      mcpServers: bridge ? bridge.servers : [],
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: (e as Error).message });
  }
});

/**
 * GET /mcp-selftest — proves the runtime→MCP-bridge→MCP-server→tool path end to
 * end against our own first-party MCP server, with NO env config and NO secrets.
 * It connects the bridge to /api/mcp-demo, lists its tools, and actually calls
 * one (list_modules), returning both. Curl-able on prod to verify the mechanism.
 */
agentRuntimeRouter.get("/mcp-selftest", async (_req, res) => {
  const port = process.env.PORT || "4001";
  const baseUrl = process.env.SELF_BASE_URL || `http://127.0.0.1:${port}`;
  try {
    const bridge = await loadMcpBridge({
      config: [
        {
          name: "aevion",
          url: `${baseUrl}/api/mcp-demo`,
          ...(process.env.MCP_DEMO_TOKEN ? { token: process.env.MCP_DEMO_TOKEN } : {}),
        },
      ],
    });
    const toolName = bridge.specs[0]?.name;
    const sample = toolName
      ? await bridge.exec({ id: "selftest", name: toolName, input: { status: "live" } })
      : null;
    res.json({
      ok: bridge.servers.every((s) => !s.error) && Boolean(sample?.ok),
      servers: bridge.servers,
      tools: bridge.specs.map((t) => t.name),
      sampleTool: toolName,
      sampleResult: sample,
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: (e as Error).message });
  }
});
