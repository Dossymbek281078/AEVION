/**
 * agentRuntime route — POST /api/agent-runtime/run.
 *
 * Our own agent runtime: a real provider tool-use loop (Anthropic function-
 * calling) that can carry out actions through existing DevHub endpoints. Kept
 * separate from qcoreai so the other work stream stays untouched.
 */

import { Router } from "express";
import { runAgentLoop } from "../services/agentRuntime/loop";
import { TOOL_SPECS, makeExecutor } from "../services/agentRuntime/tools";
import { makeAnthropicCallModel } from "../services/agentRuntime/anthropicClient";

export const agentRuntimeRouter = Router();

const SYSTEM_PROMPT =
  "You are AEVION Agent. Answer briefly. When the user asks for an artifact — an image, a voice clip, " +
  "a payment link, or an email — call the matching tool instead of describing it. Prefer one tool call " +
  "at a time, then summarise the result for the user.";

agentRuntimeRouter.get("/health", (_req, res) => {
  res.json({
    service: "agent-runtime",
    ok: true,
    keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.AGENT_RUNTIME_MODEL || "claude-sonnet-5",
    tools: TOOL_SPECS.map((t) => t.name),
  });
});

agentRuntimeRouter.post("/run", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "message required" });

  const port = process.env.PORT || "4001";
  const baseUrl = process.env.SELF_BASE_URL || `http://127.0.0.1:${port}`;
  const maxSteps = Math.min(8, Math.max(1, Number(req.body?.maxSteps) || 5));

  try {
    const result = await runAgentLoop({
      messages: [{ role: "user", text: message }],
      tools: TOOL_SPECS,
      callModel: makeAnthropicCallModel({ system: SYSTEM_PROMPT }),
      execTool: makeExecutor(baseUrl),
      maxSteps,
    });
    res.json({
      ok: true,
      finalText: result.finalText,
      steps: result.steps,
      hitMaxSteps: result.hitMaxSteps,
      transcript: result.transcript,
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: (e as Error).message });
  }
});
