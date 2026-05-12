"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

type Props = {
  proposalId: string;
  options: string[];
  voteMode: string;
  status: string;
};

type SuccessResult = { ok: true; voteId: string; choice: string };
type FailureResult = { ok: false; kind: "auth" | "already" | "closed" | "invalid" | "notfound" | "network"; message: string; allowed?: string[] };
type Result = SuccessResult | FailureResult;

function shortId(s: string, n = 8): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n);
}

const spinnerCss = `@keyframes vf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;

export default function VoteForm({ proposalId, options, voteMode, status }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [weight, setWeight] = useState<string>("1");
  const [rationale, setRationale] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    setHydrated(true);
    try {
      const t = localStorage.getItem("aevion_token");
      setHasToken(!!t);
    } catch {
      setHasToken(false);
    }
  }, []);

  const showWeight = voteMode === "weighted" || voteMode === "ranked-choice";
  const rationaleLen = rationale.length;
  const overLimit = rationaleLen > 1000;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const token = (() => {
        try { return localStorage.getItem("aevion_token") || ""; } catch { return ""; }
      })();
      const body: Record<string, unknown> = { choice };
      if (showWeight) {
        const w = parseInt(weight, 10);
        if (Number.isFinite(w) && w >= 1) body.weight = w;
      }
      if (rationale.trim()) body.rationale = rationale.trim().slice(0, 1000);

      const r = await fetch(`${getApiBase()}/api/qchaingov/proposals/${encodeURIComponent(proposalId)}/votes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      let data: Record<string, unknown> = {};
      try { data = await r.json(); } catch { /* ignore parse errors */ }

      if (r.status === 201) {
        const voteId = typeof data.id === "string" ? data.id : "";
        const ch = typeof data.choice === "string" ? data.choice : choice;
        setResult({ ok: true, voteId, choice: ch });
      } else if (r.status === 401) {
        setResult({ ok: false, kind: "auth", message: "Please sign in to vote." });
      } else if (r.status === 409 || data.error === "already_voted") {
        setResult({ ok: false, kind: "already", message: "You've already voted on this proposal." });
      } else if (r.status === 400 && data.error === "voting_not_open") {
        setResult({ ok: false, kind: "closed", message: "Voting closed since you loaded the page." });
      } else if (r.status === 400 && data.error === "invalid_choice") {
        const allowed = Array.isArray(data.allowed) ? (data.allowed as string[]) : undefined;
        setResult({ ok: false, kind: "invalid", message: "Invalid choice.", allowed });
      } else if (r.status === 400 && data.error === "rationale_too_long") {
        setResult({ ok: false, kind: "invalid", message: "Rationale exceeds 1000 characters — please shorten." });
      } else if (r.status === 404) {
        setResult({ ok: false, kind: "notfound", message: "Proposal not found." });
      } else {
        setResult({ ok: false, kind: "network", message: "Couldn't submit your vote. Try again." });
      }
    } catch {
      setResult({ ok: false, kind: "network", message: "Couldn't submit your vote. Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  // Pre-hydration placeholder to avoid flicker / hydration mismatch
  if (!hydrated) {
    return (
      <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, marginBottom: 10 }}>Cast your vote</h3>
        <div style={{ fontSize: 12, color: "#64748b" }}>Loading…</div>
      </div>
    );
  }

  // Not authenticated
  if (!hasToken) {
    return (
      <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, marginBottom: 8 }}>Cast your vote</h3>
        <p style={{ fontSize: 13, color: "#cbd5e1", margin: 0, marginBottom: 12, lineHeight: 1.55 }}>
          You need to sign in to cast a vote on this proposal.
        </p>
        <a
          href={`/auth?next=${encodeURIComponent(`/qchaingov/proposals/${proposalId}`)}`}
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "#34d399",
            color: "#0f172a",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Sign in to vote →
        </a>
      </div>
    );
  }

  // Voting not open — gated banner, no form
  if (status !== "open") {
    return (
      <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, marginBottom: 8 }}>Cast your vote</h3>
        <div
          role="status"
          style={{
            padding: "10px 12px",
            background: "#fbbf2422",
            border: "1px solid #fbbf2455",
            borderRadius: 8,
            color: "#fbbf24",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Voting is currently <code style={{ color: "#fde68a" }}>{status}</code> — you cannot cast a vote.
        </div>
      </div>
    );
  }

  const success = result && result.ok ? result : null;

  return (
    <div style={{ padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: 18 }}>
      <style>{spinnerCss}</style>
      <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, marginBottom: 12 }}>Cast your vote</h3>

      {success ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "12px 14px",
            background: "#34d39922",
            border: "1px solid #34d39955",
            borderRadius: 8,
            color: "#34d399",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            Vote recorded · id=<code style={{ color: "#d1fae5" }}>{shortId(success.voteId)}</code>
          </div>
          <div style={{ color: "#a7f3d0", fontSize: 12, marginBottom: 8 }}>
            Choice: <code style={{ color: "#ecfdf5", fontWeight: 700 }}>{success.choice}</code>
          </div>
          <a
            href={`/qchaingov/proposals/${proposalId}`}
            style={{ color: "#34d399", textDecoration: "underline", fontSize: 12, fontWeight: 700 }}
          >
            Reload tally
          </a>
        </div>
      ) : (
        <form onSubmit={submit} aria-label="Cast vote form">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>Your choice</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="radiogroup" aria-label="Vote options">
              {options.map((opt) => {
                const selected = choice === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setChoice(opt)}
                    style={{
                      padding: "6px 14px",
                      minHeight: 32,
                      background: selected ? "#34d39922" : "#0f172a",
                      border: `1px solid ${selected ? "#34d399" : "#334155"}`,
                      color: selected ? "#34d399" : "#e5e7eb",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 120ms",
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {showWeight && (
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="vf-weight" style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>
                Voting weight
              </label>
              <input
                id="vf-weight"
                type="number"
                min={1}
                max={1000000}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="1"
                style={{
                  width: 120,
                  padding: "6px 10px",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#e5e7eb",
                  fontSize: 13,
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="vf-rationale" style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 700 }}>
              Why? (optional, public on the vote list)
            </label>
            <textarea
              id="vf-rationale"
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              maxLength={1100}
              aria-describedby="vf-rationale-counter"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 10px",
                background: "#0f172a",
                border: `1px solid ${overLimit ? "#ef4444" : "#334155"}`,
                borderRadius: 8,
                color: "#e5e7eb",
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />
            {rationaleLen > 0 && (
              <div
                id="vf-rationale-counter"
                style={{ fontSize: 11, color: overLimit ? "#ef4444" : "#64748b", marginTop: 4, textAlign: "right" }}
              >
                {rationaleLen} / 1000
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!choice || submitting || overLimit}
            aria-busy={submitting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              background: !choice || submitting || overLimit ? "#334155" : "#34d399",
              color: !choice || submitting || overLimit ? "#94a3b8" : "#0f172a",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              cursor: !choice || submitting || overLimit ? "not-allowed" : "pointer",
              transition: "all 120ms",
            }}
          >
            {submitting && (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  border: "2px solid #94a3b8",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "vf-spin 0.8s linear infinite",
                }}
              />
            )}
            {submitting ? "Casting…" : "Cast vote"}
          </button>

          {result && !result.ok && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background:
                  result.kind === "already" || result.kind === "closed"
                    ? "#fbbf2422"
                    : result.kind === "auth"
                    ? "#3b82f622"
                    : "#ef444422",
                border: `1px solid ${
                  result.kind === "already" || result.kind === "closed"
                    ? "#fbbf2455"
                    : result.kind === "auth"
                    ? "#3b82f655"
                    : "#ef444455"
                }`,
                borderRadius: 8,
                color:
                  result.kind === "already" || result.kind === "closed"
                    ? "#fbbf24"
                    : result.kind === "auth"
                    ? "#60a5fa"
                    : "#ef4444",
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              <div>{result.message}</div>
              {result.kind === "auth" && (
                <a
                  href={`/auth?next=${encodeURIComponent(`/qchaingov/proposals/${proposalId}`)}`}
                  style={{ display: "inline-block", marginTop: 6, color: "#60a5fa", textDecoration: "underline", fontWeight: 700 }}
                >
                  Sign in →
                </a>
              )}
              {result.kind === "invalid" && result.allowed && result.allowed.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <span style={{ color: "#cbd5e1" }}>Allowed:</span>
                  {result.allowed.map((a) => (
                    <code key={a} style={{ padding: "2px 8px", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, color: "#e5e7eb", fontSize: 11 }}>
                      {a}
                    </code>
                  ))}
                </div>
              )}
              {result.kind === "network" && (
                <div style={{ marginTop: 4, color: "#fca5a5", fontSize: 11, fontWeight: 500 }}>
                  Check your connection and retry.
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
