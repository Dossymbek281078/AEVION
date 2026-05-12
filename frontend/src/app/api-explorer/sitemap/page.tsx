"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

interface SitemapEntry {
  loc: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

type GroupKey = "prefix" | "changefreq" | "priority" | "lastmod";

const GROUP_OPTIONS: { id: GroupKey; label: string }[] = [
  { id: "prefix", label: "Path prefix" },
  { id: "changefreq", label: "changefreq" },
  { id: "priority", label: "Priority bucket" },
  { id: "lastmod", label: "lastmod month" },
];

function priorityColor(p: number | null): string {
  if (p === null) return "#94a3b8";
  if (p >= 0.7) return "#10b981";
  if (p >= 0.4) return "#f59e0b";
  return "#94a3b8";
}

function priorityBucket(p: number | null): string {
  if (p === null) return "no priority";
  if (p >= 0.8) return "0.8 — 1.0 (high)";
  if (p >= 0.5) return "0.5 — 0.79 (medium)";
  if (p >= 0.1) return "0.1 — 0.49 (low)";
  return "< 0.1";
}

function lastmodMonth(s: string | null): string {
  if (!s) return "no lastmod";
  const m = s.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : s;
}

function pathPrefix(loc: string): string {
  try {
    const u = new URL(loc);
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg.length === 0) return "/ (root)";
    return `/${seg[0]}`;
  } catch {
    return "(invalid)";
  }
}

function stripOrigin(loc: string): string {
  try {
    const u = new URL(loc);
    return u.pathname + u.search + u.hash || "/";
  } catch {
    return loc;
  }
}

function parseSitemap(text: string): SitemapEntry[] {
  if (typeof window === "undefined") return [];
  const dom = new DOMParser().parseFromString(text, "application/xml");
  const errNode = dom.querySelector("parsererror");
  if (errNode) throw new Error("Sitemap is not valid XML");
  return Array.from(dom.querySelectorAll("url")).map((u) => {
    const priText = u.querySelector("priority")?.textContent;
    const pri = priText !== undefined && priText !== null && priText.trim() !== "" ? Number(priText) : null;
    return {
      loc: u.querySelector("loc")?.textContent ?? "",
      lastmod: u.querySelector("lastmod")?.textContent ?? null,
      changefreq: u.querySelector("changefreq")?.textContent ?? null,
      priority: pri !== null && Number.isFinite(pri) ? pri : null,
    };
  });
}

export default function SitemapExplorerPage() {
  const [entries, setEntries] = useState<SitemapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupKey>("prefix");
  const [copied, setCopied] = useState<string | null>(null);

  const apiBase = getApiBase();
  const fullUrl = `${apiBase}/api/aevion/sitemap.xml`;
  const curl = `curl -s '${fullUrl}'`;
  const python = `import urllib.request
import xml.etree.ElementTree as ET

with urllib.request.urlopen("${fullUrl}") as r:
    tree = ET.fromstring(r.read())

ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
for url in tree.findall("sm:url", ns):
    loc = url.findtext("sm:loc", default="", namespaces=ns)
    pri = url.findtext("sm:priority", default="", namespaces=ns)
    print(f"{loc}\\t{pri}")`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl("/api/aevion/sitemap.xml"))
      .then(async (r) => {
        const text = await r.text();
        if (cancelled) return;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const parsed = parseSitemap(text);
        setEntries(parsed);
        setError(null);
        setLastFetched(Date.now());
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => stripOrigin(e.loc).toLowerCase().includes(q) || e.loc.toLowerCase().includes(q));
  }, [entries, search]);

  const groups = useMemo(() => {
    const map = new Map<string, SitemapEntry[]>();
    for (const e of filtered) {
      let key = "";
      if (groupBy === "prefix") key = pathPrefix(e.loc);
      else if (groupBy === "changefreq") key = e.changefreq || "none";
      else if (groupBy === "priority") key = priorityBucket(e.priority);
      else key = lastmodMonth(e.lastmod);
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (groupBy === "priority") {
        const order = ["0.8 — 1.0 (high)", "0.5 — 0.79 (medium)", "0.1 — 0.49 (low)", "< 0.1", "no priority"];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      }
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered, groupBy]);

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
            Sitemap explorer
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Browse{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              GET /api/aevion/sitemap.xml
            </code>{" "}
            — the public sitemap powering AEVION&apos;s search-engine visibility. Search by path, group by
            prefix / changefreq / priority bucket / lastmod month. The XML is parsed in your browser with
            the native DOMParser — no library required.
          </p>
        </div>

        {/* Snippets */}
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          {[
            { label: "URL", body: fullUrl, key: "url" },
            { label: "curl", body: curl, key: "curl" },
            { label: "Python (stdlib)", body: python, key: "python" },
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

        {/* Stats banner */}
        <div
          style={{
            padding: "18px 22px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0d9488", lineHeight: 1 }}>
              {entries.length}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              total URLs
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: "rgba(15,23,42,0.08)" }} aria-hidden />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              {filtered.length}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>shown after filter</div>
          </div>
          <div style={{ width: 1, height: 36, background: "rgba(15,23,42,0.08)" }} aria-hidden />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
              {lastFetched ? `last fetched ${new Date(lastFetched).toLocaleTimeString()}` : loading ? "fetching…" : "—"}
            </div>
            {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Error: {error}</div>}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            type="text"
            placeholder="Search by path or URL substring…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              fontSize: 13,
              border: "1px solid rgba(15,23,42,0.16)",
              borderRadius: 8,
              outline: "none",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Group by
            </span>
            {GROUP_OPTIONS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupBy(g.id)}
                style={{
                  padding: "5px 11px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${groupBy === g.id ? "#0d9488" : "rgba(15,23,42,0.16)"}`,
                  background: groupBy === g.id ? "#0d9488" : "#fff",
                  color: groupBy === g.id ? "#fff" : "#475569",
                  transition: "all 120ms",
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Groups */}
        {groups.length === 0 && !loading && (
          <div
            style={{
              padding: "32px 24px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
            }}
          >
            {error ? "Failed to load sitemap." : entries.length === 0 ? "Loading sitemap…" : "No URLs match your filter."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map(([groupName, items]) => (
            <div
              key={groupName}
              style={{
                borderRadius: 12,
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  background: "rgba(13,148,136,0.06)",
                  borderBottom: "1px solid rgba(13,148,136,0.18)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0d9488", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                  {groupName}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#0d9488",
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "rgba(13,148,136,0.14)",
                    fontFamily: "monospace",
                  }}
                >
                  {items.length}
                </div>
              </div>
              <div>
                {items.map((entry) => {
                  const path = stripOrigin(entry.loc);
                  const pri = entry.priority;
                  const barColor = priorityColor(pri);
                  const barPct = pri === null ? 0 : Math.max(0, Math.min(1, pri)) * 100;
                  return (
                    <a
                      key={entry.loc}
                      href={entry.loc}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 16px",
                        borderBottom: "1px solid rgba(15,23,42,0.06)",
                        textDecoration: "none",
                        color: "#0f172a",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(13,148,136,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          fontSize: 12.5,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                      >
                        {path}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.lastmod || "—"}
                      </div>
                      {entry.changefreq ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(13,148,136,0.10)",
                            color: "#0d9488",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontFamily: "monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.changefreq}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>—</span>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 86,
                        }}
                        title={pri === null ? "no priority" : `priority ${pri.toFixed(2)}`}
                      >
                        <div
                          style={{
                            width: 50,
                            height: 6,
                            borderRadius: 999,
                            background: "rgba(15,23,42,0.08)",
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                          aria-hidden
                        >
                          <div
                            style={{
                              width: `${barPct}%`,
                              height: "100%",
                              background: barColor,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: barColor,
                            width: 26,
                            textAlign: "right",
                          }}
                        >
                          {pri === null ? "—" : pri.toFixed(2)}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Tip card */}
        <div
          style={{
            marginTop: 18,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#0d9488",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Priority legend
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.7 }}>
            <span style={{ color: "#10b981", fontWeight: 700 }}>green</span> — 0.7 – 1.0 (high) ·{" "}
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>amber</span> — 0.4 – 0.69 (medium) ·{" "}
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>gray</span> — &lt; 0.4 (low)
            <br />
            Submit this sitemap to Google Search Console and Bing Webmaster Tools — AEVION&apos;s root{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>
              /robots.txt
            </code>{" "}
            references it automatically.
          </div>
        </div>

        {/* Footer cross-links */}
        <div style={{ marginTop: 18, fontSize: 11, color: "#94a3b8" }}>
          Source: <code>GET /api/aevion/sitemap.xml</code> ·{" "}
          <Link href="/api-explorer/catalog" style={{ color: "#0d9488" }}>
            Catalog explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/health" style={{ color: "#0d9488" }}>
            Health explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/badges" style={{ color: "#0d9488" }}>
            Badge builder
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/openapi" style={{ color: "#0d9488" }}>
            OpenAPI explorer
          </Link>
        </div>
      </div>
    </main>
  );
}
