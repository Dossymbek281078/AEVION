"use client";

// Small, self-contained "Ask AI" box for product pages. Routes the question
// through the platform smart-call layer (askSmart → /api/qcoreai/smart), shows
// the answer, and surfaces a tiny badge of how the router resolved it (single
// vs light/deep council) so the cost-aware routing is visible in-product. Every
// ask feeds the shared savings tally under `module`.
import { useId, useRef, useState } from "react";
import { askSmart, type AskRouting } from "@/lib/askSmart";

export default function AskAi({
  module,
  title = "Ask AI",
  placeholder = "Ask a question…",
}: {
  module: string;
  title?: string;
  placeholder?: string;
}) {
  // Подпись у поля на экране ЕСТЬ, но читалке она не была видна: связи не
  // было, и поле объявлялось безымянным. Placeholder именем не считается —
  // он исчезает при вводе. Найдено зондом aevion-a11y-names 28.08.2026.
  const titleId = useId();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [routing, setRouting] = useState<AskRouting | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastSubmitRef = useRef(0);

  const submit = async () => {
    const question = q.trim();
    if (!question || busy) return;
    // Debounce: ignore rapid re-submits within 800ms.
    const now = Date.now();
    if (now - lastSubmitRef.current < 800) return;
    lastSubmitRef.current = now;
    if (now < cooldownUntil) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setErr(null);
    setAnswer("");
    setRouting(null);
    try {
      const r = await askSmart({ question, module, signal: ac.signal });
      setAnswer(r.answer);
      setRouting(r.routing);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = String(e?.message || "");
      // Friendly handling for the known gate responses on the public endpoint.
      if (/(^|\D)429(\D|$)|too many/i.test(msg)) {
        setErr("Too many requests — please wait a few seconds.");
        setCooldownUntil(Date.now() + 8000);
      } else if (/(^|\D)402(\D|$)|quota|payment/i.test(msg)) {
        setErr("Free AI quota reached. Upgrade to keep asking.");
        setCooldownUntil(Date.now() + 30000);
      } else {
        setErr(msg || "failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const badge =
    routing &&
    (routing.resolved === "single"
      ? "factual → single flagship"
      : routing.depth === "deep"
        ? "open → deep council (L2)"
        : "open → light council (L1)");

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff", maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span aria-hidden>⚡</span>
        <strong id={titleId} style={{ fontSize: 14 }}>{title}</strong>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>routed by cost — facts stay cheap</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          aria-labelledby={titleId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={placeholder}
          disabled={busy}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
        />
        <button
          onClick={submit}
          disabled={busy || !q.trim()}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 800,
            color: "#fff", background: busy ? "#94a3b8" : "linear-gradient(135deg,#0d9488,#0ea5e9)",
            cursor: busy || !q.trim() ? "default" : "pointer",
          }}
        >
          {busy ? "…" : "Ask"}
        </button>
      </div>
      {err && <p style={{ color: "#b91c1c", fontSize: 12, margin: "8px 0 0" }}>Could not answer: {err}</p>}
      {answer && (
        <div style={{ marginTop: 10 }}>
          {badge && (
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#0f766e", background: "rgba(13,148,136,0.1)", border: "1px solid rgba(13,148,136,0.3)", borderRadius: 999, padding: "1px 8px", marginBottom: 6 }}>
              {badge}{routing ? ` · $${routing.costUsd.toFixed(4)}` : ""}
            </span>
          )}
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55, color: "#0f172a" }}>{answer}</div>
        </div>
      )}
    </div>
  );
}
