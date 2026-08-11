"use client";

// Cross-module search. /api/search has queried QStore, QLearn, QNews, QEvents,
// QJobs and QRight in one call for a while, with rate limiting and a health
// endpoint — and nothing in the frontend ever called it, so the capability was
// unreachable. This page is the caller.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";

type SearchType = "qstore" | "qlearn" | "qnews" | "qevents" | "qjobs" | "qright";

type SearchResult = {
  id: string;
  type: SearchType;
  title: string;
  description: string;
  url: string;
  score: number;
};

type SearchResponse = {
  q: string;
  total: number;
  results: SearchResult[];
  byType: Partial<Record<SearchType, SearchResult[]>>;
};

// Order is fixed so results do not reshuffle between keystrokes.
const TYPE_ORDER: SearchType[] = ["qstore", "qlearn", "qnews", "qevents", "qjobs", "qright"];

const TYPE_COLOR: Record<SearchType, string> = {
  qstore: "#059669",
  qlearn: "#7c3aed",
  qnews: "#0ea5e9",
  qevents: "#f59e0b",
  qjobs: "#0d9488",
  qright: "#e11d48",
};

export default function SearchPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(async (query: string) => {
    // The backend rejects anything under two characters, so do not ask.
    if (query.trim().length < 2) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(query.trim())}&limit=5`));
      const j = await r.json();
      // A slower earlier request must not overwrite a newer answer.
      if (mine !== seq.current) return;
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setData(j as SearchResponse);
    } catch (e) {
      if (mine !== seq.current) return;
      setError((e as Error).message);
      setData(null);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void run(q), 300);
    return () => clearTimeout(id);
  }, [q, run]);

  const groups = data
    ? TYPE_ORDER.map((type) => [type, data.byType?.[type] ?? []] as const).filter(([, r]) => r.length > 0)
    : [];

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 6px", color: "#0f172a" }}>
        {t("search.title")}
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 20px" }}>{t("search.subtitle")}</p>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.title")}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 16px",
          fontSize: 16,
          borderRadius: 12,
          border: "1px solid rgba(15,23,42,0.14)",
          outline: "none",
          background: "#fff",
        }}
      />

      <div style={{ minHeight: 28, marginTop: 10, fontSize: 13, color: "#64748b" }}>
        {loading && t("search.loading")}
        {!loading && error && <span style={{ color: "#e11d48" }}>{error}</span>}
        {!loading && !error && data && t("search.found", { total: data.total })}
        {!loading && !error && !data && q.trim().length > 0 && q.trim().length < 2 && t("search.tooShort")}
        {!loading && !error && !data && q.trim().length === 0 && t("search.idle")}
      </div>

      {groups.map(([type, items]) => (
        <section key={type} style={{ marginTop: 22 }}>
          <h2
            style={{
              display: "inline-block",
              margin: 0,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#fff",
              background: TYPE_COLOR[type],
            }}
          >
            {t(`search.type.${type}`)}
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
            {items.map((r) => (
              <li
                key={`${r.type}:${r.id}`}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  background: "#fff",
                }}
              >
                {/^https?:\/\//.test(r.url) ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", textDecoration: "none" }}
                  >
                    {r.title}
                  </a>
                ) : (
                  <Link
                    href={r.url}
                    style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", textDecoration: "none" }}
                  >
                    {r.title}
                  </Link>
                )}
                {r.description && (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                    {r.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!loading && !error && data && data.total === 0 && (
        <p style={{ marginTop: 24, color: "#64748b", fontSize: 14 }}>{t("search.empty")}</p>
      )}
    </main>
  );
}
