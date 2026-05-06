"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

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
  durationMs: number | null;
  costUsd: number | null;
  ordering: number;
  createdAt: string;
};

type RunInfo = {
  id: string;
  userInput: string;
  strategy: string | null;
  status: string;
  totalCostUsd: number | null;
  totalDurationMs: number | null;
  finalContent: string | null;
  startedAt: string;
};

const ROLE_COLOR: Record<string, { color: string; bg: string; tag: string; label: string }> = {
  user:     { color: "#0f172a", bg: "#f8fafc", tag: "U", label: "User" },
  analyst:  { color: "#2563eb", bg: "rgba(37,99,235,0.06)", tag: "A", label: "Analyst" },
  writer:   { color: "#059669", bg: "rgba(5,150,105,0.06)", tag: "W", label: "Writer" },
  critic:   { color: "#d97706", bg: "rgba(217,119,6,0.06)", tag: "C", label: "Critic" },
  final:    { color: "#7c3aed", bg: "rgba(124,58,237,0.06)", tag: "★", label: "Final" },
  guidance: { color: "#0891b2", bg: "rgba(8,145,178,0.06)", tag: "G", label: "Guidance" },
};
const defaultStyle = { color: "#475569", bg: "#f8fafc", tag: "?", label: "Agent" };

function styleFor(m: Msg) {
  return ROLE_COLOR[m.role] || defaultStyle;
}

function fmtMs(ms: number | null | undefined) {
  if (!ms) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function fmt$(n: number | null | undefined) {
  if (!n) return null;
  return `$${n.toFixed(5)}`;
}

const SPEEDS = [
  { label: "0.5×", ms: 2000 },
  { label: "1×",   ms: 1000 },
  { label: "2×",   ms: 500 },
  { label: "5×",   ms: 200 },
  { label: "10×",  ms: 100 },
];

function ReplayContent() {
  const params = useParams();
  const runId = typeof params?.runId === "string" ? params.runId : Array.isArray(params?.runId) ? params.runId[0] : "";

  const [run, setRun] = useState<RunInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Replay state
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1); // 1× default
  const [accCost, setAccCost] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!runId) return;
    (async () => {
      try {
        const [runRes, msgRes] = await Promise.all([
          fetch(apiUrl(`/api/qcoreai/runs/${runId}`), { headers: bearerHeader() }),
          fetch(apiUrl(`/api/qcoreai/runs/${runId}/messages`), { headers: bearerHeader() }),
        ]);
        const runData = await runRes.json().catch(() => ({}));
        if (!runRes.ok) throw new Error(runData?.error || `HTTP ${runRes.status}`);
        const msgData = await msgRes.json().catch(() => ({}));
        setRun(runData.run || runData);
        const msgs: Msg[] = (Array.isArray(msgData?.messages) ? msgData.messages : msgData?.items || [])
          .filter((m: Msg) => m.role !== "attachments")
          .sort((a: Msg, b: Msg) => a.ordering - b.ordering);
        setMessages(msgs);
        setStep(0);
      } catch (e: any) {
        setError(e?.message || "Failed to load run");
      } finally {
        setLoading(false);
      }
    })();
  }, [runId]);

  // Advance accumulated cost when step increases
  useEffect(() => {
    const visible = messages.slice(0, step);
    setAccCost(visible.reduce((s, m) => s + (m.costUsd ?? 0), 0));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step, messages]);

  const advance = useCallback(() => {
    setStep((s) => {
      if (s >= messages.length) { setPlaying(false); return s; }
      return s + 1;
    });
  }, [messages.length]);

  // Auto-advance timer
  useEffect(() => {
    if (!playing) { if (timerRef.current) clearTimeout(timerRef.current); return; }
    timerRef.current = setTimeout(() => {
      if (step >= messages.length) { setPlaying(false); return; }
      advance();
    }, SPEEDS[speedIdx].ms);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, step, speedIdx, advance, messages.length]);

  const reset = () => { setPlaying(false); setStep(0); };
  const skipToEnd = () => { setPlaying(false); setStep(messages.length); };

  const visible = messages.slice(0, step);
  const progress = messages.length > 0 ? Math.round((step / messages.length) * 100) : 0;

  if (loading) return <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading run…</p>;
  if (error || !run) return (
    <div>
      <p style={{ color: "#dc2626", fontSize: 13 }}>{error || "Run not found"}</p>
      <Link href="/qcoreai/multi" style={{ color: "#4338ca", fontSize: 13 }}>← Back</Link>
    </div>
  );

  return (
    <>
      {/* Run header */}
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "#0f172a", color: "#fff", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.15)" }}>
            {run.strategy || "sequential"}
          </span>
          <span style={{ fontWeight: 700, fontSize: 12, color: "#94a3b8" }}>{run.id.slice(0, 12)}…</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{run.userInput.length > 200 ? run.userInput.slice(0, 200) + "…" : run.userInput}</div>
      </div>

      {/* Controls */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(248,250,252,0.95)", backdropFilter: "blur(8px)",
          borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)",
          padding: "12px 16px", marginBottom: 16,
          display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
        }}
      >
        {/* Play/Pause */}
        <button
          onClick={() => setPlaying((v) => !v)}
          disabled={step >= messages.length && !playing}
          style={{
            padding: "7px 16px", borderRadius: 8, border: "none", fontWeight: 800, fontSize: 13,
            background: playing ? "#dc2626" : "#0f172a", color: "#fff", cursor: "pointer",
          }}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        {/* Step */}
        <button
          onClick={advance}
          disabled={step >= messages.length || playing}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#0f172a" }}
        >
          → Step
        </button>
        <button
          onClick={reset}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#475569" }}
        >
          ↺ Reset
        </button>
        <button
          onClick={skipToEnd}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#475569" }}
        >
          ⏭ End
        </button>

        {/* Speed */}
        <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeedIdx(i)}
              style={{
                padding: "5px 8px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: "1px solid " + (speedIdx === i ? "#0f172a" : "#e2e8f0"),
                background: speedIdx === i ? "#0f172a" : "#fff",
                color: speedIdx === i ? "#fff" : "#475569",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, background: "#7c3aed", width: `${progress}%`, transition: "width 0.2s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            <span>{step}/{messages.length} events</span>
            <span>💲 {accCost > 0 ? `$${accCost.toFixed(5)}` : "$0"}</span>
          </div>
        </div>
      </div>

      {/* Message stream */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((m, i) => {
          const s = styleFor(m);
          const isNew = i === step - 1;
          return (
            <div
              key={m.id}
              style={{
                padding: "12px 14px", borderRadius: 12,
                background: s.bg,
                border: `1px solid ${s.color}22`,
                opacity: isNew ? 1 : 0.85,
                transform: isNew ? "none" : "none",
                transition: "opacity 0.3s",
                outline: isNew ? `2px solid ${s.color}44` : "none",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>
                  {s.tag}
                </span>
                <span style={{ fontWeight: 800, fontSize: 12, color: s.color }}>
                  {s.label}{m.stage && m.stage !== m.role ? ` · ${m.stage}` : ""}{m.instance ? ` · ${m.instance.toUpperCase()}` : ""}
                </span>
                {m.model && <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.model.split("-").slice(0, 2).join("-")}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, fontSize: 11, color: "#94a3b8" }}>
                  {fmtMs(m.durationMs) && <span>{fmtMs(m.durationMs)}</span>}
                  {m.tokensIn != null && <span>{m.tokensIn}→{m.tokensOut} tok</span>}
                  {fmt$(m.costUsd) && <span style={{ fontWeight: 700, color: "#0f172a" }}>{fmt$(m.costUsd)}</span>}
                  <span style={{ fontSize: 9, color: "#cbd5e1" }}>#{m.ordering}</span>
                </div>
              </div>
              {m.content && (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: "#1e293b", maxHeight: 300, overflow: "hidden" }}>
                  {m.content.length > 600 ? m.content.slice(0, 600) + "…" : m.content}
                </div>
              )}
            </div>
          );
        })}
        {step >= messages.length && messages.length > 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 }}>
            ✓ Replay complete — {messages.length} events · {fmt$(run.totalCostUsd)} total
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </>
  );
}

export default function ReplayPage() {
  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>▶ Run Replay</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Step through agent events one by one — observe cost accumulation, token usage, and turn order.
          </p>
        </div>
        <Suspense fallback={<p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>}>
          <ReplayContent />
        </Suspense>
      </ProductPageShell>
    </main>
  );
}
