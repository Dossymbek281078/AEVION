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
  "clip, a sound effect, a payment link, an email, an SMS, a translation, or anything a connected tool can " +
  "do — call the matching tool instead of describing it. Prefer one tool call at a time, then summarise " +
  "the result for the user.";

agentRuntimeRouter.get("/health", async (_req, res) => {
  const mcpConfigured = parseMcpConfig(process.env.AGENT_RUNTIME_MCP_SERVERS);
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

  try {
    const devhubExec = makeExecutor(baseUrl);

    // Optionally fold in remote MCP tools (Higgsfield & co.). Native tools always
    // win a name clash; MCP tools are dispatched to their owning server.
    const mcpConfig = parseMcpConfig(process.env.AGENT_RUNTIME_MCP_SERVERS);
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
