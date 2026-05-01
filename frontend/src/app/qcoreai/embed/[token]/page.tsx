"use client";

/* ═══════════════════════════════════════════════════════════════════════
   QCoreAI embed widget
   Renders a public, read-only run snapshot suitable for embedding in any
   third-party landing page, documentation site, or customer portal.

   URL: /qcoreai/embed/[token]?theme=light|dark&compact=1&trace=0|1
   - theme   light (default) | dark
   - compact 1 = hide trace details, only show final answer + cost footer
   - trace   1 (default) | 0 — show/hide the agent trace

   postMessage API (sent to window.parent):
   - { type: "qcore-embed-ready", session, run }   — once data is loaded
   - { type: "qcore-embed-error", message }        — on fetch failure
   - { type: "qcore-embed-resize", height }        — every height change

   See `next.config.ts` /qcoreai/embed/:path* headers section — COOP/COEP
   neutralized + X-Frame-Options ALLOWALL + frame-ancestors *.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

type Msg = {
  id: string;
  role: string;
  stage: string | null;
  instance: string | null;
  provider: string | null;
  model: string | null;
  content: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  ordering: number;
};

type Payload = {
  session: { id: string; title: string; mode: string } | null;
  run: {
    id: string;
    strategy: string | null;
    status: string;
    userInput: string;
    finalContent: string | null;
    totalDurationMs: number | null;
    totalCostUsd: number | null;
    startedAt: string;
    finishedAt: string | null;
  };
  messages: Msg[];
};

const ROLE_LABEL: Record<string, string> = {
  analyst: "Analyst",
  writer: "Writer",
  critic: "Critic",
  final: "Final",
};

const ROLE_COLOR: Record<string, string> = {
  analyst: "#2563eb",
  writer: "#059669",
  critic: "#d97706",
  final: "#7c3aed",
};

function fmtMoney(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  return `$${v.toFixed(4)}`;
}

function fmtDur(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function prettyStrategy(s: string | null) {
  if (s === "parallel") return "Parallel";
  if (s === "debate") return "Debate";
  return "Sequential";
}

/** Tiny safe markdown — headings/lists/code/strong/em. No DOM injection. */
function MiniMd({ content }: { content: string }) {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let codeBlock: string[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.startsWith("```")) {
      if (codeBlock) {
        out.push(
          <pre key={`c-${i}`} style={{ background: "rgba(15,23,42,0.06)", padding: "8px 10px", borderRadius: 6, fontSize: 12, overflowX: "auto", margin: "6px 0" }}>
            {codeBlock.join("\n")}
          </pre>
        );
        codeBlock = null;
      } else {
        codeBlock = [];
      }
      continue;
    }
    if (codeBlock) {
      codeBlock.push(ln);
      continue;
    }
    if (/^### /.test(ln)) out.push(<h4 key={i} style={{ margin: "8px 0 4px", fontSize: 13, fontWeight: 800 }}>{ln.slice(4)}</h4>);
    else if (/^## /.test(ln)) out.push(<h3 key={i} style={{ margin: "10px 0 4px", fontSize: 14, fontWeight: 800 }}>{ln.slice(3)}</h3>);
    else if (/^# /.test(ln)) out.push(<h2 key={i} style={{ margin: "12px 0 6px", fontSize: 16, fontWeight: 900 }}>{ln.slice(2)}</h2>);
    else if (/^[\*\-] /.test(ln)) out.push(<div key={i} style={{ paddingLeft: 12, fontSize: 13, lineHeight: 1.55 }}>• {ln.slice(2)}</div>);
    else if (/^\d+\. /.test(ln)) out.push(<div key={i} style={{ paddingLeft: 12, fontSize: 13, lineHeight: 1.55 }}>{ln}</div>);
    else if (ln.trim() === "") out.push(<div key={i} style={{ height: 6 }} />);
    else out.push(<p key={i} style={{ margin: "3px 0", fontSize: 13, lineHeight: 1.55 }}>{ln}</p>);
  }
  return <>{out}</>;
}

export default function EmbedRunPage() {
  const { token } = useParams<{ token: string }>();
  const sp = useSearchParams();
  const theme = sp.get("theme") === "dark" ? "dark" : "light";
  const compact = sp.get("compact") === "1";
  const showTrace = sp.get("trace") !== "0" && !compact;

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/qcoreai/shared/${encodeURIComponent(String(token))}`), {
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
        if (!cancelled) {
          setData(payload as Payload);
          try {
            window.parent?.postMessage(
              { type: "qcore-embed-ready", session: payload.session, run: payload.run },
              "*"
            );
          } catch { /* parent gone */ }
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message || "load failed";
        setError(msg);
        try {
          window.parent?.postMessage({ type: "qcore-embed-error", message: msg }, "*");
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Re-post height on every render so the host can auto-grow the iframe.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const post = () => {
      try {
        window.parent?.postMessage(
          { type: "qcore-embed-resize", height: Math.ceil(el.getBoundingClientRect().height) },
          "*"
        );
      } catch { /* parent gone */ }
    };
    post();
    const ro = new ResizeObserver(() => post());
    ro.observe(el);
    return () => ro.disconnect();
  }, [data, showTrace, compact]);

  const colors = useMemo(() => {
    if (theme === "dark") {
      return {
        bg: "#0b1220",
        card: "#11192c",
        border: "rgba(255,255,255,0.08)",
        text: "#e2e8f0",
        muted: "#94a3b8",
        accent: "#0d9488",
      };
    }
    return {
      bg: "#fff",
      card: "#fff",
      border: "rgba(15,23,42,0.1)",
      text: "#0f172a",
      muted: "#64748b",
      accent: "#0d9488",
    };
  }, [theme]);

  if (error) {
    return (
      <div ref={rootRef} style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: colors.text, background: colors.bg }}>
        <div style={{ fontSize: 13, color: "#dc2626" }}>QCoreAI embed: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div ref={rootRef} style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: colors.muted, background: colors.bg }}>
        <div style={{ fontSize: 12 }}>Loading run…</div>
      </div>
    );
  }

  const final = data.run.finalContent || "";
  const traceMsgs = data.messages
    .filter((m) => m.role !== "final" && m.role !== "system")
    .sort((a, b) => a.ordering - b.ordering);

  return (
    <div
      ref={rootRef}
      style={{
        padding: 14,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        background: colors.bg,
        color: colors.text,
        minHeight: "100%",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #0d9488 0%, #6d28d9 100%)",
            color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 12,
          }}
        >
          QC
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.session?.title || "Multi-agent run"}
          </div>
          <div style={{ fontSize: 11, color: colors.muted }}>
            {prettyStrategy(data.run.strategy)} · {fmtDur(data.run.totalDurationMs)} · {fmtMoney(data.run.totalCostUsd)}
          </div>
        </div>
        <a
          href={`/qcoreai/shared/${encodeURIComponent(String(token))}`}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 11, fontWeight: 700,
            color: colors.accent,
            textDecoration: "none",
            padding: "4px 8px",
            borderRadius: 6,
            border: `1px solid ${colors.accent}55`,
          }}
          title="Open full run on AEVION"
        >
          ↗ Full run
        </a>
      </div>

      {/* Prompt */}
      <div
        style={{
          background: colors.card,
          border: `1px dashed ${colors.border}`,
          borderRadius: 10,
          padding: "8px 12px",
          marginBottom: 10,
          fontSize: 12,
          color: colors.muted,
        }}
      >
        <strong style={{ color: colors.text }}>Prompt:</strong> {data.run.userInput}
      </div>

      {/* Trace (optional) */}
      {showTrace && traceMsgs.length > 0 && (
        <details
          style={{
            marginBottom: 10,
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 700,
              color: colors.muted,
              userSelect: "none",
            }}
          >
            ▸ Show trace ({traceMsgs.length} agent {traceMsgs.length === 1 ? "step" : "steps"})
          </summary>
          <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            {traceMsgs.map((m) => {
              const c = ROLE_COLOR[m.role] || colors.muted;
              return (
                <div key={m.id} style={{ borderLeft: `3px solid ${c}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: c, textTransform: "uppercase" }}>
                    {ROLE_LABEL[m.role] || m.role}{m.instance ? ` · ${m.instance}` : ""}{m.stage ? ` · ${m.stage}` : ""} · {m.model || m.provider || ""}
                  </div>
                  <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 2 }}>
                    {m.content.length > 600 ? m.content.slice(0, 600) + "…" : m.content}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Final answer */}
      {final ? (
        <div
          style={{
            background: colors.card,
            border: `1px solid ${colors.accent}55`,
            borderLeft: `4px solid ${colors.accent}`,
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: colors.accent, textTransform: "uppercase", marginBottom: 4 }}>
            Final answer
          </div>
          <div style={{ fontSize: 13, color: colors.text }}>
            <MiniMd content={final} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
          Run produced no final answer.
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: colors.muted,
          textAlign: "right",
        }}
      >
        Powered by{" "}
        <a
          href="https://aevion.io/qcoreai"
          target="_blank"
          rel="noreferrer"
          style={{ color: colors.accent, textDecoration: "none", fontWeight: 700 }}
        >
          AEVION QCoreAI
        </a>
      </div>
    </div>
  );
}
