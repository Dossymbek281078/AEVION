"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

const STATUS_OPTIONS = ["launched", "mvp", "in_progress", "research", "planning", "idea"];
const KIND_OPTIONS = ["core", "product", "service", "experiment", "infrastructure"];
const FIELD_OPTIONS = [
  "id",
  "code",
  "name",
  "description",
  "status",
  "kind",
  "priority",
  "tags",
  "frontend",
  "ogImage",
  "health",
  "openapi",
];
const FORMAT_OPTIONS = [
  { id: "json", label: "JSON", contentType: "application/json" },
  { id: "csv", label: "CSV", contentType: "text/csv" },
  { id: "md", label: "Markdown", contentType: "text/markdown" },
];

function buildQuery(opts: {
  statuses: string[];
  kinds: string[];
  tags: string[];
  fields: string[];
  format: string;
}): string {
  const p = new URLSearchParams();
  if (opts.statuses.length) p.set("status", opts.statuses.join(","));
  if (opts.kinds.length) p.set("kind", opts.kinds.join(","));
  if (opts.tags.length) p.set("tag", opts.tags.join(","));
  if (opts.fields.length) p.set("fields", opts.fields.join(","));
  if (opts.format !== "json") p.set("format", opts.format);
  const q = p.toString();
  return q ? `?${q}` : "";
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        border: `1px solid ${active ? "#0d9488" : "rgba(15,23,42,0.16)"}`,
        background: active ? "#0d9488" : "#fff",
        color: active ? "#fff" : "#475569",
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function CatalogExplorerPage() {
  const [statuses, setStatuses] = useState<string[]>(["mvp", "launched"]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [format, setFormat] = useState<string>("json");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [response, setResponse] = useState<string>("");
  const [responseMeta, setResponseMeta] = useState<{ status: number; ms: number; bytes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const query = useMemo(
    () => buildQuery({ statuses, kinds, tags, fields, format }),
    [statuses, kinds, tags, fields, format],
  );

  const apiBase = getApiBase();
  const fullUrl = `${apiBase}/api/aevion/catalog${query}`;
  const curl = `curl -s '${fullUrl}'${format === "json" ? " | jq ." : ""}`;
  const sdk = `import { AevionCatalog } from "@aevion/catalog-client";
const cat = new AevionCatalog();
const { items } = await cat.list({${
    statuses.length ? `\n  status: [${statuses.map((s) => `"${s}"`).join(", ")}],` : ""
  }${kinds.length ? `\n  kind: [${kinds.map((s) => `"${s}"`).join(", ")}],` : ""}${
    tags.length ? `\n  tag: [${tags.map((s) => `"${s}"`).join(", ")}],` : ""
  }${fields.length ? `\n  fields: [${fields.map((s) => `"${s}"`).join(", ")}],` : ""}${
    statuses.length || kinds.length || tags.length || fields.length ? "\n" : ""
  }});`;

  // Load top-20 tags once
  useEffect(() => {
    fetch(apiUrl("/api/aevion/registry-stats"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { byTag?: { tag: string; count: number }[] } | null) => {
        if (j?.byTag) setAllTags(j.byTag.slice(0, 20).map((t) => t.tag));
      })
      .catch(() => {});
  }, []);

  // Re-fetch response on query change
  useEffect(() => {
    let cancelled = false;
    const url = apiUrl(`/api/aevion/catalog${query}`);
    const t0 = performance.now();
    setLoading(true);
    fetch(url)
      .then(async (r) => {
        const text = await r.text();
        if (cancelled) return;
        const ms = Math.round(performance.now() - t0);
        setResponse(text);
        setResponseMeta({ status: r.status, ms, bytes: new Blob([text]).size });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResponse(`Error: ${e instanceof Error ? e.message : String(e)}`);
          setResponseMeta(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/developers" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← Developers
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            Catalog API explorer
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 700 }}>
            Build a query against{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              GET /api/aevion/catalog
            </code>{" "}
            by clicking filters. Response updates live. Copy the URL, curl command or SDK snippet.
          </p>
        </div>

        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 360px) 1fr" }}>
          <aside
            style={{
              padding: 18,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              height: "fit-content",
              position: "sticky",
              top: 18,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Status
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {STATUS_OPTIONS.map((s) => (
                <Chip key={s} label={s} active={statuses.includes(s)} onClick={() => setStatuses(toggle(statuses, s))} />
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Kind
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {KIND_OPTIONS.map((k) => (
                <Chip key={k} label={k} active={kinds.includes(k)} onClick={() => setKinds(toggle(kinds, k))} />
              ))}
            </div>

            {allTags.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                  Tag (top 20)
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {allTags.map((t) => (
                    <Chip key={t} label={t} active={tags.includes(t)} onClick={() => setTags(toggle(tags, t))} />
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Fields (projection)
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {FIELD_OPTIONS.map((f) => (
                <Chip key={f} label={f} active={fields.includes(f)} onClick={() => setFields(toggle(fields, f))} />
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Format
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {FORMAT_OPTIONS.map((f) => (
                <Chip key={f.id} label={f.label} active={format === f.id} onClick={() => setFormat(f.id)} />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setStatuses([]);
                setKinds([]);
                setTags([]);
                setFields([]);
                setFormat("json");
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(15,23,42,0.16)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginTop: 6,
              }}
            >
              Clear all filters
            </button>
          </aside>

          <section style={{ minWidth: 0 }}>
            {/* Snippets */}
            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              {[
                { label: "URL", body: fullUrl, key: "url" },
                { label: "curl", body: curl, key: "curl" },
                { label: "@aevion/catalog-client", body: sdk, key: "sdk" },
              ].map((s) => (
                <div
                  key={s.key}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid rgba(13,148,136,0.4)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {s.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(s.body, s.key)}
                      style={{
                        marginLeft: "auto",
                        padding: "3px 10px",
                        borderRadius: 6,
                        background: copied === s.key ? "#10b981" : "rgba(255,255,255,0.08)",
                        color: copied === s.key ? "#0f172a" : "#e2e8f0",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {copied === s.key ? "Copied" : "Copy"}
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
                    {s.body}
                  </pre>
                </div>
              ))}
            </div>

            {/* Response */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, fontSize: 11, color: "#64748b" }}>
                <span style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>Response</span>
                {responseMeta && (
                  <>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: responseMeta.status === 200 ? "#10b981" : "#ef4444",
                        color: "#fff",
                        fontWeight: 800,
                        fontFamily: "monospace",
                      }}
                    >
                      {responseMeta.status}
                    </span>
                    <span style={{ fontFamily: "monospace" }}>{responseMeta.ms}ms</span>
                    <span style={{ fontFamily: "monospace" }}>{(responseMeta.bytes / 1024).toFixed(1)}kb</span>
                  </>
                )}
                {loading && <span style={{ color: "#0d9488" }}>updating…</span>}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  maxHeight: 520,
                  overflow: "auto",
                  lineHeight: 1.5,
                }}
              >
                {(() => {
                  if (!response) return "";
                  if (format !== "json") return response.slice(0, 30_000);
                  try {
                    return JSON.stringify(JSON.parse(response), null, 2).slice(0, 30_000);
                  } catch {
                    return response.slice(0, 30_000);
                  }
                })()}
              </pre>
              <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                Truncated after 30kb. Open <a href={apiUrl(`/api/aevion/catalog${query}`)} style={{ color: "#0d9488" }} target="_blank" rel="noreferrer">full response</a> for raw payload.
              </div>
            </div>

            <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.18)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Tip
              </div>
              <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
                The <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>fields</code> projection lets you slim payloads dramatically — ask for just <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>id,name,frontend</code> for a homepage tile-list. CSV is RFC 4180-compliant. Markdown is GitHub-flavoured.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
