/**
 * Pure helpers for the global AgentDock widget.
 *
 * Kept separate from the React component so the request/response shaping is unit
 * tested without a DOM. The dock talks to POST /api/agent-runtime/run — our own
 * agent runtime (real Anthropic tool-use over DevHub + remote MCP tools).
 */

/**
 * Global signal that any page can dispatch to drive the AgentDock: open it and
 * prefill (and optionally auto-send) a prompt. Kept as a window CustomEvent so
 * unrelated pages need no shared store or import of the dock component.
 */
export const AGENT_EVENT_NAME = "aevion:agent" as const;

export interface AgentEventDetail {
  prompt: string;
  /** When true, send immediately; default false = prefill so the user reviews. */
  autoSend?: boolean;
}

/** Build the CustomEvent that opens/prefills the dock (kept pure for testing). */
export function buildAgentEvent(prompt: string, autoSend = false): { name: string; detail: AgentEventDetail } {
  return { name: AGENT_EVENT_NAME, detail: { prompt: prompt.trim(), autoSend } };
}

/** One turn of the runtime transcript (mirror of the backend LoopMessage). */
export interface DockTranscriptMsg {
  role: "user" | "assistant" | "tool";
  text?: string;
  toolCalls?: Array<{ id: string; name: string }>;
  toolResults?: Array<{ callId: string; name: string; ok: boolean }>;
}

export interface DockRunResponse {
  ok?: boolean;
  finalText?: string;
  steps?: number;
  hitMaxSteps?: boolean;
  transcript?: DockTranscriptMsg[];
  error?: string;
}

/** One line in the "what the agent did" activity list. */
export interface ToolActivity {
  name: string;
  ok: boolean;
}

/** Clamp the tool-step budget to the backend's accepted 1..8 range (default 5). */
export function clampMaxSteps(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 5;
  return Math.min(8, Math.max(1, v));
}

/** Build the /run request body from a raw user message. */
export function buildRunRequest(message: string, maxSteps?: number): { message: string; maxSteps: number } {
  return { message: message.trim(), maxSteps: clampMaxSteps(maxSteps ?? 5) };
}

/** Whether a message is worth sending (non-empty after trim). */
export function canSend(message: string): boolean {
  return message.trim().length > 0;
}

/**
 * Reduce a run transcript to the ordered list of tool calls and whether each
 * succeeded — pairing every tool_use with its matching result by call id.
 */
export function describeToolActivity(transcript?: DockTranscriptMsg[]): ToolActivity[] {
  if (!Array.isArray(transcript)) return [];
  const okById = new Map<string, boolean>();
  for (const m of transcript) {
    if (m.role === "tool") for (const r of m.toolResults ?? []) okById.set(r.callId, r.ok);
  }
  const out: ToolActivity[] = [];
  for (const m of transcript) {
    if (m.role === "assistant") {
      for (const c of m.toolCalls ?? []) out.push({ name: c.name, ok: okById.get(c.id) ?? false });
    }
  }
  return out;
}

/** Shape of GET /api/agent-runtime/health (the bits the dock cares about). */
export interface DockHealth {
  keyConfigured?: boolean;
  model?: string;
  tools?: string[];
  nativeTools?: string[];
  mcpServers?: Array<{ name: string; toolCount: number; error?: string }>;
}

export interface DockToolSummary {
  native: string[];
  mcp: string[];
  total: number;
  model: string;
  keyConfigured: boolean;
}

/** Normalise a /health response into native vs MCP tool lists for display. */
export function summarizeHealth(h: DockHealth | null | undefined): DockToolSummary {
  const native = Array.isArray(h?.nativeTools) ? h!.nativeTools! : [];
  const all = Array.isArray(h?.tools) ? h!.tools! : native;
  const mcp = all.filter((t) => !native.includes(t));
  return {
    native,
    mcp,
    total: native.length + mcp.length,
    model: h?.model || "",
    keyConfigured: Boolean(h?.keyConfigured),
  };
}

/** Pretty label for a tool name (drops the mcp_<server>_ prefix for MCP tools). */
export function prettyToolName(name: string): string {
  const m = /^mcp_[^_]+_(.+)$/.exec(name);
  return (m ? m[1] : name).replace(/_/g, " ");
}

/** Human-friendly summary text for a completed run (for the header/status line). */
export function summarizeRun(res: DockRunResponse): string {
  if (res.ok === false || res.error) return res.error || "The agent hit an error.";
  const acts = describeToolActivity(res.transcript);
  if (acts.length === 0) return "Answered directly.";
  const used = acts.map((a) => a.name).join(", ");
  const failed = acts.filter((a) => !a.ok).length;
  return failed ? `Used ${used} (${failed} failed).` : `Used ${used}.`;
}
