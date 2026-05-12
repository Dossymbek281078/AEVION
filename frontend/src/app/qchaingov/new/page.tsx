"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

type Category = "treasury" | "protocol" | "module" | "partnership" | "tokenomics" | "social" | "operations" | "emergency";
type VoteMode = "yes-no-abstain" | "ranked-choice" | "weighted";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "treasury", label: "Treasury" }, { id: "protocol", label: "Protocol" },
  { id: "module", label: "Module" }, { id: "partnership", label: "Partnership" },
  { id: "tokenomics", label: "Tokenomics" }, { id: "social", label: "Social" },
  { id: "operations", label: "Operations" }, { id: "emergency", label: "Emergency" },
];
const VOTE_MODES: { id: VoteMode; label: string; hint: string }[] = [
  { id: "yes-no-abstain", label: "Yes / No / Abstain", hint: "Standard 3-option vote" },
  { id: "ranked-choice", label: "Ranked choice", hint: "Voters rank options by preference" },
  { id: "weighted", label: "Weighted", hint: "Voters split weight across options" },
];

const C = { bg: "#0f172a", card: "#1e293b", border: "#334155", accent: "#34d399", text: "#f1f5f9", mute: "#94a3b8", danger: "#f87171", warn: "#fbbf24" };
const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 };
const input: React.CSSProperties = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box", outline: "none" };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: C.mute, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 };
const h2: React.CSSProperties = { margin: 0, marginBottom: 12, fontSize: 15, fontWeight: 600, color: C.text };

const defaultOptions = (m: VoteMode) => m === "yes-no-abstain" ? ["yes", "no", "abstain"] : ["option-1", "option-2"];
const clampInt = (v: number, min: number, max: number, fb: number) => !Number.isFinite(v) ? fb : Math.max(min, Math.min(max, Math.floor(v)));

export default function NewProposalPage() {
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("operations");
  const [voteMode, setVoteMode] = useState<VoteMode>("yes-no-abstain");
  const [options, setOptions] = useState<string[]>(defaultOptions("yes-no-abstain"));
  const [quorumPercent, setQuorumPercent] = useState<number>(10);
  const [passThreshold, setPassThreshold] = useState<number>(50);
  const [votesOpenAt, setVotesOpenAt] = useState("");
  const [votesCloseAt, setVotesCloseAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; options: string[] } | null>(null);

  useEffect(() => { setToken(localStorage.getItem("aevion_token")); setHydrated(true); }, []);

  const optionWarnings = useMemo(() => {
    const t = options.map(o => o.trim());
    const msgs: string[] = [];
    if (t.some(o => o.length === 0)) msgs.push("Each option must be non-empty.");
    const seen = new Set<string>();
    for (const o of t) { const k = o.toLowerCase(); if (!k) continue; if (seen.has(k)) { msgs.push("Options must be unique."); break; } seen.add(k); }
    return msgs;
  }, [options]);

  const changeVoteMode = (next: VoteMode) => { setVoteMode(next); setOptions(defaultOptions(next)); };
  const setOptionAt = (i: number, v: string) => setOptions(p => p.map((o, idx) => idx === i ? v : o));
  const removeOption = (i: number) => setOptions(p => p.length <= 2 ? p : p.filter((_, idx) => idx !== i));
  const addOption = () => setOptions(p => p.length >= 10 ? p : [...p, ""]);

  const resetForm = () => {
    setTitle(""); setSummary(""); setBody(""); setCategory("operations");
    setVoteMode("yes-no-abstain"); setOptions(defaultOptions("yes-no-abstain"));
    setQuorumPercent(10); setPassThreshold(50); setVotesOpenAt(""); setVotesCloseAt("");
    setError(null); setSuccess(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (optionWarnings.length > 0) { setError(optionWarnings.join(" ")); return; }
    if (options.length < 2 || options.length > 10) { setError("Provide between 2 and 10 options."); return; }
    if (title.trim().length < 5 || title.trim().length > 200) { setError("Title must be 5..200 characters."); return; }
    if (summary.trim().length < 10 || summary.trim().length > 500) { setError("Summary must be 10..500 characters."); return; }
    if (body.trim().length < 20 || body.trim().length > 20000) { setError("Body must be 20..20000 characters."); return; }

    const payload: Record<string, unknown> = {
      title: title.trim(), summary: summary.trim(), body: body.trim(), category, voteMode,
      options: options.map(o => o.trim()),
      quorumPercent: clampInt(quorumPercent, 1, 100, 10),
      passThreshold: clampInt(passThreshold, 1, 100, 50),
    };
    if (votesOpenAt) payload.votesOpenAt = new Date(votesOpenAt).toISOString();
    if (votesCloseAt) payload.votesCloseAt = new Date(votesCloseAt).toISOString();

    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBase()}/api/qchaingov/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      const raw = await res.text();
      let data: unknown = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!res.ok) {
        const m = data && typeof data === "object" && data !== null && "error" in data ? String((data as { error: unknown }).error) : null;
        setError(m || `Request failed (${res.status}).`); return;
      }
      if (data && typeof data === "object" && "id" in data && typeof (data as { id: unknown }).id === "string") {
        const id = (data as { id: string }).id;
        const opts = "options" in data && Array.isArray((data as { options: unknown }).options)
          ? ((data as { options: unknown[] }).options.filter(x => typeof x === "string") as string[])
          : options.map(o => o.trim());
        setSuccess({ id, options: opts });
      } else setError("Unexpected response from server.");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") setError("Request timed out after 10s. Please retry.");
      else setError(err instanceof Error ? err.message : "Network error.");
    } finally { setSubmitting(false); }
  }

  if (!hydrated) return <div style={{ minHeight: "100vh", background: C.bg, color: C.text }} />;

  const pageWrap: React.CSSProperties = { minHeight: "100vh", background: C.bg, color: C.text, padding: "24px 16px 64px", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" };
  const inner: React.CSSProperties = { maxWidth: 820, margin: "0 auto" };
  const back: React.CSSProperties = { color: C.mute, textDecoration: "none", fontSize: 13 };

  if (!token) return (
    <div style={pageWrap}><div style={inner}>
      <Link href="/qchaingov/proposals" style={back}>← Proposals</Link>
      <h1 style={{ fontSize: 22, marginTop: 14, marginBottom: 14 }}>New proposal</h1>
      <div style={card}>
        <p style={{ margin: 0, marginBottom: 10 }}>You need to sign in to draft a proposal.</p>
        <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>
          <Link href="/auth?next=/qchaingov/new" style={{ color: C.accent, textDecoration: "none", fontWeight: 600 }}>Sign in →</Link>
        </p>
      </div>
    </div></div>
  );

  if (success) return (
    <div style={pageWrap}><div style={inner}>
      <Link href="/qchaingov/proposals" style={back}>← Proposals</Link>
      <h1 style={{ fontSize: 22, marginTop: 14, marginBottom: 14 }}>Proposal drafted</h1>
      <div style={card}>
        <div style={{ display: "inline-block", background: "rgba(52,211,153,0.12)", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>draft</div>
        <p style={{ margin: 0, marginBottom: 8, fontSize: 14 }}>Proposal id: <code style={{ color: C.accent }}>{success.id}</code></p>
        <p style={{ margin: 0, marginBottom: 14, color: C.mute, fontSize: 13 }}>Status is <strong style={{ color: C.text }}>draft</strong>. An admin must open voting before users can vote.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href={`/qchaingov/proposals/${success.id}`} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 600, textDecoration: "none", fontSize: 14 }}>View proposal →</Link>
          <button type="button" onClick={resetForm} style={{ background: "transparent", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Draft another</button>
        </div>
      </div>
    </div></div>
  );

  const chip: React.CSSProperties = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
  const chipOn: React.CSSProperties = { ...chip, background: "rgba(52,211,153,0.12)", borderColor: C.accent, color: C.accent, fontWeight: 600 };

  return (
    <div style={pageWrap}><div style={inner}>
      <Link href="/qchaingov/proposals" style={back}>← Proposals</Link>
      <h1 style={{ fontSize: 22, marginTop: 14, marginBottom: 4 }}>New proposal</h1>
      <p style={{ margin: 0, marginBottom: 18, color: C.mute, fontSize: 13 }}>Draft a governance proposal. It will be saved as <strong>draft</strong> — an admin must open voting before it goes live.</p>

      <form onSubmit={submit} noValidate>
        <div style={card}>
          <h2 style={h2}>Overview</h2>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl} htmlFor="title">Title ({title.trim().length} / 200)</label>
            <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="A concise headline" style={input} required />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl} htmlFor="summary">Summary ({summary.trim().length} / 500)</label>
            <textarea id="summary" rows={2} value={summary} onChange={e => setSummary(e.target.value)} maxLength={500} placeholder="One-paragraph elevator pitch" style={{ ...input, resize: "vertical", minHeight: 56 }} required />
          </div>
          <div>
            <label style={lbl} htmlFor="body">Body ({body.trim().length} / 20000)</label>
            <textarea id="body" rows={10} value={body} onChange={e => setBody(e.target.value)} maxLength={20000} placeholder="Full proposal — context, motivation, specification, references. Markdown supported." style={{ ...input, resize: "vertical", minHeight: 220, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} required />
          </div>
        </div>

        <div style={card}>
          <h2 style={h2}>Category</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)} style={category === c.id ? chipOn : chip} aria-pressed={category === c.id}>{c.label}</button>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2 style={h2}>Vote mode</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {VOTE_MODES.map(m => (
              <button key={m.id} type="button" onClick={() => changeVoteMode(m.id)} style={voteMode === m.id ? chipOn : chip} aria-pressed={voteMode === m.id} title={m.hint}>{m.label}</button>
            ))}
          </div>
          <p style={{ margin: 0, color: C.mute, fontSize: 12 }}>{VOTE_MODES.find(m => m.id === voteMode)?.hint}</p>
        </div>

        <div style={card}>
          <h2 style={h2}>Options ({options.length} / 10)</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="text" value={opt} onChange={e => setOptionAt(i, e.target.value)} maxLength={80} aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`} style={input} />
                <button type="button" onClick={() => removeOption(i)} disabled={options.length <= 2} aria-label={`Remove option ${i + 1}`}
                  style={{ background: "transparent", color: options.length <= 2 ? C.border : C.danger, border: `1px solid ${options.length <= 2 ? C.border : C.danger}`, borderRadius: 8, width: 36, height: 36, cursor: options.length <= 2 ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>−</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addOption} disabled={options.length >= 10}
            style={{ marginTop: 10, background: "transparent", color: options.length >= 10 ? C.border : C.accent, border: `1px dashed ${options.length >= 10 ? C.border : C.accent}`, borderRadius: 8, padding: "8px 12px", cursor: options.length >= 10 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>+ Add option</button>
          {optionWarnings.length > 0 && <p style={{ margin: 0, marginTop: 10, color: C.warn, fontSize: 12 }}>{optionWarnings.join(" ")}</p>}
        </div>

        <div style={card}>
          <h2 style={h2}>Thresholds</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl} htmlFor="quorum">Quorum %</label>
              <input id="quorum" type="number" min={1} max={100} step={1} value={quorumPercent} onChange={e => setQuorumPercent(parseInt(e.target.value, 10))} onBlur={() => setQuorumPercent(v => clampInt(v, 1, 100, 10))} style={input} />
            </div>
            <div>
              <label style={lbl} htmlFor="threshold">Pass threshold %</label>
              <input id="threshold" type="number" min={1} max={100} step={1} value={passThreshold} onChange={e => setPassThreshold(parseInt(e.target.value, 10))} onBlur={() => setPassThreshold(v => clampInt(v, 1, 100, 50))} style={input} />
            </div>
          </div>
          <p style={{ margin: 0, marginTop: 10, color: C.mute, fontSize: 12 }}>Quorum = minimum % of eligible voters required. Threshold = % needed to pass.</p>
        </div>

        <div style={card}>
          <h2 style={h2}>Schedule</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl} htmlFor="open">Votes open at</label>
              <input id="open" type="datetime-local" value={votesOpenAt} onChange={e => setVotesOpenAt(e.target.value)} style={input} />
            </div>
            <div>
              <label style={lbl} htmlFor="close">Votes close at</label>
              <input id="close" type="datetime-local" value={votesCloseAt} onChange={e => setVotesCloseAt(e.target.value)} style={input} />
            </div>
          </div>
          <p style={{ margin: 0, marginTop: 10, color: C.mute, fontSize: 12 }}>Leave empty to let admin set later.</p>
        </div>

        {error && (
          <div style={{ ...card, borderColor: C.danger, background: "rgba(248,113,113,0.08)" }} role="alert">
            <p style={{ margin: 0, color: C.danger, fontSize: 14 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button type="submit" disabled={submitting}
            style={{ background: submitting ? C.border : C.accent, color: C.bg, border: "none", borderRadius: 8, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: submitting ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {submitting && <span aria-hidden style={{ width: 14, height: 14, border: `2px solid ${C.bg}`, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "qchg-spin 0.8s linear infinite" }} />}
            {submitting ? "Submitting…" : "Create draft proposal"}
          </button>
          <span style={{ color: C.mute, fontSize: 12 }}>Saved as draft. Admin opens voting.</span>
        </div>
      </form>

      <style>{`@keyframes qchg-spin { to { transform: rotate(360deg); } }`}</style>
    </div></div>
  );
}
