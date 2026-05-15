"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

/* ----------------------------- types ----------------------------- */

interface CatalogItem {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  status?: string;
  tags?: string[];
}

interface CatalogResponse {
  items?: CatalogItem[];
}

interface SearchHit {
  item: CatalogItem;
  score: number;
}

/* ----------------------------- constants ----------------------------- */

const TEAL = "#0d9488";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const HIGHLIGHT_BG = "#fef3c7";
const MIN_QUERY = 2;
const DEBOUNCE_MS = 200;

const STATUS_COLOR: Record<string, string> = {
  launched: GREEN,
  mvp: TEAL,
  in_progress: AMBER,
  research: "#8b5cf6",
  planning: "#6366f1",
  idea: MUTED,
};

/* ----------------------------- search algorithm (mirrors SDK v0.5) ----------------------------- */

function score(item: CatalogItem, q: string): number {
  const ql = q.toLowerCase();
  const name = (item.name ?? "").toLowerCase();
  const code = (item.code ?? "").toLowerCase();
  const tags = (item.tags ?? []).map((t) => t.toLowerCase());
  const desc = (item.description ?? "").toLowerCase();
  let s = 0;
  if (name.includes(ql)) s += name === ql ? 100 : name.startsWith(ql) ? 50 : 30;
  if (code.includes(ql)) s += code === ql ? 80 : 25;
  if (tags.some((t) => t.includes(ql))) s += 15;
  if (desc.includes(ql)) s += 5;
  return s;
}

function scoreColor(s: number): string {
  if (s >= 100) return GREEN;
  if (s >= 50) return AMBER;
  return MUTED;
}

/* ----------------------------- helpers ----------------------------- */

function topTagsOf(items: CatalogItem[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    for (const t of it.tags ?? []) {
      const key = t.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}

function preview(desc: string | undefined, len: number): string {
  if (!desc) return "";
  if (desc.length <= len) return desc;
  return desc.slice(0, len).trimEnd() + "…";
}

/** Render a string with all case-insensitive matches of `q` wrapped in <mark>. */
function highlight(text: string, q: string, keyPrefix: string): React.ReactNode {
  if (!q || q.length < MIN_QUERY) return text;
  const ql = q.toLowerCase();
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let idx = 0;
  while (i < text.length) {
    const next = lower.indexOf(ql, i);
    if (next === -1) {
      out.push(<span key={`${keyPrefix}-t-${idx++}`}>{text.slice(i)}</span>);
      break;
    }
    if (next > i) {
      out.push(<span key={`${keyPrefix}-t-${idx++}`}>{text.slice(i, next)}</span>);
    }
    out.push(
      <mark
        key={`${keyPrefix}-m-${idx++}`}
        style={{ background: HIGHLIGHT_BG, color: TEXT, padding: "0 1px", borderRadius: 2 }}
      >
        {text.slice(next, next + ql.length)}
      </mark>,
    );
    i = next + ql.length;
  }
  return <>{out}</>;
}

/* ----------------------------- subcomponents ----------------------------- */

function CopyCard({
  label,
  body,
  copied,
  onCopy,
  copyKey,
}: {
  label: string;
  body: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  copyKey: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid rgba(13,148,136,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            color: "#94a3b8",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={() => onCopy(body, copyKey)}
          style={{
            marginLeft: "auto",
            padding: "3px 10px",
            borderRadius: 6,
            background: copied === copyKey ? GREEN : "rgba(255,255,255,0.08)",
            color: copied === copyKey ? "#0f172a" : "#e2e8f0",
            border: "none",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          {copied === copyKey ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          lineHeight: 1.5,
        }}
      >
        {body}
      </pre>
    </div>
  );
}

function ScorePill({ s }: { s: number }) {
  const c = scoreColor(s);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 38,
        padding: "3px 8px",
        borderRadius: 6,
        background: `${c}18`,
        color: c,
        fontSize: 11,
        fontWeight: 800,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
      title={`Relevance score: ${s}`}
    >
      {s}
    </span>
  );
}

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  const c = STATUS_COLOR[status] ?? MUTED;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: c,
        fontWeight: 700,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: c,
        }}
      />
      {status}
    </span>
  );
}

function TagChip({ tag, matched, q }: { tag: string; matched: boolean; q: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        background: matched ? `${TEAL}1a` : "rgba(15,23,42,0.06)",
        color: matched ? TEAL : "#475569",
        border: matched ? `1px solid ${TEAL}50` : "1px solid transparent",
        whiteSpace: "nowrap",
      }}
    >
      {highlight(tag, q, `tag-${tag}`)}
    </span>
  );
}

/* ----------------------------- page ----------------------------- */

export default function SearchExplorerPage() {
  const [query, setQuery] = useState<string>("");
  const [debounced, setDebounced] = useState<string>("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiBase = getApiBase();

  // Autofocus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch catalog once
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetch(apiUrl("/api/aevion/catalog?fields=id,code,name,description,status,tags"))
      .then(async (r) => {
        const text = await r.text();
        if (cancelled) return;
        if (!r.ok) {
          setLoadState("err");
          setErrorMsg(`HTTP ${r.status}`);
          return;
        }
        try {
          const parsed = JSON.parse(text) as CatalogResponse | CatalogItem[];
          const arr: CatalogItem[] = Array.isArray(parsed) ? parsed : parsed.items ?? [];
          setItems(arr);
          setLoadState("ok");
        } catch (e: unknown) {
          setLoadState("err");
          setErrorMsg(e instanceof Error ? e.message : "parse error");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadState("err");
        setErrorMsg(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Compute hits
  const hits: SearchHit[] = useMemo(() => {
    const q = debounced.trim();
    if (q.length < MIN_QUERY) return [];
    const out: SearchHit[] = [];
    for (const it of items) {
      const s = score(it, q);
      if (s > 0) out.push({ item: it, score: s });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }, [debounced, items]);

  const tags6 = useMemo(() => topTagsOf(items, 6), [items]);

  const showResults = debounced.trim().length >= MIN_QUERY;
  const noResults = showResults && hits.length === 0 && loadState === "ok";

  const previewQ = debounced.trim() || "ai";
  const sdkSnippet = `import { AevionCatalog } from "@aevion/catalog-client";
const cat = new AevionCatalog();
const hits = await cat.findByText(${JSON.stringify(previewQ)});
// → [{ item, score }, ...] sorted by score desc`;
  const endpointUrl = `${apiBase}/api/aevion/catalog?fields=id,code,name,description,status,tags`;
  const jqSnippet = `curl -s '${endpointUrl}' \\
  | jq -r --arg q '${previewQ}' '.items[] | select((.name // "") | ascii_downcase | contains($q | ascii_downcase)) | "\\(.id)\\t\\(.name)"'`;

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: TEXT }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <Link
            href="/api-explorer"
            style={{ fontSize: 12, color: MUTED, textDecoration: "none" }}
          >
            ← API explorer
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            Module search
          </h1>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Live text search across the AEVION catalog. Mirrors the SDK&apos;s{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              cat.findByText()
            </code>{" "}
            scoring — name &gt; code &gt; tags &gt; description. The catalog loads once; filtering
            runs entirely in the browser.
          </p>
        </div>

        {/* Search input */}
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
          }}
        >
          <label
            htmlFor="search-input"
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 800,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Query
          </label>
          <input
            ref={inputRef}
            id="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ai, security, qsign, payment..."
            autoComplete="off"
            spellCheck={false}
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: 18,
              fontWeight: 600,
              fontFamily:
                "ui-monospace, SFMono-Regular, monospace",
              border: `1px solid rgba(15,23,42,0.16)`,
              borderRadius: 10,
              background: "#f8fafc",
              color: TEXT,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              fontSize: 12,
              color: MUTED,
            }}
          >
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                background: showResults ? `${TEAL}1a` : "rgba(15,23,42,0.06)",
                color: showResults ? TEAL : MUTED,
                fontWeight: 800,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              {loadState === "loading"
                ? "loading catalog…"
                : loadState === "err"
                  ? `error: ${errorMsg}`
                  : showResults
                    ? `${hits.length} of ${items.length} modules`
                    : `${items.length} modules indexed`}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              min query length: {MIN_QUERY} · 200ms debounce · client-side scoring
            </span>
          </div>
        </div>

        {/* Empty state — quick tags */}
        {!showResults && loadState === "ok" && tags6.length > 0 && (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              Quick search — top tags
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tags6.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setQuery(t);
                    inputRef.current?.focus();
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    border: `1px solid ${TEAL}40`,
                    background: `${TEAL}10`,
                    color: TEAL,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
              Click a tag to populate the search, or type at least {MIN_QUERY} characters to filter
              live.
            </div>
          </div>
        )}

        {/* No-results state */}
        {noResults && (
          <div
            style={{
              padding: "32px 18px",
              borderRadius: 12,
              background: "#fff",
              border: "1px dashed rgba(15,23,42,0.16)",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 14, color: TEXT, fontWeight: 700, marginBottom: 6 }}>
              No modules match{" "}
              <code
                style={{
                  background: "rgba(15,23,42,0.06)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {debounced.trim()}
              </code>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
              Try a broader term — for example a single word, partial tag, or product family
              (&quot;ai&quot;, &quot;sign&quot;, &quot;pay&quot;).
            </div>
          </div>
        )}

        {/* Error state */}
        {loadState === "err" && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "#fff",
              border: `1px solid ${RED}40`,
              marginBottom: 14,
              fontSize: 13,
              color: RED,
              fontWeight: 700,
            }}
          >
            Failed to load catalog: <code>{errorMsg}</code>
          </div>
        )}

        {/* Results list */}
        {showResults && hits.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            {hits.map((hit) => {
              const it = hit.item;
              const q = debounced.trim();
              const ql = q.toLowerCase();
              const tags = it.tags ?? [];
              return (
                <div
                  key={it.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "#fff",
                    border: "1px solid rgba(15,23,42,0.08)",
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "start",
                  }}
                >
                  <div style={{ paddingTop: 2 }}>
                    <ScorePill s={hit.score} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: TEXT,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {highlight(it.name ?? it.id, q, `name-${it.id}`)}
                      </span>
                      {it.code && (
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "ui-monospace, SFMono-Regular, monospace",
                            color: MUTED,
                            fontWeight: 600,
                          }}
                        >
                          {highlight(it.code, q, `code-${it.id}`)}
                        </span>
                      )}
                    </div>
                    {tags.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 5,
                          flexWrap: "wrap",
                        }}
                      >
                        {tags.map((t) => (
                          <TagChip
                            key={`${it.id}-${t}`}
                            tag={t}
                            matched={t.toLowerCase().includes(ql)}
                            q={q}
                          />
                        ))}
                      </div>
                    )}
                    {it.description && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12.5,
                          color: "#475569",
                          lineHeight: 1.5,
                        }}
                      >
                        {highlight(preview(it.description, 100), q, `desc-${it.id}`)}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <StatusBadge status={it.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Snippets */}
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <CopyCard
            label="SDK call"
            body={sdkSnippet}
            copied={copied}
            onCopy={copy}
            copyKey="sdk"
          />
          <CopyCard
            label="Equivalent endpoint"
            body={endpointUrl}
            copied={copied}
            onCopy={copy}
            copyKey="endpoint"
          />
          <CopyCard
            label="jq — grep by name"
            body={jqSnippet}
            copied={copied}
            onCopy={copy}
            copyKey="jq"
          />
        </div>

        {/* Tip */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: TEAL,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Scoring breakdown
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
            <strong>name</strong> match: exact = 100, prefix = 50, contains = 30.{" "}
            <strong>code</strong> match: exact = 80, contains = 25. <strong>tag</strong> contains =
            15. <strong>description</strong> contains = 5. Scores accumulate per item; results are
            sorted descending. The pill on each row shows the total — <span style={{ color: GREEN, fontWeight: 800 }}>green</span> for ≥ 100, <span style={{ color: AMBER, fontWeight: 800 }}>amber</span> for ≥ 50, gray below.
          </div>
        </div>

        {/* Footer crosslinks */}
        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: "#94a3b8",
            lineHeight: 1.8,
          }}
        >
          API explorer family:{" "}
          <Link href="/api-explorer/catalog" style={{ color: TEAL }}>
            Catalog
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/sdk" style={{ color: TEAL }}>
            SDK playground
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/openapi" style={{ color: TEAL }}>
            OpenAPI
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/health" style={{ color: TEAL }}>
            Health
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/version" style={{ color: TEAL }}>
            Version
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/sitemap" style={{ color: TEAL }}>
            Sitemap
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/badges" style={{ color: TEAL }}>
            Badges
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/graph" style={{ color: TEAL }}>
            Graph
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/diff" style={{ color: TEAL }}>
            Diff
          </Link>
        </div>
      </div>
    </main>
  );
}
