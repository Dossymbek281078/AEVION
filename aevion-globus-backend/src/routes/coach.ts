// AEVION CyberChess — AI Coach proxy route (v35)
//
// Receives { system, messages, maxTokens? } from frontend and proxies to Claude API.
// Hides API key from client.
//
// v35 changes:
// - Default model upgraded from Haiku 4.5 → Sonnet 4.6 for stronger chess reasoning.
//   Haiku plays chess at ~1200 ELO "guesses on the position", Sonnet at ~2000 ELO and
//   ACTUALLY understands engine eval lines when they're provided in the prompt.
// - maxTokens is now client-configurable (Live Coach needs 150, deep analysis up to 1500).
// - System prompt validation no longer truncates.

import { Router, type Request, type Response } from "express";

export const coachRouter = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Opus 4.7 — Anthropic's flagship, strongest chess reasoning ($15 in / $75 out per M tokens).
// Each Coach request ≈ $0.015-0.02, acceptable for premium experience. Override via env.
const DEFAULT_MODEL = process.env.COACH_MODEL || "claude-opus-4-7";

// Absolute ceiling on tokens per response — chess coaching fits comfortably in 1500.
// Client may request less (e.g. 150 for Live Coach one-liners).
const MAX_TOKENS_CEILING = 1500;
const DEFAULT_MAX_TOKENS = 800;

// Input size limits — chess context (FEN + engine PVs + move list) fits comfortably
// in a few KB per message. These limits prevent abuse / runaway costs.
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 16000;
const MAX_SYSTEM_CHARS = 8000;

coachRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Server misconfigured: ANTHROPIC_API_KEY not set",
      });
    }

    const { system, messages, maxTokens } = (req.body || {}) as {
      system?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      maxTokens?: number;
    };

    // ─── Input validation ────────────────────────────────────────────────
    if (!system || typeof system !== "string") {
      return res.status(400).json({ error: "Missing or invalid `system`" });
    }
    if (system.length > MAX_SYSTEM_CHARS) {
      return res.status(400).json({
        error: `System prompt too long (max ${MAX_SYSTEM_CHARS} chars)`,
      });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing or invalid `messages`" });
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({
        error: `Too many messages (max ${MAX_MESSAGES})`,
      });
    }
    for (const m of messages) {
      if (!m || typeof m !== "object") {
        return res.status(400).json({ error: "Malformed message" });
      }
      if (m.role !== "user" && m.role !== "assistant") {
        return res.status(400).json({ error: `Invalid role: ${m.role}` });
      }
      if (typeof m.content !== "string" || m.content.length === 0) {
        return res.status(400).json({ error: "Message content must be non-empty string" });
      }
      if (m.content.length > MAX_CONTENT_CHARS) {
        return res.status(400).json({
          error: `Message too long (max ${MAX_CONTENT_CHARS} chars)`,
        });
      }
    }
    if (messages[0].role !== "user") {
      return res.status(400).json({ error: "First message must have role=user" });
    }

    // Resolve max_tokens with sensible clamping.
    let resolvedMaxTokens = DEFAULT_MAX_TOKENS;
    if (typeof maxTokens === "number" && maxTokens > 0) {
      resolvedMaxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CEILING);
    }

    // ─── Forward to Anthropic ────────────────────────────────────────────
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: resolvedMaxTokens,
        system,
        messages,
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const errMsg =
        (data && (data.error?.message || data.message)) ||
        `Upstream error (HTTP ${upstream.status})`;
      console.error("[coach] Anthropic API error:", upstream.status, errMsg);
      return res.status(upstream.status).json({ error: errMsg });
    }

    return res.json(data);
  } catch (err: any) {
    console.error("[coach] Unexpected error:", err);
    return res.status(500).json({
      error: err?.message || "Internal server error",
    });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────
coachRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    model: DEFAULT_MODEL,
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    defaultMaxTokens: DEFAULT_MAX_TOKENS,
    maxTokensCeiling: MAX_TOKENS_CEILING,
  });
});
