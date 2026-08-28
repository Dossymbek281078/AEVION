"use client";

/**
 * AgentDock — a global floating "AI Agent" widget mounted on every product /
 * module page (see ClientProviders). It talks to our OWN agent runtime
 * (POST /api/agent-runtime/run): a real Anthropic tool-use loop that can create
 * images, voice/music, payment links, send email/SMS, translate, and call any
 * connected remote-MCP tool — without leaving the current page.
 *
 * Self-contained and additive: it holds its own state, uses the prod-safe
 * apiUrl() helper only inside the click handler (never in render → no hydration
 * mismatch), and renders nothing on the server beyond an inert launcher button.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";
import {
  buildRunRequest,
  canSend,
  describeToolActivity,
  extractDevHubProjectId,
  summarizeRun,
  summarizeHealth,
  prettyToolName,
  AGENT_EVENT_NAME,
  type AgentEventDetail,
  type DockRunResponse,
  type DockHealth,
  type DockToolSummary,
  type ToolActivity,
} from "./agentDock.lib";

interface ChatEntry {
  role: "user" | "agent";
  text: string;
  activity?: ToolActivity[];
  error?: boolean;
}

const DARK = "#0f172a";
const PANEL_BG = "linear-gradient(160deg, #0f172a 0%, #131f38 100%)";

function ToolChips({ title, names, tone }: { title: string; names: string[]; tone: "native" | "mcp" }) {
  if (names.length === 0) return null;
  const color = tone === "mcp" ? "#bbf7d0" : "#c7d2fe";
  const border = tone === "mcp" ? "#166534" : "#3a4a6b";
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 9, color: "#64748b", fontWeight: 800, letterSpacing: 0.4, marginBottom: 4 }}>{title.toUpperCase()}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {names.map((n) => (
          <span
            key={n}
            title={n}
            style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color, background: "rgba(255,255,255,0.04)", border: `1px solid ${border}` }}
          >
            {prettyToolName(n)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgentDock() {
  const pathname = usePathname();
  const projectId = extractDevHubProjectId(pathname || "");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<ChatEntry[]>([]);
  const [health, setHealth] = useState<DockToolSummary | null>(null);
  const [showTools, setShowTools] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const send = async (explicit?: string) => {
    const message = explicit ?? input;
    if (!canSend(message) || busy) return;
    setInput("");
    setLog((l) => [...l, { role: "user", text: message.trim() }]);
    setBusy(true);
    scrollToEnd();
    try {
      const r = await fetch(apiUrl("/api/agent-runtime/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRunRequest(message, undefined, projectId)),
      });
      const data = (await r.json().catch(() => ({}))) as DockRunResponse;
      if (!r.ok || data.ok === false) {
        setLog((l) => [...l, { role: "agent", text: summarizeRun(data) || `Error ${r.status}`, error: true }]);
      } else {
        setLog((l) => [
          ...l,
          {
            role: "agent",
            text: data.finalText || summarizeRun(data),
            activity: describeToolActivity(data.transcript),
          },
        ]);
      }
    } catch (e) {
      setLog((l) => [...l, { role: "agent", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  };

  // Keep a live ref to send so the (empty-deps) global listener never fires a
  // stale closure over busy/input.
  const sendRef = useRef(send);
  sendRef.current = send;

  // Any page can dispatch AGENT_EVENT_NAME to open + prefill (± auto-send) the
  // dock — e.g. the per-module prompt chips on /[id].
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AgentEventDetail>).detail;
      if (!detail || typeof detail.prompt !== "string") return;
      setOpen(true);
      setInput(detail.prompt);
      if (detail.autoSend) void sendRef.current(detail.prompt);
    };
    window.addEventListener(AGENT_EVENT_NAME, handler as EventListener);
    return () => window.removeEventListener(AGENT_EVENT_NAME, handler as EventListener);
  }, []);

  // Fetch the runtime's capabilities the first time the dock is opened, so the
  // user can see exactly what the agent can do (native + connected MCP tools).
  useEffect(() => {
    if (!open || health) return;
    let alive = true;
    fetch(apiUrl("/api/agent-runtime/health"))
      .then((r) => (r.ok ? (r.json() as Promise<DockHealth>) : null))
      .then((h) => {
        if (alive && h) setHealth(summarizeHealth(h));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, health]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // ── Launcher button (collapsed) ────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Открыть ИИ-помощника AEVION"
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 9998,
          padding: "10px 16px",
          borderRadius: 999,
          border: "1px solid #334155",
          background: "linear-gradient(135deg, #6366f1, #06b6d4)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.3,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(15,23,42,0.5)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span> AI Agent
      </button>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-label="ИИ-помощник AEVION"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9998,
        width: "min(380px, calc(100vw - 32px))",
        height: "min(560px, calc(100vh - 32px))",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        overflow: "hidden",
        background: PANEL_BG,
        border: "1px solid #334155",
        boxShadow: "0 16px 48px rgba(15,23,42,0.6)",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid #24314d",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>AEVION Agent</div>
          <div style={{ fontSize: 10, color: "#8aa0c6" }}>
            {projectId ? "code · image · voice · music · pay · email · SMS · translate" : "image · voice · music · pay · email · SMS · translate"}
          </div>
        </div>
        {health && (
          <button
            onClick={() => setShowTools((v) => !v)}
            aria-label="Показать доступные инструменты"
            title="Доступные инструменты"
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              border: "1px solid #3a4a6b",
              background: showTools ? "rgba(99,102,241,0.25)" : "transparent",
              color: "#c7d2fe",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🧰 {health.total}{health.mcp.length ? ` · ${health.mcp.length} MCP` : ""}
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          aria-label="Свернуть помощника"
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #3a4a6b",
            background: "transparent",
            color: "#93a6c9",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ▾
        </button>
      </div>

      {/* available-tools panel */}
      {showTools && health && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #24314d", background: "rgba(99,102,241,0.06)", maxHeight: 180, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#8aa0c6", marginBottom: 6 }}>
            {health.model ? `Model ${health.model}` : "Agent"} · {health.keyConfigured ? "connected" : "no key"} · {health.total} tools
          </div>
          <ToolChips title="Native" names={health.native} tone="native" />
          {health.mcp.length > 0 ? (
            <ToolChips title="MCP" names={health.mcp} tone="mcp" />
          ) : (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
              No MCP tools connected. Enable the AEVION registry MCP with AGENT_RUNTIME_MCP_DEMO=1.
            </div>
          )}
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {log.length === 0 && (
          <div style={{ color: "#7c90b5", fontSize: 12, lineHeight: 1.5 }}>
            {projectId
              ? <>Ask for anything and I&apos;ll use the right tool — e.g. “add a login page to this project”, “make a 10-second lofi music clip”, or “create a $25 payment link for a consult”.</>
              : <>Ask for anything and I&apos;ll use the right tool — e.g. “make a 10-second lofi music clip”, “translate this to Kazakh”, or “create a $25 payment link for a consult”.</>}
          </div>
        )}
        {log.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              padding: "8px 11px",
              borderRadius: 10,
              fontSize: 12.5,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: m.error ? "#fecaca" : "#e6edf8",
              background:
                m.role === "user"
                  ? "linear-gradient(135deg, #4f46e5, #0891b2)"
                  : m.error
                    ? "rgba(127,29,29,0.35)"
                    : "rgba(255,255,255,0.05)",
              border: m.role === "user" ? "none" : "1px solid #26334f",
            }}
          >
            {m.text}
            {m.activity && m.activity.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
                {m.activity.map((a, j) => (
                  <span
                    key={j}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 999,
                      color: a.ok ? "#bbf7d0" : "#fecaca",
                      background: a.ok ? "rgba(22,101,52,0.35)" : "rgba(127,29,29,0.35)",
                      border: `1px solid ${a.ok ? "#166534" : "#7f1d1d"}`,
                    }}
                  >
                    {a.ok ? "✓" : "✕"} {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ color: "#8aa0c6", fontSize: 12 }}>Working…</div>}
      </div>

      {/* input */}
      <div style={{ padding: 10, borderTop: "1px solid #24314d", background: DARK }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Ask the agent to do something…"
            aria-label="Сообщение ИИ-помощнику"
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#0b1424",
              color: "#e6edf8",
              fontSize: 12.5,
              padding: "8px 10px",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => void send()}
            disabled={busy || !canSend(input)}
            aria-label="Send"
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background: busy || !canSend(input) ? "#334155" : "linear-gradient(135deg, #6366f1, #06b6d4)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: busy || !canSend(input) ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
