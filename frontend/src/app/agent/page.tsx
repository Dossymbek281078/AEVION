"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { activatable } from "@/lib/activatable";
import { planFromMessage, parseLLMPlan, buildPlannerSystemPrompt, TOOLS, type AgentPlan } from "./lib/planner";
import {
  diffLocalModels,
  loadLastModels,
  saveLastModels,
  appendFeedback,
  type LocalModelSnapshot,
  type ModelDiff,
  type Rating,
} from "./lib/agentMemory";

type Provider = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  configured: boolean;
  free: boolean;
  local: boolean;
};

type RunResult =
  | { kind: "image"; url: string }
  | { kind: "audio"; url: string }
  | { kind: "link"; url: string }
  | { kind: "text"; text: string }
  | { kind: "error"; text: string };

function readChatText(data: unknown): string {
  const o = (data ?? {}) as Record<string, unknown>;
  const direct = o.text ?? o.reply ?? o.content ?? o.message ?? o.answer;
  if (typeof direct === "string") return direct;
  const choices = o.choices as Array<{ message?: { content?: string } }> | undefined;
  if (choices?.[0]?.message?.content) return choices[0].message!.content!;
  return JSON.stringify(data);
}

export default function AgentPage() {
  const [message, setMessage] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ranPlan, setRanPlan] = useState<AgentPlan | null>(null);
  const [rated, setRated] = useState<Rating | null>(null);
  const [offline, setOffline] = useState(false);
  const [smart, setSmart] = useState(true);
  const [modelUpdates, setModelUpdates] = useState<ModelDiff>({ added: [], removed: [] });

  const rulePlan: AgentPlan = useMemo(() => planFromMessage(message), [message]);

  const localProviders = providers.filter((p) => p.local && p.configured);
  const localId = localProviders[0]?.id;

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/qcoreai/providers"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !Array.isArray(j?.providers)) return;
        const ps = j.providers as Provider[];
        setProviders(ps);
        // Offline-model update tracking: diff the local roster vs last visit.
        const snap: LocalModelSnapshot[] = ps
          .filter((p) => p.local)
          .map((p) => ({ id: p.id, models: p.models || [] }));
        setModelUpdates(diffLocalModels(loadLastModels(), snap));
        saveLastModels(snap);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function classifyWithLLM(text: string): Promise<AgentPlan | null> {
    try {
      const r = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: buildPlannerSystemPrompt() },
            { role: "user", content: text },
          ],
          ...(offline && localId ? { provider: localId } : {}),
          temperature: 0,
        }),
      });
      if (!r.ok) return null;
      const data = await r.json().catch(() => ({}));
      return parseLLMPlan(readChatText(data));
    } catch {
      return null;
    }
  }

  async function run() {
    if (!message.trim() || running) return;
    setRunning(true);
    setResult(null);
    setRated(null);
    try {
      // Smart planning: let the model classify; fall back to the rule planner.
      let plan = rulePlan;
      if (smart) {
        const llm = await classifyWithLLM(message.trim());
        if (llm) plan = llm;
      }
      setRanPlan(plan);

      if (plan.mode === "chat") {
        const r = await fetch(apiUrl("/api/qcoreai/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: message.trim() }],
            ...(offline && localId ? { provider: localId } : {}),
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || `chat failed (${r.status})`);
        setResult({ kind: "text", text: readChatText(data) });
        return;
      }

      if (plan.missing.length) {
        setResult({ kind: "error", text: `Can't run yet — add: ${plan.missing.join(", ")}.` });
        return;
      }
      const r = await fetch(apiUrl(plan.tool!.endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan.params),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `${plan.tool!.label} failed (${r.status})`);

      switch (plan.tool!.resultKind) {
        case "image":
          setResult(data.url ? { kind: "image", url: data.url } : { kind: "error", text: "No image returned." });
          break;
        case "audio":
          setResult(data.url || data.audioUrl ? { kind: "audio", url: data.url || data.audioUrl } : { kind: "text", text: JSON.stringify(data) });
          break;
        case "link":
          setResult(data.url || data.link ? { kind: "link", url: data.url || data.link } : { kind: "text", text: JSON.stringify(data) });
          break;
        default:
          setResult({ kind: "text", text: JSON.stringify(data) });
      }
    } catch (e) {
      setResult({ kind: "error", text: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  function rate(r: Rating) {
    if (rated) return;
    setRated(r);
    appendFeedback({
      ts: Date.now(),
      message: message.trim().slice(0, 200),
      mode: ranPlan?.mode ?? "chat",
      toolId: ranPlan?.toolId ?? null,
      rating: r,
    });
  }

  const toggle = (on: boolean): React.CSSProperties => ({
    fontSize: 12.5,
    padding: "5px 12px",
    borderRadius: 999,
    cursor: "pointer",
    border: `1px solid ${on ? "rgba(94,234,212,0.6)" : "rgba(51,65,85,0.6)"}`,
    background: on ? "rgba(94,234,212,0.12)" : "rgba(15,23,42,0.6)",
    color: on ? "#5eead4" : "#94a3b8",
  });

  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#5eead4", marginBottom: 8 }}>
          AEVION Agent · preview
        </div>
        <h1 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
          One window — text or action
        </h1>
        <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 20px" }}>
          Ask a question or ask for a thing — image, voice, payment link, email — and it&apos;s done here.
          Smart planning lets the model route your message; Offline routes chat + planning to a local model
          ($0 tokens, private). Actions still use their own services.
        </p>

        {/* Mode toggles */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {/* Переключатель, а не текст: до 31.08.2026 это был span с onClick —
              мышью работал, Tab проходил мимо. Роль switch, а не button:
              читалка обязана называть состояние «включено / выключено». */}
          <span
            {...activatable(() => setSmart((v) => !v))}
            role="switch"
            aria-checked={smart}
            style={toggle(smart)}
          >🧠 Smart planning {smart ? "on" : "off"}</span>
          <span
            {...activatable(() => { if (localId) setOffline((v) => !v); })}
            role="switch"
            aria-checked={offline && !!localId}
            aria-disabled={!localId}
            style={{ ...toggle(offline && !!localId), opacity: localId ? 1 : 0.5 }}
            title={localId ? `Local model: ${localId}` : "No configured local runtime detected"}
          >
            🔒 Offline {localId ? (offline ? "on" : "off") : "unavailable"}
          </span>
        </div>

        {/* Providers — incl. offline/local runtimes + update badge */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: 8 }}>
            Models {localProviders.length > 0 && <span style={{ color: "#5eead4" }}>· {localProviders.length} offline/local</span>}
            {modelUpdates.added.length > 0 && (
              <span style={{ color: "#a3e635" }}> · {modelUpdates.added.length} new since last visit</span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {providers.length === 0 && <span style={{ fontSize: 12, color: "#475569" }}>Loading providers…</span>}
            {providers.map((p) => (
              <span
                key={p.id}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: `1px solid ${p.local ? "rgba(94,234,212,0.4)" : "rgba(51,65,85,0.6)"}`,
                  background: p.local ? "rgba(94,234,212,0.08)" : "rgba(15,23,42,0.6)",
                  color: p.configured ? "#cbd5e1" : "#475569",
                }}
                title={p.defaultModel}
              >
                {p.name}
                {p.local && <span style={{ color: "#5eead4" }}> · offline</span>}
                {p.free && <span style={{ color: "#a3e635" }}> · free</span>}
                {!p.configured && <span style={{ color: "#64748b" }}> · off</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Tool palette */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: 8 }}>
            What it can do
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TOOLS.map((t) => (
              <span
                key={t.id}
                style={{
                  fontSize: 12.5,
                  padding: "5px 11px",
                  borderRadius: 999,
                  border: `1px solid ${rulePlan.toolId === t.id ? "rgba(94,234,212,0.6)" : "rgba(51,65,85,0.6)"}`,
                  background: rulePlan.toolId === t.id ? "rgba(94,234,212,0.12)" : "rgba(15,23,42,0.6)",
                  color: rulePlan.toolId === t.id ? "#5eead4" : "#94a3b8",
                }}
                title={t.description}
              >
                {t.emoji} {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Input */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Опишите задачу" placeholder="e.g. «нарисуй логотип для кофейни» · «выставь счёт на $25» · «объясни как работает RSA»"
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(51,65,85,0.7)",
            borderRadius: 12,
            color: "#e2e8f0",
            fontSize: 15,
            padding: 14,
            resize: "vertical",
          }}
        />

        {/* Rule-plan preview (instant; Smart planning refines on Run) */}
        {message.trim() && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
            <strong style={{ color: rulePlan.mode === "action" ? "#5eead4" : "#7dd3fc" }}>
              {rulePlan.mode === "action" ? `${rulePlan.tool?.emoji} ${rulePlan.tool?.label}` : "💬 Chat"}
            </strong>{" "}
            — {rulePlan.rationale}
            {smart && <span style={{ color: "#64748b" }}> (Smart planning may refine this on Run)</span>}
          </div>
        )}

        <button
          onClick={run}
          disabled={running || !message.trim()}
          style={{
            marginTop: 14,
            padding: "10px 22px",
            borderRadius: 10,
            border: "none",
            background: running || !message.trim() ? "rgba(51,65,85,0.6)" : "linear-gradient(135deg,#0d9488,#0ea5e9)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: running || !message.trim() ? "default" : "pointer",
          }}
        >
          {running ? "Running…" : "Run"}
        </button>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.6)" }}>
            {result.kind === "image" && <img src={result.url} alt="generated" style={{ maxWidth: "100%", borderRadius: 8 }} />}
            {result.kind === "audio" && <audio controls src={result.url} style={{ width: "100%" }} />}
            {result.kind === "link" && (
              <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: "#5eead4", fontWeight: 700 }}>
                {result.url}
              </a>
            )}
            {result.kind === "text" && <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{result.text}</div>}
            {result.kind === "error" && <div style={{ fontSize: 13.5, color: "#fca5a5" }}>⚠️ {result.text}</div>}

            {/* Eval loop — feedback substrate, not self-learning */}
            {result.kind !== "error" && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#64748b" }}>
                {rated ? (
                  <span>Thanks — logged for future tuning.</span>
                ) : (
                  <>
                    <span>Was this good?</span>
                    <span onClick={() => rate("up")} style={{ cursor: "pointer", fontSize: 16 }} role="button" aria-label="thumbs up">👍</span>
                    <span onClick={() => rate("down")} style={{ cursor: "pointer", fontSize: 16 }} role="button" aria-label="thumbs down">👎</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
