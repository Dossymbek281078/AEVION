"use client";

/**
 * The gate, from the reader's side.
 *
 * Signed out: names exactly what is behind it, so the offer is legible rather
 * than a wall. Signed in: fetches the same endpoint with the token and renders
 * the full report inline — the server decides, this component only asks.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";
import { ResultView, type AnalysisResult } from "../../_result";

const SECTION: React.CSSProperties = {
  border: "1px solid var(--rule-mid, #b9b8b0)", borderRadius: 12,
  padding: "18px 20px", background: "var(--card, #fffefb)", marginTop: 18,
};

export function UnlockPanel({ slug, locked }: { slug: string; locked: string[] }) {
  const [full, setFull] = useState<AnalysisResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const unlock = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setState("loading");
    try {
      const r = await fetch(apiUrl(`/api/qventure/showcase/${encodeURIComponent(slug)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j?.ok && j.unlocked && j.data) {
        setFull(j.data as AnalysisResult);
        setState("idle");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }, [slug]);

  // A signed-in reader should not have to click a gate that does not apply.
  useEffect(() => { if (getAuthToken()) void unlock(); }, [unlock]);

  if (full) {
    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink-faint, #74767c)", marginBottom: 10 }}>
          Full analysis — visible because you are signed in.
        </div>
        <ResultView result={full} shared />
      </div>
    );
  }

  return (
    <div style={{ ...SECTION, background: "var(--paper-2, #efeee8)" }}>
      <h2 style={{ fontSize: 19, margin: "0 0 6px", fontWeight: 800 }}>How this verdict was reached</h2>
      <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.6, color: "var(--ink-soft, #45474c)" }}>
        The reasoning behind the score opens with an account. What you get:
      </p>
      <ul style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--ink-soft, #45474c)" }}>
        {locked.map((l) => <li key={l}>{l}</li>)}
      </ul>
      {state === "error" && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "#b45309" }}>
          Could not load the full analysis with your session — try signing in again.
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/auth" style={{ padding: "11px 18px", borderRadius: 8, background: "var(--teal, #0a7d72)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          {state === "loading" ? "Opening…" : "Sign in to see the full analysis"}
        </Link>
        <Link href="/qventure" style={{ padding: "11px 18px", borderRadius: 8, border: "1px solid var(--rule-mid, #b9b8b0)", fontWeight: 700, textDecoration: "none", color: "inherit" }}>
          Analyse your own plan
        </Link>
      </div>
    </div>
  );
}
