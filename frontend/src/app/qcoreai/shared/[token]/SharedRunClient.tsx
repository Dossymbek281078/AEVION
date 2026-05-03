"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiUrl, getBackendOrigin } from "@/lib/apiBase";

/* ═══════════════════════════════════════════════════════════════════════
   Public read-only page for a shared QCoreAI run.

   No auth. No streaming. Just a rendered snapshot of the agent trace and
   final answer from a permalink. Ideal for investor demos and social posts.
   ═══════════════════════════════════════════════════════════════════════ */

type SharedMessage = {
  id: string;
  role: string;
  stage: string | null;
  instance: string | null;
  provider: string | null;
  model: string | null;
  content: string;
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number | null;
  costUsd: number | null;
  ordering: number;
  createdAt: string;
};

type SharedRun = {
  id: string;
  strategy: string | null;
  status: string;
  userInput: string;
  finalContent: string | null;
  totalDurationMs: number | null;
  totalCostUsd: number | null;
  startedAt: string;
  finishedAt: string | null;
  agentConfig: {
    strategy: string;
    maxRevisions: number | null;
    overrides: Record<string, { provider?: string; model?: string; temperature?: number }>;
  } | null;
};

type SharedPayload = {
  session: { id: string; title: string; mode: string } | null;
  run: SharedRun;
  messages: SharedMessage[];
};

const ROLE_COLOR: Record<string, { color: string; bg: string; tag: string; label: string }> = {
  analyst: { color: "#2563eb", bg: "rgba(37,99,235,0.08)", tag: "A", label: "Analyst" },
  writer: { color: "#059669", bg: "rgba(5,150,105,0.08)", tag: "W", label: "Writer" },
  writer_a: { color: "#059669", bg: "rgba(5,150,105,0.08)", tag: "W", label: "Writer A" },
  writer_b: { color: "#0891b2", bg: "rgba(8,145,178,0.08)", tag: "W²", label: "Writer B" },
  writer_pro: { color: "#16a34a", bg: "rgba(22,163,74,0.08)", tag: "✚", label: "Pro" },
  writer_con: { color: "#dc2626", bg: "rgba(220,38,38,0.08)", tag: "✕", label: "Con" },
  critic: { color: "#d97706", bg: "rgba(217,119,6,0.08)", tag: "C", label: "Critic" },
  critic_judge: { color: "#d97706", bg: "rgba(217,119,6,0.08)", tag: "J", label: "Judge" },
  critic_moderator: { color: "#7c3aed", bg: "rgba(124,58,237,0.08)", tag: "M", label: "Moderator" },
};

function styleFor(m: SharedMessage, strategy: string | null) {
  if (m.role === "writer" && m.instance === "pro") return ROLE_COLOR.writer_pro;
  if (m.role === "writer" && m.instance === "con") return ROLE_COLOR.writer_con;
  if (m.role === "writer" && m.instance === "a") return ROLE_COLOR.writer_a;
  if (m.role === "writer" && m.instance === "b") return ROLE_COLOR.writer_b;
  if (m.role === "critic" && m.stage === "judge") {
    return strategy === "debate" ? ROLE_COLOR.critic_moderator : ROLE_COLOR.critic_judge;
  }
  if (m.role === "analyst") return ROLE_COLOR.analyst;
  if (m.role === "writer") return ROLE_COLOR.writer;
  return ROLE_COLOR.critic;
}

const prettyModel = (m: string | null) => {
  if (!m) return "";
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash-001": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "deepseek-chat": "DeepSeek Chat",
    "deepseek-reasoner": "DeepSeek Reasoner",
    "grok-3": "Grok 3",
    "grok-3-mini": "Grok 3 Mini",
  };
  return map[m] || m;
};

function fmtDur(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  return `$${v.toFixed(4)}`;
}

type CommentItem = { id: string; authorName: string; content: string; createdAt: string };

export default function SharedRunClient() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "";
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentName, setCommentName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [costBreakdown, setCostBreakdown] = useState<Array<{
    role: string; stage: string | null; provider: string | null; model: string | null;
    tokensIn: number | null; tokensOut: number | null; costUsd: number | null; durationMs: number | null;
  }> | null>(null);
  const [showCost, setShowCost] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [runRes, cmRes] = await Promise.all([
          fetch(apiUrl(`/api/qcoreai/shared/${token}`)),
          fetch(apiUrl(`/api/qcoreai/shared/${token}/comments`)),
        ]);
        const data = await runRes.json();
        if (!runRes.ok) throw new Error(data?.error || `HTTP ${runRes.status}`);
        setPayload(data as SharedPayload);
        const cmData = await cmRes.json().catch(() => ({}));
        if (Array.isArray(cmData?.items)) setComments(cmData.items);
      } catch (e: any) {
        setError(e?.message || "Failed to load shared run");
      }
    })();
  }, [token]);

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || commentBusy) return;
    setCommentBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/shared/${token}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: commentName.trim() || "Anonymous", content: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setComments((prev) => [...prev, data.comment]);
      setCommentText("");
    } catch (e: any) {
      alert(e?.message || "Comment failed");
    } finally {
      setCommentBusy(false);
    }
  };

  if (error) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui, sans-serif", textAlign: "center", color: "#991b1b" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>This link is no longer available.</h1>
        <p style={{ color: "#64748b", marginTop: 8 }}>{error}</p>
        <Link href="/multichat-engine" style={{ color: "#0e7490", fontWeight: 700 }}>← Back to QCoreAI</Link>
      </main>
    );
  }

  if (!payload) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui, sans-serif", textAlign: "center", color: "#64748b" }}>
        Loading shared run…
      </main>
    );
  }

  const { session, run, messages } = payload;
  const agentMessages = messages.filter((m) => m.role === "analyst" || m.role === "writer" || m.role === "critic");
  const guidanceMessages = messages.filter((m) => m.role === "guidance");
  const attachmentsMsg = messages.find((m) => m.role === "attachments");
  const attachments: Array<{ id: string; title: string | null; kind: string | null }> = (() => {
    if (!attachmentsMsg?.content) return [];
    try {
      const parsed = JSON.parse(attachmentsMsg.content);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((a: any) => a && typeof a.id === "string");
    } catch {
      return [];
    }
  })();
  const totalTok = messages.reduce((s, m) => s + (m.tokensIn ?? 0) + (m.tokensOut ?? 0), 0);

  // Build a lookup of guidance items keyed by the index they should appear
  // before in the agent-message trace. Walk messages in order.
  const guidanceByIndex = new Map<number, typeof guidanceMessages>();
  {
    let agentIdx = 0;
    for (const m of messages) {
      if (m.role === "analyst" || m.role === "writer" || m.role === "critic") {
        agentIdx++;
      } else if (m.role === "guidance") {
        const list = guidanceByIndex.get(agentIdx) || [];
        list.push(m);
        guidanceByIndex.set(agentIdx, list);
      }
    }
  }

  return (
    <main style={{ background: "#f1f5f9", minHeight: "100vh", padding: "24px 16px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Hero */}
        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #3730a3 100%)",
            color: "#fff",
            padding: "28px 28px 22px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13,
              }}
            >
              MA
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                QCoreAI · Multi-Agent · Public snapshot
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: "2px 0 0", letterSpacing: "-0.02em" }}>
                {session?.title || "Shared QCoreAI run"}
              </h1>
            </div>
            <Link
              href="/multichat-engine"
              style={{
                padding: "6px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)",
                fontSize: 12, fontWeight: 700, color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              Try it yourself →
            </Link>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
            <Chip label="Strategy" value={run.strategy || run.agentConfig?.strategy || "sequential"} />
            <Chip label="Status" value={run.status} highlight={run.status === "done" ? "#10b981" : run.status === "stopped" ? "#f59e0b" : "#f43f5e"} />
            <Chip label="Duration" value={fmtDur(run.totalDurationMs)} />
            <Chip label="Tokens" value={totalTok.toLocaleString()} />
            <Chip label="Cost" value={fmtMoney(run.totalCostUsd)} />
          </div>
        </div>

        {/* User question */}
        <section style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: "14px 16px", borderRadius: 12,
              background: "#fff", border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
              User asked
            </div>
            <div style={{ fontSize: 15, color: "#0f172a", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {run.userInput}
            </div>
          </div>
        </section>

        {/* Attached QRight objects */}
        {attachments.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
              Attached QRight objects
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {attachments.map((a) => (
                <span
                  key={a.id}
                  title={a.title || a.id}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(13,148,136,0.1)",
                    border: "1px solid rgba(13,148,136,0.3)",
                    color: "#0f766e",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  📎 {a.title || a.id.slice(0, 8)}
                  {a.kind && <span style={{ fontSize: 10, opacity: 0.7 }}>· {a.kind}</span>}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Agent trace (with guidance chips interleaved) */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Agent trace
          </div>
          {/* Guidance items at index 0 (before any agent message) */}
          {(guidanceByIndex.get(0) || []).map((g) => (
            <SharedGuidanceChip key={`g0-${g.id}`} text={g.content} stage={g.stage} />
          ))}
          {agentMessages.map((m, idx) => {
            const s = styleFor(m, run.strategy);
            // Render guidance chips placed BEFORE this agent message (index idx+1).
            const guidanceBefore = guidanceByIndex.get(idx + 1) || [];
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {guidanceBefore.length > 0 && guidanceBefore.map((g) => (
                  <SharedGuidanceChip key={`g${idx}-${g.id}`} text={g.content} stage={g.stage} />
                ))}
              <div
                style={{
                  padding: "12px 14px", borderRadius: 12,
                  background: "#fff", border: `1px solid ${s.color}33`,
                  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: s.color, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 900,
                    }}
                  >
                    {s.tag}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 12, color: s.color }}>{s.label}</span>
                  {m.model && <span style={{ fontSize: 11, color: "#94a3b8" }}>{prettyModel(m.model)}</span>}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                    {m.durationMs != null && <span>{fmtDur(m.durationMs)}</span>}
                    {(m.tokensIn != null || m.tokensOut != null) && (
                      <span>{(m.tokensIn ?? 0)}→{(m.tokensOut ?? 0)} tok</span>
                    )}
                    {m.costUsd != null && m.costUsd > 0 && (
                      <span style={{ color: "#0f172a", fontWeight: 700 }}>{fmtMoney(m.costUsd)}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: "#0f172a" }}>
                  <MiniMarkdown source={m.content} />
                </div>
              </div>
              </div>
            );
          })}
        </section>

        {/* Final answer */}
        {run.finalContent && (
          <section style={{ marginBottom: 20 }}>
            <div
              style={{
                padding: "18px 20px", borderRadius: 14,
                background: "#fff", border: `2px solid ${run.status === "stopped" ? "#f59e0b" : "#7c3aed"}`,
                boxShadow: `0 6px 20px ${run.status === "stopped" ? "rgba(245,158,11,0.08)" : "rgba(124,58,237,0.1)"}`,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: run.status === "stopped" ? "#92400e" : "#6d28d9", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                {run.status === "stopped" ? "Partial answer (stopped)" : "Final answer"}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "#0f172a" }}>
                <MiniMarkdown source={run.finalContent} />
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: "#64748b", paddingTop: 8, borderTop: "1px solid #e2e8f0", marginTop: 10 }}>
          <span>Exported from <b style={{ color: "#0f172a" }}>AEVION QCoreAI</b></span>
          <span>·</span>
          <span>Run started {new Date(run.startedAt).toLocaleString()}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={async () => {
                if (!showCost && !costBreakdown) {
                  const r = await fetch(apiUrl(`/api/qcoreai/runs/${run.id}/cost-breakdown`));
                  const d = await r.json().catch(() => ({}));
                  if (Array.isArray(d?.breakdown)) setCostBreakdown(d.breakdown);
                }
                setShowCost((v) => !v);
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6d28d9", fontWeight: 700, fontSize: 11 }}
            >
              {showCost ? "Hide" : "💲 Cost breakdown"}
            </button>
            <a
              href={`${getBackendOrigin()}/api/qcoreai/runs/${run.id}/export?format=md`}
              target="_blank" rel="noreferrer"
              style={{ color: "#0e7490", fontWeight: 700, textDecoration: "none" }}
            >
              ⬇ Download Markdown
            </a>
          </span>
        </footer>
        {showCost && costBreakdown && (
          <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(124,58,237,0.12)", fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Per-agent cost</div>
            {costBreakdown.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: "#6d28d9", minWidth: 60 }}>{b.role}</span>
                <span style={{ color: "#64748b" }}>{b.provider || ""} {b.model ? `· ${b.model.split("-").slice(0, 2).join("-")}` : ""}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700, color: "#0f172a" }}>
                  {b.costUsd != null ? `$${b.costUsd.toFixed(5)}` : "—"}
                </span>
                <span style={{ color: "#94a3b8" }}>
                  {((b.tokensIn ?? 0) + (b.tokensOut ?? 0)).toLocaleString()} tok
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Comments */}
        <section style={{ marginTop: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
            Comments ({comments.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {comments.length === 0 && (
              <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>No comments yet. Be the first.</div>
            )}
            {comments.map((c) => (
              <div key={c.id} style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{c.authorName}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.content}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
            <input
              value={commentName}
              onChange={(e) => setCommentName(e.target.value)}
              placeholder="Your name (optional)"
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave a comment…"
              rows={3}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, resize: "vertical" }}
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || commentBusy}
              style={{
                alignSelf: "flex-end", padding: "7px 18px", borderRadius: 8,
                background: commentText.trim() ? "#0e7490" : "#cbd5e1",
                border: "none", color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: commentText.trim() ? "pointer" : "default",
              }}
            >
              {commentBusy ? "Posting…" : "Post comment"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function SharedGuidanceChip({ text, stage }: { text: string; stage: string | null }) {
  return (
    <div
      style={{
        padding: "10px 14px", borderRadius: 10,
        background: "rgba(196,181,253,0.18)",
        border: "1px solid rgba(124,58,237,0.35)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
      title={`Mid-run human guidance${stage ? ` (before ${stage} stage)` : ""}`}
    >
      <span
        style={{
          width: 22, height: 22, borderRadius: 6,
          background: "#7c3aed", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, flexShrink: 0,
        }}
        aria-hidden
      >
        ↪
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#6d28d9", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>
          Mid-run guidance{stage ? ` · before ${stage}` : ""}
        </div>
        <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {text}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, highlight }: { label: string; value: string | number; highlight?: string }) {
  return (
    <div
      style={{
        padding: "6px 10px", borderRadius: 10,
        background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
        display: "flex", alignItems: "center", gap: 6,
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}:</span>
      <span style={{ fontWeight: 700, color: highlight || "#fff" }}>{value}</span>
    </div>
  );
}

/* Super-minimal markdown renderer for shared page (mirrors /multi/page.tsx minus tables). */
function MiniMarkdown({ source }: { source: string }) {
  if (!source) return null;
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let orderedList = false;
  let codeBuffer: string[] | null = null;

  const flushList = () => {
    if (!listBuffer.length) return;
    const items = listBuffer;
    const k = `l-${blocks.length}`;
    const style = { margin: "4px 0 6px 20px", padding: 0, fontSize: "inherit" } as const;
    blocks.push(
      orderedList ? (
        <ol key={k} style={style}>
          {items.map((it, i) => <li key={i} style={{ margin: "2px 0" }}><Inline text={it} /></li>)}
        </ol>
      ) : (
        <ul key={k} style={style}>
          {items.map((it, i) => <li key={i} style={{ margin: "2px 0" }}><Inline text={it} /></li>)}
        </ul>
      )
    );
    listBuffer = [];
    orderedList = false;
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (/^```/.test(line)) {
      if (codeBuffer) {
        blocks.push(
          <pre key={`c-${blocks.length}`} style={{ background: "#f1f5f9", padding: "8px 10px", borderRadius: 6, margin: "6px 0", fontSize: 12, overflowX: "auto" }}>
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = null;
      } else {
        flushList();
        codeBuffer = [];
      }
      continue;
    }
    if (codeBuffer) { codeBuffer.push(line); continue; }
    if (/^\s*$/.test(line)) { flushList(); continue; }
    const h = /^(#{1,4})\s+(.+)$/.exec(line);
    if (h) {
      flushList();
      const lvl = h[1].length;
      const sizes = [17, 15, 14, 13];
      blocks.push(
        <div key={`h-${blocks.length}`} style={{ fontSize: sizes[lvl - 1], fontWeight: 800, margin: "8px 0 4px", color: "#0f172a" }}>
          <Inline text={h[2]} />
        </div>
      );
      continue;
    }
    const b = /^\s*[-*•]\s+(.+)$/.exec(line);
    if (b) {
      if (orderedList) flushList();
      listBuffer.push(b[1]);
      continue;
    }
    const o = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (o) {
      if (!orderedList && listBuffer.length) flushList();
      orderedList = true;
      listBuffer.push(o[1]);
      continue;
    }
    flushList();
    blocks.push(<p key={`p-${blocks.length}`} style={{ margin: "4px 0" }}><Inline text={line} /></p>);
  }
  flushList();
  return <>{blocks}</>;
}

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0; let k = 0;
  const re = /(\*\*([^*\n]+)\*\*)|(\*([^*\n]+)\*)|(`([^`\n]+)`)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[4] !== undefined) parts.push(<em key={k++}>{m[4]}</em>);
    else if (m[6] !== undefined) parts.push(<code key={k++} style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, fontSize: "0.92em" }}>{m[6]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
