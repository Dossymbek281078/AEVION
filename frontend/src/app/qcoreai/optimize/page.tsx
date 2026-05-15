"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function OptimizePage() {
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [goal, setGoal] = useState<"clarity" | "conciseness" | "depth" | "creativity">("clarity");
  const [result, setResult] = useState<{ improved: string; changes: string[]; explanation: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const GOALS = [
    { id: "clarity", label: "Clarity", desc: "More specific, unambiguous instructions", icon: "🎯" },
    { id: "conciseness", label: "Conciseness", desc: "Remove redundancy, keep it tight", icon: "✂️" },
    { id: "depth", label: "Depth", desc: "Add context and nuance for richer outputs", icon: "🔬" },
    { id: "creativity", label: "Creativity", desc: "Encourage more varied, imaginative responses", icon: "🎨" },
  ] as const;

  const optimize = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Use QCoreAI single-agent chat to get optimization suggestions
      const systemPrompt = `You are a prompt engineering expert. Analyze the given prompt and return ONLY valid JSON with exactly this structure:
{
  "improved": "the improved version of the prompt",
  "changes": ["change 1", "change 2", "change 3"],
  "explanation": "brief explanation of why these changes help"
}

Optimization goal: ${goal} — ${GOALS.find(g => g.id === goal)?.desc}
${context ? `Additional context about intended use: ${context}` : ""}

Rules:
- Return ONLY the JSON object, no markdown, no explanation outside JSON
- improved: rewrite the prompt to optimize for the goal
- changes: 2-4 bullet points describing specific changes made
- explanation: 1-2 sentences on the overall improvement`;

      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Optimize this prompt:\n\n${prompt.trim()}` },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const reply = data.reply || "";
      // Parse JSON from reply
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse optimization result");
      const parsed = JSON.parse(jsonMatch[0]);
      setResult({
        improved: parsed.improved || "",
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        explanation: parsed.explanation || "",
      });
    } catch (e: any) {
      setError(e?.message || "Optimization failed — check API configuration");
    } finally {
      setBusy(false);
    }
  };

  const copyImproved = () => {
    if (result?.improved) navigator.clipboard.writeText(result.improved).catch(() => {});
  };

  const useImproved = () => {
    if (result?.improved) {
      sessionStorage.setItem("qcore_notebook_inject", result.improved);
      window.location.href = "/qcoreai/multi?from=notebook";
    }
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>✨ Prompt Optimizer</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Paste any prompt and get AI-powered optimization suggestions for clarity, conciseness, depth, or creativity.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          {/* Input panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>Your prompt *</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste the prompt you want to optimize…"
                rows={8}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>Context (optional)</label>
              <input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. used for legal document summarization"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Optimization goal</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    style={{
                      padding: "8px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                      border: `1px solid ${goal === g.id ? "#7c3aed" : "#e2e8f0"}`,
                      background: goal === g.id ? "rgba(124,58,237,0.08)" : "#fff",
                    }}
                  >
                    <div style={{ fontSize: 13, marginBottom: 2 }}>{g.icon} <span style={{ fontWeight: 700, color: goal === g.id ? "#6d28d9" : "#0f172a" }}>{g.label}</span></div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={optimize}
              disabled={!prompt.trim() || busy}
              style={{
                padding: "10px", borderRadius: 10, border: "none",
                background: !prompt.trim() || busy ? "#94a3b8" : "linear-gradient(135deg, #7c3aed, #4338ca)",
                color: "#fff", fontWeight: 800, fontSize: 14, cursor: !prompt.trim() || busy ? "default" : "pointer",
              }}
            >
              {busy ? "Optimizing…" : "✨ Optimize prompt"}
            </button>

            {error && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#991b1b", fontSize: 12 }}>
                {error}
              </div>
            )}
          </div>

          {/* Result panel */}
          <div>
            {!result && !busy && (
              <div style={{ padding: 40, borderRadius: 14, border: "1px dashed #e2e8f0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                Optimized prompt will appear here
              </div>
            )}
            {busy && (
              <div style={{ padding: 40, borderRadius: 14, border: "1px solid rgba(124,58,237,0.2)", background: "rgba(124,58,237,0.04)", textAlign: "center", color: "#6d28d9", fontSize: 13 }}>
                <div style={{ fontSize: 24, marginBottom: 8, animation: "spin 2s linear infinite", display: "inline-block" }}>✨</div>
                <div>Analyzing and optimizing…</div>
              </div>
            )}
            {result && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Improved prompt */}
                <div style={{ padding: 16, borderRadius: 12, border: "2px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#6d28d9", flex: 1 }}>✨ Optimized prompt</span>
                    <button onClick={copyImproved} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(124,58,237,0.3)", background: "#fff", color: "#6d28d9", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Copy</button>
                    <button onClick={useImproved} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#7c3aed", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↗ Use</button>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "#1e293b", whiteSpace: "pre-wrap" }}>{result.improved}</div>
                </div>

                {/* Changes */}
                {result.changes.length > 0 && (
                  <div style={{ padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 8 }}>Changes made</div>
                    {result.changes.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 12, color: "#334155" }}>
                        <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>•</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Explanation */}
                {result.explanation && (
                  <div style={{ padding: 12, borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#065f46", lineHeight: 1.5 }}>
                    {result.explanation}
                  </div>
                )}

                <button
                  onClick={() => { setPrompt(result.improved); setResult(null); }}
                  style={{ padding: "7px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  ← Use as new input (optimize again)
                </button>
              </div>
            )}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </ProductPageShell>
    </main>
  );
}
