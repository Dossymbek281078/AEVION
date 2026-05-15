"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

type CatalogItem = {
  id: string;
  name: string;
  status: string;
};

const STATUS_COLOR: Record<string, string> = {
  launched: "#10b981",
  mvp: "#10b981",
  in_progress: "#f59e0b",
  research: "#8b5cf6",
  planning: "#3b82f6",
  idea: "#94a3b8",
};

const ALIGN_OPTIONS = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
];

export default function BadgesExplorerPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [picked, setPicked] = useState<string[]>(["qpersona", "qsign", "qright"]);
  const [search, setSearch] = useState("");
  const [link, setLink] = useState(true);
  const [align, setAlign] = useState("left");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/aevion/catalog?fields=id,name,status"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: CatalogItem[] } | null) => {
        if (j?.items) setItems(j.items);
      })
      .catch(() => {});
  }, []);

  const apiBase = getApiBase();

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [items, search]);

  const markdown = useMemo(() => {
    if (picked.length === 0) return "";
    const lines = picked.map((id) => {
      const badge = `![AEVION ${id}](${apiBase}/api/aevion/badges/${id}.svg)`;
      return link ? `[${badge}](https://aevion.app/${id})` : badge;
    });
    if (align === "left") return lines.join("\n");
    if (align === "center")
      return `<p align="center">\n${lines.map((l) => `  ${l}`).join("\n")}\n</p>`;
    return `<p align="right">\n${lines.map((l) => `  ${l}`).join("\n")}\n</p>`;
  }, [picked, link, align, apiBase]);

  const html = useMemo(() => {
    if (picked.length === 0) return "";
    const tags = picked
      .map((id) => {
        const img = `<img alt="AEVION ${id}" src="${apiBase}/api/aevion/badges/${id}.svg">`;
        return link ? `<a href="https://aevion.app/${id}">${img}</a>` : img;
      })
      .join("\n");
    if (align === "left") return tags;
    return `<p align="${align}">\n${tags
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n")}\n</p>`;
  }, [picked, link, align, apiBase]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const togglePicked = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/developers" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← Developers
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            AEVION badge builder
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Pick modules → copy ready-made Markdown or HTML. Backed by{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              GET /api/aevion/badges/:id.svg
            </code>{" "}
            (shields.io-style SVG, color-coded by current status). Drop into a README, blog post or
            pitch deck — badges auto-update when status changes upstream.
          </p>
        </div>

        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 380px) 1fr" }}>
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
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Search modules…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 13,
                  border: "1px solid rgba(15,23,42,0.16)",
                  borderRadius: 8,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: "#64748b" }}>
              <span style={{ fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Modules ({filtered.length}/{items.length})
              </span>
              <span>{picked.length} picked</span>
            </div>
            <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 8 }}>
              {filtered.map((m) => {
                const isPicked = picked.includes(m.id);
                const c = STATUS_COLOR[m.status] || "#94a3b8";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => togglePicked(m.id)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: isPicked ? "rgba(13,148,136,0.08)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(15,23,42,0.06)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 12.5,
                      color: "#0f172a",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => {}}
                      style={{ pointerEvents: "none", flexShrink: 0 }}
                    />
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: c }} aria-hidden />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.id}
                    </span>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", textTransform: "uppercase" }}>
                      {m.status}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ padding: 16, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                  No matches.
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                Options
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#475569", marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} />
                Wrap with link to <code style={{ fontSize: 11 }}>aevion.app/&lt;id&gt;</code>
              </label>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {ALIGN_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAlign(a.id)}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: `1px solid ${align === a.id ? "#0d9488" : "rgba(15,23,42,0.16)"}`,
                      background: align === a.id ? "#0d9488" : "#fff",
                      color: align === a.id ? "#fff" : "#475569",
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPicked([])}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(15,23,42,0.16)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
              }}
            >
              Clear selection
            </button>
          </aside>

          <section style={{ minWidth: 0 }}>
            {/* Live preview */}
            <div
              style={{
                padding: "20px 22px",
                borderRadius: 12,
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                Live preview
              </div>
              {picked.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8", padding: "20px 0" }}>
                  Pick a module to start.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent:
                      align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
                  }}
                >
                  {picked.map((id) => {
                    const img = (
                      <img
                        key={id}
                        alt={`AEVION ${id}`}
                        src={`${apiBase}/api/aevion/badges/${id}.svg`}
                        style={{ height: 20 }}
                      />
                    );
                    return link ? (
                      <a key={id} href={`https://aevion.app/${id}`} target="_blank" rel="noreferrer">
                        {img}
                      </a>
                    ) : (
                      img
                    );
                  })}
                </div>
              )}
            </div>

            {/* Markdown */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "#0f172a",
                color: "#e2e8f0",
                border: "1px solid rgba(13,148,136,0.4)",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Markdown
                </span>
                <button
                  type="button"
                  onClick={() => copy(markdown, "md")}
                  disabled={!markdown}
                  style={{
                    marginLeft: "auto",
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: copied === "md" ? "#10b981" : "rgba(255,255,255,0.08)",
                    color: copied === "md" ? "#0f172a" : "#e2e8f0",
                    border: "none",
                    cursor: markdown ? "pointer" : "not-allowed",
                    fontSize: 10,
                    fontWeight: 800,
                    opacity: markdown ? 1 : 0.4,
                  }}
                >
                  {copied === "md" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.6,
                  minHeight: 36,
                }}
              >
                {markdown || "(empty)"}
              </pre>
            </div>

            {/* HTML */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "#0f172a",
                color: "#e2e8f0",
                border: "1px solid rgba(13,148,136,0.4)",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  HTML
                </span>
                <button
                  type="button"
                  onClick={() => copy(html, "html")}
                  disabled={!html}
                  style={{
                    marginLeft: "auto",
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: copied === "html" ? "#10b981" : "rgba(255,255,255,0.08)",
                    color: copied === "html" ? "#0f172a" : "#e2e8f0",
                    border: "none",
                    cursor: html ? "pointer" : "not-allowed",
                    fontSize: 10,
                    fontWeight: 800,
                    opacity: html ? 1 : 0.4,
                  }}
                >
                  {copied === "html" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.6,
                  minHeight: 36,
                }}
              >
                {html || "(empty)"}
              </pre>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.18)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Badge colors
              </div>
              <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.7 }}>
                <span style={{ color: "#10b981", fontWeight: 700 }}>green</span> — launched / mvp · {" "}
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>amber</span> — in_progress · {" "}
                <span style={{ color: "#8b5cf6", fontWeight: 700 }}>violet</span> — research · {" "}
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>blue</span> — planning · {" "}
                <span style={{ color: "#94a3b8", fontWeight: 700 }}>gray</span> — idea
                <br />
                Update the catalog status upstream and these badges auto-refresh — no embed change needed.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
