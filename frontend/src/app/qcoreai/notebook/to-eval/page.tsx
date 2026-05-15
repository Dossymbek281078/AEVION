"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Snippet = { id: string; runId: string; role: string; content: string; annotation: string | null; tags: string[]; createdAt: string };

function ToEvalContent() {
  const params = useSearchParams();
  const snippetIds = params?.get("ids")?.split(",").filter(Boolean) || [];

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [suiteName, setSuiteName] = useState("Notebook eval suite");
  const [suiteDesc, setSuiteDesc] = useState("");
  const [judgeType, setJudgeType] = useState<"contains" | "min_length" | "llm_judge">("min_length");
  const [judgeValue, setJudgeValue] = useState("50");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (snippetIds.length === 0) { setLoading(false); return; }
    Promise.all(snippetIds.map((id) =>
      fetch(apiUrl(`/api/qcoreai/notebook/${id}`), { headers: bearerHeader() }).then((r) => r.json()).then((d) => d.snippet).catch(() => null)
    )).then((results) => {
      setSnippets(results.filter(Boolean));
      setLoading(false);
    });
  }, []);

  const create = async () => {
    if (snippets.length === 0 || !suiteName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const judge = judgeType === "contains"
        ? { type: "contains", needle: judgeValue, caseSensitive: false }
        : judgeType === "min_length"
        ? { type: "min_length", chars: parseInt(judgeValue) || 50 }
        : { type: "llm_judge", rubric: judgeValue || "The response is helpful and accurate." };

      const cases = snippets.map((s, i) => ({
        id: `case-${i}`,
        name: s.annotation || `Snippet ${i + 1}`,
        input: s.content.slice(0, 4000),
        judge,
        weight: 1,
      }));

      const res = await fetch(apiUrl("/api/qcoreai/eval/suites"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ name: suiteName.trim(), description: suiteDesc.trim() || null, strategy: "sequential", cases }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCreated({ id: data.suite.id, name: data.suite.name });
    } catch (e: any) {
      setError(e?.message || "Failed to create suite");
    } finally {
      setCreating(false);
    }
  };

  if (created) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Eval suite created!</div>
        <p style={{ color: "#64748b", marginBottom: 20 }}>"{created.name}" with {snippets.length} test cases</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href={`/qcoreai/eval/${created.id}`} style={{ padding: "10px 20px", borderRadius: 10, background: "#0f172a", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Open eval suite →</Link>
          <Link href="/qcoreai/notebook" style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", color: "#475569", fontWeight: 700, textDecoration: "none" }}>← Back to notebook</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {loading ? <p style={{ color: "#94a3b8" }}>Loading snippets…</p> : snippets.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
          <p>No snippets found. Select snippets from the notebook first.</p>
          <Link href="/qcoreai/notebook" style={{ color: "#4338ca", fontWeight: 700 }}>← Back to notebook</Link>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Creating eval suite from {snippets.length} snippet{snippets.length !== 1 ? "s" : ""}</div>
            {snippets.slice(0, 3).map((s, i) => (
              <div key={s.id} style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                {i + 1}. {s.annotation || s.content.slice(0, 60)}…
              </div>
            ))}
            {snippets.length > 3 && <div style={{ fontSize: 11, color: "#94a3b8" }}>+{snippets.length - 3} more</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Suite name *</label>
              <input value={suiteName} onChange={(e) => setSuiteName(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Description</label>
              <input value={suiteDesc} onChange={(e) => setSuiteDesc(e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>Judge type for each case</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["min_length", "contains", "llm_judge"] as const).map((j) => (
                  <button key={j} onClick={() => setJudgeType(j)} style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${judgeType === j ? "#0f172a" : "#e2e8f0"}`, background: judgeType === j ? "#0f172a" : "#fff", color: judgeType === j ? "#fff" : "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {j === "min_length" ? "Min length" : j === "contains" ? "Contains" : "LLM judge"}
                  </button>
                ))}
              </div>
              <input
                value={judgeValue}
                onChange={(e) => setJudgeValue(e.target.value)}
                placeholder={judgeType === "min_length" ? "Minimum chars (e.g. 50)" : judgeType === "contains" ? "Required substring" : "Quality rubric…"}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#991b1b", fontSize: 12 }}>{error}</div>}

            <button onClick={create} disabled={creating || !suiteName.trim()}
              style={{ padding: "10px", borderRadius: 10, border: "none", background: creating || !suiteName.trim() ? "#94a3b8" : "linear-gradient(135deg, #7c3aed, #4338ca)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              {creating ? "Creating…" : `🧪 Create eval suite (${snippets.length} cases)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function NotebookToEvalPage() {
  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🧪 Notebook → Eval</h1>
            <Link href="/qcoreai/notebook" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Notebook</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Create an eval test suite from selected notebook snippets.</p>
        </div>
        <Suspense fallback={<p style={{ color: "#94a3b8" }}>Loading…</p>}>
          <ToEvalContent />
        </Suspense>
      </ProductPageShell>
    </main>
  );
}
