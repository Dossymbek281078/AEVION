"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

/* ----------------------------- types ----------------------------- */

interface ListItem {
  id: string;
  name: string;
  status: string;
}

interface CatalogItem {
  id: string;
  code?: string;
  name: string;
  status: string;
  kind?: string;
  priority?: number;
  tags: string[];
}

interface DiffResult {
  shared: string[];
  onlyA: string[];
  onlyB: string[];
  jaccard: number;
  statusEqual: boolean;
  kindEqual: boolean;
  priorityEqual: boolean;
}

/* ----------------------------- constants ----------------------------- */

const TEAL = "#0d9488";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const VIOLET = "#8b5cf6";

const STATUS_COLORS: Record<string, string> = {
  launched: GREEN,
  mvp: GREEN,
  in_progress: AMBER,
  research: VIOLET,
  planning: "#3b82f6",
  idea: "#94a3b8",
};

const DEFAULT_A = "qsign";
const DEFAULT_B = "qright";

/* ----------------------------- helpers ----------------------------- */

function statusColor(status: string): string {
  return STATUS_COLORS[status] || "#64748b";
}

function pickInitialId(items: ListItem[], preferred: string, fallbackIndex: number): string {
  if (!items.length) return "";
  // Try exact id match first
  const exact = items.find((it) => it.id === preferred);
  if (exact) return exact.id;
  // Then case-insensitive substring (e.g. "qsign" matches "qsign-v2")
  const fuzzy = items.find((it) => it.id.toLowerCase().includes(preferred.toLowerCase()));
  if (fuzzy) return fuzzy.id;
  // Fallback: nth item
  return items[Math.min(fallbackIndex, items.length - 1)].id;
}

function computeDiff(a: CatalogItem | null, b: CatalogItem | null): DiffResult {
  const aTags = new Set(a?.tags ?? []);
  const bTags = new Set(b?.tags ?? []);
  const shared = [...aTags].filter((t) => bTags.has(t));
  const onlyA = [...aTags].filter((t) => !bTags.has(t));
  const onlyB = [...bTags].filter((t) => !aTags.has(t));
  const union = aTags.size + bTags.size - shared.length;
  const jaccard = union > 0 ? shared.length / union : 0;
  return {
    shared,
    onlyA,
    onlyB,
    jaccard,
    statusEqual: !!a && !!b && a.status === b.status,
    kindEqual: !!a && !!b && (a.kind ?? "") === (b.kind ?? ""),
    priorityEqual:
      !!a && !!b && (a.priority ?? null) === (b.priority ?? null),
  };
}

/* ----------------------------- subcomponents ----------------------------- */

function StatusPill({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: `${c}18`,
        color: c,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status || "—"}
    </span>
  );
}

function TagChip({
  label,
  variant,
}: {
  label: string;
  variant: "shared" | "onlyA" | "onlyB";
}) {
  const palette = {
    shared: { bg: "rgba(16,185,129,0.12)", fg: GREEN, border: "rgba(16,185,129,0.35)" },
    onlyA: { bg: "rgba(245,158,11,0.12)", fg: AMBER, border: "rgba(245,158,11,0.35)" },
    onlyB: { bg: "rgba(139,92,246,0.12)", fg: VIOLET, border: "rgba(139,92,246,0.35)" },
  }[variant];
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      {label}
    </span>
  );
}

function CardTagChip({ label, isShared }: { label: string; isShared: boolean }) {
  const bg = isShared ? "rgba(16,185,129,0.12)" : "rgba(15,23,42,0.05)";
  const fg = isShared ? GREEN : "#475569";
  const border = isShared ? "rgba(16,185,129,0.35)" : "rgba(15,23,42,0.12)";
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      {label}
    </span>
  );
}

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

function ModuleCard({
  module: m,
  side,
  sharedTags,
}: {
  module: CatalogItem | null;
  side: "A" | "B";
  sharedTags: Set<string>;
}) {
  const accent = side === "A" ? AMBER : VIOLET;
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        position: "relative",
        minHeight: 240,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          padding: "2px 8px",
          borderRadius: 6,
          background: `${accent}18`,
          color: accent,
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        {side === "A" ? "Module A" : "Module B"}
      </div>

      {!m ? (
        <div
          style={{
            padding: "32px 0",
            color: "#94a3b8",
            fontSize: 12.5,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          // loading…
        </div>
      ) : (
        <>
          <div style={{ fontSize: 22, fontWeight: 900, color: TEXT, marginBottom: 2, paddingRight: 80 }}>
            {m.name}
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 12,
              color: MUTED,
              marginBottom: 12,
            }}
          >
            {m.code || m.id}
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "auto 1fr",
              fontSize: 12,
              marginBottom: 14,
              alignItems: "center",
            }}
          >
            <div style={{ color: MUTED, fontWeight: 700 }}>status</div>
            <div>
              <StatusPill status={m.status} />
            </div>
            <div style={{ color: MUTED, fontWeight: 700 }}>kind</div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                color: TEXT,
                fontWeight: 600,
              }}
            >
              {m.kind || "—"}
            </div>
            <div style={{ color: MUTED, fontWeight: 700 }}>priority</div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                color: TEXT,
                fontWeight: 600,
              }}
            >
              {typeof m.priority === "number" ? m.priority : "—"}
            </div>
          </div>

          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Tags ({m.tags.length})
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {m.tags.length === 0 ? (
              <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                (no tags)
              </span>
            ) : (
              m.tags.map((t) => (
                <CardTagChip key={t} label={t} isShared={sharedTags.has(t)} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DiffRow({
  label,
  equal,
  valueA,
  valueB,
}: {
  label: string;
  equal: boolean;
  valueA: string;
  valueB: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 24px 1fr 1fr",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 8,
        background: equal ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)",
        border: `1px solid ${equal ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"}`,
        fontSize: 12.5,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        aria-hidden
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: equal ? GREEN : RED,
          textAlign: "center",
        }}
      >
        {equal ? "✓" : "✕"}
      </div>
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          color: TEXT,
          fontWeight: 600,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: AMBER, fontWeight: 800, marginRight: 6 }}>A:</span>
        {valueA || "—"}
      </div>
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          color: TEXT,
          fontWeight: 600,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: VIOLET, fontWeight: 800, marginRight: 6 }}>B:</span>
        {valueB || "—"}
      </div>
    </div>
  );
}

/* ----------------------------- page ----------------------------- */

export default function DiffExplorerPage() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");
  const [mA, setMA] = useState<CatalogItem | null>(null);
  const [mB, setMB] = useState<CatalogItem | null>(null);
  const [searchA, setSearchA] = useState<string>("");
  const [searchB, setSearchB] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const apiBase = getApiBase();

  // Fetch catalog list once for dropdowns
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    fetch(apiUrl("/api/aevion/catalog?fields=id,name,status"))
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json: unknown = await r.json();
        if (cancelled) return;
        if (
          json &&
          typeof json === "object" &&
          Array.isArray((json as { items?: unknown }).items)
        ) {
          const raw = (json as { items: unknown[] }).items;
          const parsed: ListItem[] = raw
            .filter(
              (it): it is Record<string, unknown> =>
                typeof it === "object" && it !== null,
            )
            .map((it) => ({
              id: typeof it.id === "string" ? it.id : "",
              name:
                typeof it.name === "string"
                  ? it.name
                  : typeof it.id === "string"
                    ? it.id
                    : "",
              status: typeof it.status === "string" ? it.status : "idea",
            }))
            .filter((x) => x.id);
          parsed.sort((a, b) => a.id.localeCompare(b.id));
          setItems(parsed);
          setListError(null);
          // Pick sensible defaults
          if (parsed.length) {
            setIdA((prev) => prev || pickInitialId(parsed, DEFAULT_A, 0));
            setIdB((prev) => prev || pickInitialId(parsed, DEFAULT_B, 1));
          }
        } else {
          setItems([]);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setItems([]);
          setListError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch module A on idA change
  useEffect(() => {
    if (!idA) {
      setMA(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/aevion/catalog/${encodeURIComponent(idA)}`))
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json: unknown = await r.json();
        if (cancelled) return;
        if (json && typeof json === "object") {
          const it = json as Record<string, unknown>;
          setMA({
            id: typeof it.id === "string" ? it.id : idA,
            code: typeof it.code === "string" ? it.code : undefined,
            name:
              typeof it.name === "string"
                ? it.name
                : typeof it.id === "string"
                  ? it.id
                  : idA,
            status: typeof it.status === "string" ? it.status : "idea",
            kind: typeof it.kind === "string" ? it.kind : undefined,
            priority: typeof it.priority === "number" ? it.priority : undefined,
            tags: Array.isArray(it.tags)
              ? it.tags.filter((t): t is string => typeof t === "string")
              : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setMA(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idA]);

  // Fetch module B on idB change
  useEffect(() => {
    if (!idB) {
      setMB(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/aevion/catalog/${encodeURIComponent(idB)}`))
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json: unknown = await r.json();
        if (cancelled) return;
        if (json && typeof json === "object") {
          const it = json as Record<string, unknown>;
          setMB({
            id: typeof it.id === "string" ? it.id : idB,
            code: typeof it.code === "string" ? it.code : undefined,
            name:
              typeof it.name === "string"
                ? it.name
                : typeof it.id === "string"
                  ? it.id
                  : idB,
            status: typeof it.status === "string" ? it.status : "idea",
            kind: typeof it.kind === "string" ? it.kind : undefined,
            priority: typeof it.priority === "number" ? it.priority : undefined,
            tags: Array.isArray(it.tags)
              ? it.tags.filter((t): t is string => typeof t === "string")
              : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setMB(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idB]);

  const filteredA = useMemo(() => {
    const q = searchA.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.id.toLowerCase().includes(q) || it.name.toLowerCase().includes(q),
    );
  }, [items, searchA]);

  const filteredB = useMemo(() => {
    const q = searchB.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.id.toLowerCase().includes(q) || it.name.toLowerCase().includes(q),
    );
  }, [items, searchB]);

  const diff = useMemo(() => computeDiff(mA, mB), [mA, mB]);
  const sharedTagsSet = useMemo(() => new Set(diff.shared), [diff.shared]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // Snippets
  const sdkSnippet = `import { AevionCatalog } from "@aevion/catalog-client";
const cat = new AevionCatalog();
const diff = await cat.diff("${idA || "qsign"}", "${idB || "qright"}");
// { shared, onlyA, onlyB, jaccard, statusEqual, kindEqual, priorityEqual }`;

  const urlA = `${apiBase}/api/aevion/catalog/${encodeURIComponent(idA || "qsign")}`;
  const urlB = `${apiBase}/api/aevion/catalog/${encodeURIComponent(idB || "qright")}`;
  const urlsSnippet = `# Module A\n${urlA}\n\n# Module B\n${urlB}`;
  const curlSnippet = `curl -s '${urlA}' | jq .\ncurl -s '${urlB}' | jq .`;

  const swapModules = () => {
    setIdA(idB);
    setIdB(idA);
    setSearchA("");
    setSearchB("");
  };

  const jaccardColor =
    diff.jaccard >= 0.6 ? GREEN : diff.jaccard >= 0.3 ? AMBER : "#94a3b8";

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: TEXT }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/api-explorer"
            style={{ fontSize: 12, color: MUTED, textDecoration: "none" }}
          >
            ← API explorer
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            Module diff
          </h1>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6, maxWidth: 760 }}>
            Side-by-side comparison of any two AEVION modules — tags, status, kind, priority — with
            a Jaccard similarity score. Mirrors{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              cat.diff(a, b)
            </code>{" "}
            in <code>@aevion/catalog-client</code> v0.5, computed entirely client-side from two{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              GET /api/aevion/catalog/:id
            </code>{" "}
            calls.
          </p>
        </div>

        {/* Selection bar */}
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
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 12,
              alignItems: "end",
            }}
          >
            {/* A column */}
            <div style={{ minWidth: 0 }}>
              <label
                htmlFor="search-a"
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 800,
                  color: AMBER,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Module A
              </label>
              <input
                id="search-a"
                type="text"
                value={searchA}
                onChange={(e) => setSearchA(e.target.value)}
                placeholder="Filter by id or name…"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 12.5,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  border: "1px solid rgba(15,23,42,0.16)",
                  borderRadius: 8,
                  outline: "none",
                  background: "#f8fafc",
                  color: TEXT,
                  marginBottom: 6,
                  boxSizing: "border-box",
                }}
              />
              <select
                aria-label="Module A"
                value={idA}
                onChange={(e) => setIdA(e.target.value)}
                disabled={!items.length}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  border: `1px solid ${AMBER}50`,
                  borderRadius: 8,
                  background: "#f8fafc",
                  color: TEXT,
                  outline: "none",
                  cursor: items.length ? "pointer" : "not-allowed",
                  boxSizing: "border-box",
                }}
              >
                {filteredA.length === 0 && <option value="">(no match)</option>}
                {filteredA.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.id} — {it.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap button */}
            <div style={{ paddingBottom: 4 }}>
              <button
                type="button"
                onClick={swapModules}
                title="Swap A ↔ B"
                aria-label="Swap modules"
                disabled={!idA || !idB}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(15,23,42,0.16)",
                  cursor: !idA || !idB ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 800,
                  color: MUTED,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                ⇄
              </button>
            </div>

            {/* B column */}
            <div style={{ minWidth: 0 }}>
              <label
                htmlFor="search-b"
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 800,
                  color: VIOLET,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Module B
              </label>
              <input
                id="search-b"
                type="text"
                value={searchB}
                onChange={(e) => setSearchB(e.target.value)}
                placeholder="Filter by id or name…"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 12.5,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  border: "1px solid rgba(15,23,42,0.16)",
                  borderRadius: 8,
                  outline: "none",
                  background: "#f8fafc",
                  color: TEXT,
                  marginBottom: 6,
                  boxSizing: "border-box",
                }}
              />
              <select
                aria-label="Module B"
                value={idB}
                onChange={(e) => setIdB(e.target.value)}
                disabled={!items.length}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  border: `1px solid ${VIOLET}50`,
                  borderRadius: 8,
                  background: "#f8fafc",
                  color: TEXT,
                  outline: "none",
                  cursor: items.length ? "pointer" : "not-allowed",
                  boxSizing: "border-box",
                }}
              >
                {filteredB.length === 0 && <option value="">(no match)</option>}
                {filteredB.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.id} — {it.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {listLoading && (
            <div style={{ marginTop: 10, fontSize: 11, color: TEAL }}>loading catalog…</div>
          )}
          {listError && (
            <div style={{ marginTop: 10, fontSize: 11, color: RED }}>
              error loading catalog: {listError}
            </div>
          )}
        </div>

        {/* Status banner */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 13,
            color: MUTED,
          }}
        >
          <span>
            Comparing{" "}
            <strong style={{ color: AMBER, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
              {mA?.id || idA || "—"}
            </strong>{" "}
            vs{" "}
            <strong style={{ color: VIOLET, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
              {mB?.id || idB || "—"}
            </strong>
          </span>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: `${jaccardColor}18`,
              color: jaccardColor,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            Jaccard {diff.jaccard.toFixed(3)}
          </span>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: "rgba(13,148,136,0.12)",
              color: TEAL,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {diff.shared.length} shared tag{diff.shared.length === 1 ? "" : "s"}
          </span>
          {loading && <span style={{ color: TEAL }}>loading…</span>}
        </div>

        {/* Side-by-side cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <ModuleCard module={mA} side="A" sharedTags={sharedTagsSet} />
          <ModuleCard module={mB} side="B" sharedTags={sharedTagsSet} />
        </div>

        {/* Differences */}
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
              fontSize: 11,
              fontWeight: 800,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 10,
            }}
          >
            Field comparison
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <DiffRow
              label="status"
              equal={diff.statusEqual}
              valueA={mA?.status ?? ""}
              valueB={mB?.status ?? ""}
            />
            <DiffRow
              label="kind"
              equal={diff.kindEqual}
              valueA={mA?.kind ?? ""}
              valueB={mB?.kind ?? ""}
            />
            <DiffRow
              label="priority"
              equal={diff.priorityEqual}
              valueA={
                typeof mA?.priority === "number" ? String(mA.priority) : ""
              }
              valueB={
                typeof mB?.priority === "number" ? String(mB.priority) : ""
              }
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 1fr 1fr",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(13,148,136,0.05)",
                border: "1px solid rgba(13,148,136,0.18)",
                fontSize: 12.5,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: MUTED,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                tags
              </div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: TEXT }}>
                <span style={{ color: GREEN, fontWeight: 800, marginRight: 6 }}>shared:</span>
                {diff.shared.length}
              </div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: TEXT }}>
                <span style={{ color: AMBER, fontWeight: 800, marginRight: 6 }}>only A:</span>
                {diff.onlyA.length}
              </div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: TEXT }}>
                <span style={{ color: VIOLET, fontWeight: 800, marginRight: 6 }}>only B:</span>
                {diff.onlyB.length}
              </div>
            </div>
          </div>
        </div>

        {/* Tag breakdown */}
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: GREEN,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Shared tags ({diff.shared.length})
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {diff.shared.length === 0 ? (
                <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                  (none — no tag overlap)
                </span>
              ) : (
                diff.shared.map((t) => <TagChip key={t} label={t} variant="shared" />)
              )}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: AMBER,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Only in A ({diff.onlyA.length})
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {diff.onlyA.length === 0 ? (
                <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                  (none)
                </span>
              ) : (
                diff.onlyA.map((t) => <TagChip key={t} label={t} variant="onlyA" />)
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: VIOLET,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Only in B ({diff.onlyB.length})
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {diff.onlyB.length === 0 ? (
                <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>
                  (none)
                </span>
              ) : (
                diff.onlyB.map((t) => <TagChip key={t} label={t} variant="onlyB" />)
              )}
            </div>
          </div>
        </div>

        {/* Snippets */}
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <CopyCard label="SDK call" body={sdkSnippet} copied={copied} onCopy={copy} copyKey="sdk" />
          <CopyCard
            label="Source endpoints"
            body={urlsSnippet}
            copied={copied}
            onCopy={copy}
            copyKey="urls"
          />
          <CopyCard label="curl" body={curlSnippet} copied={copied} onCopy={copy} copyKey="curl" />
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
            Tip
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
            Jaccard = |A ∩ B| / |A ∪ B| — 0 means no tag overlap, 1 means identical tag sets. Two
            modules sharing 3+ tags above a 0.5 score usually belong on the same product page or
            cross-sell strip. The SDK call returns the same shape as what you see here, so it&apos;s
            safe to use the page output as a fixture in tests.
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
          <Link href="/api-explorer/catalog" style={{ color: TEAL }}>
            Catalog explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/sdk" style={{ color: TEAL }}>
            SDK playground
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/graph" style={{ color: TEAL }}>
            Module graph
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/openapi" style={{ color: TEAL }}>
            OpenAPI explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/health" style={{ color: TEAL }}>
            Health dashboard
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/version" style={{ color: TEAL }}>
            Version & SDK
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/sitemap" style={{ color: TEAL }}>
            Sitemap explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/badges" style={{ color: TEAL }}>
            Badge builder
          </Link>{" "}
          ·{" "}
          <Link href="/status" style={{ color: TEAL }}>
            Public status
          </Link>
        </div>
      </div>
    </main>
  );
}
