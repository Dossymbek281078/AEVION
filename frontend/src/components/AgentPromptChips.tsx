"use client";

/**
 * AgentPromptChips — a row of one-click prompts that seed the global AgentDock.
 *
 * Clicking a chip dispatches AGENT_EVENT_NAME; the dock opens and prefills the
 * prompt. autoSend defaults to FALSE so the user reviews before running — some
 * prompts trigger real side-effecting tools (payments, email), so we never fire
 * them on a single chip click.
 */

import { AGENT_EVENT_NAME, type AgentEventDetail } from "./agentDock.lib";

export function AgentPromptChips({
  prompts,
  label = "Try it with the AI Agent",
  autoSend = false,
}: {
  prompts: string[];
  label?: string;
  autoSend?: boolean;
}) {
  if (!prompts || prompts.length === 0) return null;

  const fire = (prompt: string) => {
    const detail: AgentEventDetail = { prompt, autoSend };
    window.dispatchEvent(new CustomEvent(AGENT_EVENT_NAME, { detail }));
  };

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        border: "1px solid rgba(99,102,241,0.25)",
        background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(6,182,212,0.05))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#4338ca" }}>{label}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => fire(p)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(99,102,241,0.35)",
              background: "#fff",
              color: "#3730a3",
              fontSize: 12.5,
              fontWeight: 650,
              cursor: "pointer",
              textAlign: "left",
              lineHeight: 1.35,
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
