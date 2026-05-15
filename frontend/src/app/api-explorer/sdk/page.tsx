"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

/* ----------------------------- types ----------------------------- */

type MethodId =
  | "list"
  | "get"
  | "stats"
  | "health"
  | "openapi"
  | "sitemap"
  | "searchByTag"
  | "byStatus"
  | "byKind"
  | "mvpsAndLaunched"
  | "topTags"
  | "csvUrl"
  | "markdownUrl"
  | "badgeUrl";

type MethodGroup = "Read" | "Hub aggregates" | "Helpers" | "URL builders";

interface ArgSpec {
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  kind: "text" | "number";
  hint?: string;
}

interface MethodDef {
  id: MethodId;
  group: MethodGroup;
  label: string;
  description: string;
  args: ArgSpec[];
  /** "fetch" → run HTTP and show body; "url" → build a URL only, no fetch */
  mode: "fetch" | "url";
  /** Optional accent color (for group tinting on the "Run" CTA) */
  accent: string;
}

interface ResponseState {
  ok: boolean;
  status: number;
  ms: number;
  bytes: number;
  body: string;
  /** When the method is a URL-builder, we surface a single URL here */
  urlOnly?: string;
  /** When sitemap() parses XML into items, we keep the structured form here */
  parsed?: Record<string, unknown> | null;
}

/* --------------------------- method registry --------------------------- */

const TEAL = "#0d9488";
const VIOLET = "#8b5cf6";
const AMBER = "#f59e0b";

const METHODS: MethodDef[] = [
  {
    id: "list",
    group: "Read",
    label: "list(opts)",
    description:
      "GET /api/aevion/catalog — primary feed. Comma-separated status / tag / kind / fields filters narrow & project the response.",
    args: [
      { name: "status", label: "status", placeholder: "mvp,launched", defaultValue: "mvp,launched", kind: "text", hint: "comma-separated; leave blank for all" },
      { name: "tag", label: "tag", placeholder: "fintech,ip", defaultValue: "", kind: "text" },
      { name: "kind", label: "kind", placeholder: "core,product", defaultValue: "", kind: "text" },
      { name: "fields", label: "fields", placeholder: "id,name,frontend", defaultValue: "", kind: "text", hint: "projection — slim the payload" },
    ],
    mode: "fetch",
    accent: TEAL,
  },
  {
    id: "get",
    group: "Read",
    label: "get(id)",
    description: "GET /api/aevion/catalog/:id — fetch a single module by id.",
    args: [{ name: "id", label: "id", placeholder: "qsign-v2", defaultValue: "qsign-v2", kind: "text" }],
    mode: "fetch",
    accent: TEAL,
  },
  {
    id: "searchByTag",
    group: "Read",
    label: "searchByTag(tag)",
    description: "Convenience — list() filtered by a single tag.",
    args: [{ name: "tag", label: "tag", placeholder: "fintech", defaultValue: "fintech", kind: "text" }],
    mode: "fetch",
    accent: TEAL,
  },
  {
    id: "byStatus",
    group: "Read",
    label: "byStatus(status)",
    description: "Convenience — list() filtered by a single status.",
    args: [{ name: "status", label: "status", placeholder: "launched", defaultValue: "launched", kind: "text" }],
    mode: "fetch",
    accent: TEAL,
  },
  {
    id: "byKind",
    group: "Read",
    label: "byKind(kind)",
    description: "Convenience — list() filtered by a single kind.",
    args: [{ name: "kind", label: "kind", placeholder: "product", defaultValue: "product", kind: "text" }],
    mode: "fetch",
    accent: TEAL,
  },
  {
    id: "mvpsAndLaunched",
    group: "Read",
    label: "mvpsAndLaunched()",
    description: "Convenience — list({ status: ['mvp', 'launched'] }). The investor-grade feed.",
    args: [],
    mode: "fetch",
    accent: TEAL,
  },
  {
    id: "stats",
    group: "Hub aggregates",
    label: "stats()",
    description: "GET /api/aevion/registry-stats — totals by status, kind, tag plus top-tags ranking.",
    args: [],
    mode: "fetch",
    accent: VIOLET,
  },
  {
    id: "health",
    group: "Hub aggregates",
    label: "health()",
    description: "GET /api/aevion/health — aggregated per-service probe (ok/degraded/down).",
    args: [],
    mode: "fetch",
    accent: VIOLET,
  },
  {
    id: "openapi",
    group: "Hub aggregates",
    label: "openapi()",
    description: "GET /api/aevion/openapi.json — full aggregate spec across modules.",
    args: [],
    mode: "fetch",
    accent: VIOLET,
  },
  {
    id: "sitemap",
    group: "Hub aggregates",
    label: "sitemap()",
    description:
      "GET /api/aevion/sitemap.xml — fetched as text, parsed with DOMParser. Returns the URL list.",
    args: [],
    mode: "fetch",
    accent: VIOLET,
  },
  {
    id: "topTags",
    group: "Helpers",
    label: "topTags(n)",
    description:
      "Helper — calls stats() and returns the top-N tags client-side. No extra request beyond the registry-stats call.",
    args: [{ name: "n", label: "n", placeholder: "10", defaultValue: "10", kind: "number" }],
    mode: "fetch",
    accent: AMBER,
  },
  {
    id: "csvUrl",
    group: "URL builders",
    label: "csvUrl(opts)",
    description:
      "Builds a copyable CSV download URL for the catalog. No fetch is issued — paste into a browser, spreadsheet importer, or `wget`.",
    args: [
      { name: "status", label: "status", placeholder: "mvp,launched", defaultValue: "", kind: "text" },
      { name: "tag", label: "tag", placeholder: "fintech", defaultValue: "", kind: "text" },
      { name: "kind", label: "kind", placeholder: "product", defaultValue: "", kind: "text" },
      { name: "fields", label: "fields", placeholder: "id,name,status,frontend", defaultValue: "", kind: "text" },
    ],
    mode: "url",
    accent: TEAL,
  },
  {
    id: "markdownUrl",
    group: "URL builders",
    label: "markdownUrl(opts)",
    description: "Builds a copyable Markdown export URL for the catalog. Great for README tables.",
    args: [
      { name: "status", label: "status", placeholder: "mvp,launched", defaultValue: "", kind: "text" },
      { name: "tag", label: "tag", placeholder: "fintech", defaultValue: "", kind: "text" },
      { name: "kind", label: "kind", placeholder: "product", defaultValue: "", kind: "text" },
      { name: "fields", label: "fields", placeholder: "id,name,status", defaultValue: "", kind: "text" },
    ],
    mode: "url",
    accent: TEAL,
  },
  {
    id: "badgeUrl",
    group: "URL builders",
    label: "badgeUrl(id)",
    description: "Builds the shields.io-style SVG badge URL for a module.",
    args: [{ name: "id", label: "id", placeholder: "qsign-v2", defaultValue: "qsign-v2", kind: "text" }],
    mode: "url",
    accent: TEAL,
  },
];

const GROUP_ORDER: MethodGroup[] = ["Read", "Hub aggregates", "Helpers", "URL builders"];

const GROUP_COLOR: Record<MethodGroup, string> = {
  Read: TEAL,
  "Hub aggregates": VIOLET,
  Helpers: AMBER,
  "URL builders": "#475569",
};

function methodById(id: string): MethodDef {
  const m = METHODS.find((x) => x.id === id);
  if (!m) return METHODS[0];
  return m;
}

/* --------------------------- arg helpers --------------------------- */

function defaultArgsFor(method: MethodDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of method.args) out[a.name] = a.defaultValue;
  return out;
}

function buildCatalogQuery(args: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const key of ["status", "tag", "kind", "fields"] as const) {
    const v = (args[key] || "").trim();
    if (v) p.set(key, v);
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}

function buildExportUrl(
  apiBase: string,
  format: "csv" | "md",
  args: Record<string, string>,
): string {
  const p = new URLSearchParams();
  for (const key of ["status", "tag", "kind", "fields"] as const) {
    const v = (args[key] || "").trim();
    if (v) p.set(key, v);
  }
  p.set("format", format);
  return `${apiBase}/api/aevion/catalog?${p.toString()}`;
}

/** Resolve which endpoint a method actually hits + how to encode it. */
function resolveEndpoint(
  method: MethodDef,
  args: Record<string, string>,
): { path: string; mode: "json" | "text" } {
  switch (method.id) {
    case "list":
      return { path: `/api/aevion/catalog${buildCatalogQuery(args)}`, mode: "json" };
    case "get": {
      const id = encodeURIComponent((args.id || "").trim());
      return { path: `/api/aevion/catalog/${id}`, mode: "json" };
    }
    case "stats":
      return { path: "/api/aevion/registry-stats", mode: "json" };
    case "health":
      return { path: "/api/aevion/health", mode: "json" };
    case "openapi":
      return { path: "/api/aevion/openapi.json", mode: "json" };
    case "sitemap":
      return { path: "/api/aevion/sitemap.xml", mode: "text" };
    case "searchByTag": {
      const tag = (args.tag || "").trim();
      return { path: `/api/aevion/catalog${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`, mode: "json" };
    }
    case "byStatus": {
      const status = (args.status || "").trim();
      return {
        path: `/api/aevion/catalog${status ? `?status=${encodeURIComponent(status)}` : ""}`,
        mode: "json",
      };
    }
    case "byKind": {
      const kind = (args.kind || "").trim();
      return { path: `/api/aevion/catalog${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, mode: "json" };
    }
    case "mvpsAndLaunched":
      return { path: "/api/aevion/catalog?status=mvp,launched", mode: "json" };
    case "topTags":
      // Hits stats endpoint; slicing happens client-side after fetch.
      return { path: "/api/aevion/registry-stats", mode: "json" };
    default:
      return { path: "/api/aevion/catalog", mode: "json" };
  }
}

/** Render a method's SDK call snippet, e.g. `await cat.list({ status: ["mvp"] })`. */
function renderSdkSnippet(method: MethodDef, args: Record<string, string>): string {
  const header = `import { AevionCatalog } from "@aevion/catalog-client";\nconst cat = new AevionCatalog();\n\n`;
  switch (method.id) {
    case "list":
    case "csvUrl":
    case "markdownUrl": {
      const parts: string[] = [];
      for (const key of ["status", "tag", "kind", "fields"] as const) {
        const raw = (args[key] || "").trim();
        if (!raw) continue;
        const arr = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!arr.length) continue;
        parts.push(`  ${key}: [${arr.map((s) => `"${s}"`).join(", ")}]`);
      }
      const body = parts.length ? `{\n${parts.join(",\n")},\n}` : "{}";
      if (method.id === "list") return `${header}const { items } = await cat.list(${body});`;
      if (method.id === "csvUrl") return `${header}const url = cat.csvUrl(${body});`;
      return `${header}const url = cat.markdownUrl(${body});`;
    }
    case "get":
      return `${header}const mod = await cat.get("${(args.id || "").trim()}");`;
    case "stats":
      return `${header}const stats = await cat.stats();`;
    case "health":
      return `${header}const h = await cat.health();\n// h.status: "ok" | "degraded" | "down"`;
    case "openapi":
      return `${header}const spec = await cat.openapi();`;
    case "sitemap":
      return `${header}const urls = await cat.sitemap();\n// → string[] of public URLs`;
    case "searchByTag":
      return `${header}const items = await cat.searchByTag("${(args.tag || "").trim()}");`;
    case "byStatus":
      return `${header}const items = await cat.byStatus("${(args.status || "").trim()}");`;
    case "byKind":
      return `${header}const items = await cat.byKind("${(args.kind || "").trim()}");`;
    case "mvpsAndLaunched":
      return `${header}const items = await cat.mvpsAndLaunched();`;
    case "topTags": {
      const n = Number((args.n || "").trim());
      const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
      return `${header}const top = await cat.topTags(${safe});\n// → [{ tag, count }, ...]`;
    }
    case "badgeUrl":
      return `${header}const url = cat.badgeUrl("${(args.id || "").trim()}");`;
    default:
      return header;
  }
}

/** Build a curl one-liner equivalent to the SDK call (for fetch methods only). */
function renderCurl(method: MethodDef, fullUrl: string): string {
  if (method.id === "sitemap") return `curl -s '${fullUrl}'`;
  return `curl -s '${fullUrl}' | jq .`;
}

/* --------------------------- sitemap parsing --------------------------- */

function parseSitemap(xml: string): { urls: string[]; total: number; error?: string } {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return { urls: [], total: 0, error: "DOMParser not available (SSR)" };
  }
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const errNode = doc.querySelector("parsererror");
    if (errNode) return { urls: [], total: 0, error: errNode.textContent || "parse error" };
    const locs = Array.from(doc.querySelectorAll("url > loc"))
      .map((n) => n.textContent || "")
      .filter(Boolean);
    return { urls: locs, total: locs.length };
  } catch (e: unknown) {
    return { urls: [], total: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/* --------------------------- JSON colorizer --------------------------- */

/**
 * Best-effort line-by-line colorizer for pretty-printed JSON.
 * Avoids a full lexer — splits each line into [key, value, punctuation].
 */
function colorizeJsonLine(line: string, idx: number): React.ReactNode {
  // Key: value pattern, with optional trailing comma
  const m = line.match(/^(\s*)("(?:[^"\\]|\\.)*")(\s*:\s*)(.*)$/);
  if (m) {
    const [, indent, key, sep, rest] = m;
    return (
      <span key={idx}>
        {indent}
        <span style={{ color: "#7dd3fc" }}>{key}</span>
        <span style={{ color: "#94a3b8" }}>{sep}</span>
        {colorizeJsonValue(rest)}
        {"\n"}
      </span>
    );
  }
  // Pure value line (array element, opening brace, etc.)
  return (
    <span key={idx}>
      {colorizeJsonValue(line)}
      {"\n"}
    </span>
  );
}

function colorizeJsonValue(value: string): React.ReactNode {
  // String literal followed by optional comma
  const s = value.match(/^(.*?)("(?:[^"\\]|\\.)*")(.*)$/);
  if (s) {
    return (
      <>
        <span style={{ color: "#94a3b8" }}>{s[1]}</span>
        <span style={{ color: "#86efac" }}>{s[2]}</span>
        <span style={{ color: "#94a3b8" }}>{s[3]}</span>
      </>
    );
  }
  // Booleans / null
  if (/\b(true|false|null)\b/.test(value)) {
    return value.split(/(\btrue\b|\bfalse\b|\bnull\b)/).map((chunk, i) => {
      if (chunk === "true" || chunk === "false") {
        return (
          <span key={i} style={{ color: "#fca5a5" }}>
            {chunk}
          </span>
        );
      }
      if (chunk === "null") {
        return (
          <span key={i} style={{ color: "#fdba74" }}>
            {chunk}
          </span>
        );
      }
      return (
        <span key={i} style={{ color: "#e2e8f0" }}>
          {chunk}
        </span>
      );
    });
  }
  // Numbers
  if (/-?\d/.test(value)) {
    return value.split(/(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i).map((chunk, i) => {
      if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(chunk)) {
        return (
          <span key={i} style={{ color: "#fcd34d" }}>
            {chunk}
          </span>
        );
      }
      return (
        <span key={i} style={{ color: "#94a3b8" }}>
          {chunk}
        </span>
      );
    });
  }
  return <span style={{ color: "#e2e8f0" }}>{value}</span>;
}

function ColorizedJson({ text }: { text: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: 8,
        fontSize: 11.5,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        maxHeight: 560,
        overflow: "auto",
        lineHeight: 1.55,
        whiteSpace: "pre",
      }}
    >
      {lines.map((line, i) => colorizeJsonLine(line, i))}
    </pre>
  );
}

/* --------------------------- subcomponents --------------------------- */

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
            background: copied === copyKey ? "#10b981" : "rgba(255,255,255,0.08)",
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

function GroupBadge({ group }: { group: MethodGroup }) {
  const c = GROUP_COLOR[group];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        background: `${c}18`,
        color: c,
        fontSize: 10,
        fontWeight: 800,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {group}
    </span>
  );
}

/* ----------------------------- page ----------------------------- */

export default function SdkPlaygroundPage() {
  const [selectedMethod, setSelectedMethod] = useState<MethodId>("list");
  const [args, setArgs] = useState<Record<string, string>>(() => defaultArgsFor(methodById("list")));
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const runRef = useRef<HTMLButtonElement | null>(null);

  const method = useMemo(() => methodById(selectedMethod), [selectedMethod]);

  const apiBase = getApiBase();

  // The user-facing URL we render in the snippet card.
  const previewUrl = useMemo(() => {
    if (method.id === "csvUrl") return buildExportUrl(apiBase, "csv", args);
    if (method.id === "markdownUrl") return buildExportUrl(apiBase, "md", args);
    if (method.id === "badgeUrl") {
      const id = encodeURIComponent((args.id || "").trim());
      return `${apiBase}/api/aevion/catalog/${id}/badge.svg`;
    }
    const { path } = resolveEndpoint(method, args);
    return `${apiBase}${path}`;
  }, [apiBase, method, args]);

  const sdkSnippet = useMemo(() => renderSdkSnippet(method, args), [method, args]);
  const curlSnippet = useMemo(
    () => (method.mode === "url" ? `# URL builder — no fetch issued\n${previewUrl}` : renderCurl(method, previewUrl)),
    [method, previewUrl],
  );

  // When the method changes, reset args to that method's defaults.
  useEffect(() => {
    setArgs(defaultArgsFor(method));
    setResponse(null);
  }, [method]);

  const copy = useCallback((text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const run = useCallback(async () => {
    // URL builders: just surface the URL.
    if (method.mode === "url") {
      const url = previewUrl;
      setResponse({
        ok: true,
        status: 0,
        ms: 0,
        bytes: new Blob([url]).size,
        body: url,
        urlOnly: url,
      });
      return;
    }

    const { path, mode } = resolveEndpoint(method, args);
    const url = apiUrl(path);
    const t0 = performance.now();
    setLoading(true);
    try {
      const res = await fetch(url);
      const text = await res.text();
      const ms = Math.round(performance.now() - t0);
      const bytes = new Blob([text]).size;

      let body = text;
      let parsed: Record<string, unknown> | null | undefined = undefined;

      if (mode === "json") {
        try {
          const parsedJson: unknown = JSON.parse(text);
          // topTags helper: slice top-N tags client-side from registry-stats payload
          if (method.id === "topTags") {
            const n = Number((args.n || "").trim());
            const limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
            if (
              parsedJson &&
              typeof parsedJson === "object" &&
              !Array.isArray(parsedJson) &&
              Array.isArray((parsedJson as { byTag?: unknown }).byTag)
            ) {
              const byTag = ((parsedJson as { byTag: unknown[] }).byTag).filter(
                (entry): entry is { tag: string; count: number } =>
                  typeof entry === "object" &&
                  entry !== null &&
                  typeof (entry as { tag?: unknown }).tag === "string" &&
                  typeof (entry as { count?: unknown }).count === "number",
              );
              const sliced = byTag.slice(0, limit);
              parsed = { topTags: sliced, requestedN: limit, sourceTotal: byTag.length };
              body = JSON.stringify(parsed, null, 2);
            } else {
              body = JSON.stringify(parsedJson, null, 2);
            }
          } else {
            body = JSON.stringify(parsedJson, null, 2);
          }
        } catch {
          // leave body as raw text
        }
      } else if (method.id === "sitemap") {
        const sm = parseSitemap(text);
        parsed = { urls: sm.urls, total: sm.total, ...(sm.error ? { error: sm.error } : {}) };
        body = JSON.stringify(parsed, null, 2);
      }

      setResponse({
        ok: res.ok,
        status: res.status,
        ms,
        bytes,
        body,
        parsed: parsed ?? null,
      });
    } catch (e: unknown) {
      const ms = Math.round(performance.now() - t0);
      const msg = e instanceof Error ? e.message : String(e);
      setResponse({
        ok: false,
        status: 0,
        ms,
        bytes: 0,
        body: `Network error: ${msg}`,
      });
    } finally {
      setLoading(false);
    }
  }, [method, args, previewUrl]);

  // cmd+Enter / ctrl+Enter to run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusColor =
    response === null
      ? "#64748b"
      : response.urlOnly
        ? "#0d9488"
        : response.ok
          ? "#10b981"
          : response.status === 0
            ? "#ef4444"
            : response.status >= 400
              ? "#ef4444"
              : "#f59e0b";

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/developers" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← Developers
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            AEVION SDK playground
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Pick a method from{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              @aevion/catalog-client
            </code>
            , fill in the args, hit{" "}
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background: "rgba(13,148,136,0.12)",
                color: TEAL,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 12,
              }}
            >
              ⌘↵
            </span>{" "}
            and see exactly what the SDK would return — no install, no boilerplate. URL-builder
            methods skip the network and just show you a copyable link.
          </p>
        </div>

        {/* Method picker */}
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
            htmlFor="method-picker"
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 800,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Method
          </label>
          <select
            id="method-picker"
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as MethodId)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              border: "1px solid rgba(15,23,42,0.16)",
              borderRadius: 8,
              background: "#f8fafc",
              color: "#0f172a",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {GROUP_ORDER.map((g) => (
              <optgroup key={g} label={g}>
                {METHODS.filter((m) => m.group === g).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <GroupBadge group={method.group} />
            <span style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
              {method.description}
            </span>
          </div>
        </div>

        {/* Args panel */}
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
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 10,
            }}
          >
            Arguments
          </div>
          {method.args.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#94a3b8", fontStyle: "italic" }}>
              No arguments for this method.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              {method.args.map((arg) => (
                <div key={arg.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label
                    htmlFor={`arg-${arg.name}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#475569",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    }}
                  >
                    {arg.label}
                  </label>
                  <input
                    id={`arg-${arg.name}`}
                    type={arg.kind === "number" ? "number" : "text"}
                    inputMode={arg.kind === "number" ? "numeric" : undefined}
                    value={args[arg.name] ?? ""}
                    onChange={(e) => setArgs((prev) => ({ ...prev, [arg.name]: e.target.value }))}
                    placeholder={arg.placeholder}
                    style={{
                      padding: "8px 10px",
                      fontSize: 13,
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      border: "1px solid rgba(15,23,42,0.16)",
                      borderRadius: 8,
                      outline: "none",
                      background: "#f8fafc",
                      color: "#0f172a",
                    }}
                  />
                  {arg.hint && (
                    <span style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.4 }}>
                      {arg.hint}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              ref={runRef}
              type="button"
              onClick={() => void run()}
              disabled={loading}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: `1px solid ${method.accent}50`,
                background: loading ? `${method.accent}18` : method.accent,
                color: loading ? method.accent : "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: loading ? "wait" : "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {loading ? "Running…" : method.mode === "url" ? "Build URL" : "Run"}
            </button>
            <span
              style={{
                fontSize: 11,
                color: "#94a3b8",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              ⌘↵ / ctrl+↵ also runs
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
              {method.mode === "url" ? (
                <>
                  <strong style={{ color: "#0f172a" }}>URL builder</strong> — no HTTP request issued
                </>
              ) : (
                <>
                  → <code style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{previewUrl.replace(apiBase, "")}</code>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Snippets */}
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <CopyCard label="SDK call" body={sdkSnippet} copied={copied} onCopy={copy} copyKey="sdk" />
          <CopyCard
            label={method.mode === "url" ? "URL" : "curl"}
            body={curlSnippet}
            copied={copied}
            onCopy={copy}
            copyKey="curl"
          />
          <CopyCard
            label="npm install"
            body={`npm i @aevion/catalog-client`}
            copied={copied}
            onCopy={copy}
            copyKey="install"
          />
        </div>

        {/* Response panel */}
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              fontSize: 11,
              color: "#64748b",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Response
            </span>
            {response ? (
              <>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: statusColor,
                    color: "#fff",
                    fontWeight: 800,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  }}
                >
                  {response.urlOnly ? "URL" : response.status || "ERR"}
                </span>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                  {response.ms}ms
                </span>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                  {(response.bytes / 1024).toFixed(2)}kb
                </span>
              </>
            ) : (
              <span style={{ color: "#94a3b8" }}>
                {method.mode === "url"
                  ? "Build the URL to preview it here."
                  : "Run the method to see the response."}
              </span>
            )}
            {loading && <span style={{ color: TEAL }}>loading…</span>}
          </div>

          {response?.urlOnly ? (
            <div
              style={{
                padding: 14,
                background: "#0f172a",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <code
                style={{
                  fontSize: 12.5,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  color: "#86efac",
                  flex: 1,
                  minWidth: 0,
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {response.urlOnly}
              </code>
              <button
                type="button"
                onClick={() => copy(response.urlOnly || "", "url-out")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: copied === "url-out" ? "#10b981" : "rgba(255,255,255,0.08)",
                  color: copied === "url-out" ? "#0f172a" : "#e2e8f0",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {copied === "url-out" ? "Copied" : "Copy URL"}
              </button>
              <a
                href={response.urlOnly}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: TEAL,
                  color: "#fff",
                  border: "none",
                  textDecoration: "none",
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                Open ↗
              </a>
            </div>
          ) : response ? (
            <ColorizedJson text={response.body.slice(0, 60_000)} />
          ) : (
            <div
              style={{
                padding: "32px 16px",
                background: "#0f172a",
                borderRadius: 8,
                textAlign: "center",
                color: "#475569",
                fontSize: 12.5,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              { '// no response yet — press Run' }
            </div>
          )}

          {response && response.body.length > 60_000 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
              Truncated to 60kb. Use curl for the full payload.
            </div>
          )}
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
            The playground issues fetches directly against{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>
              /api/aevion/*
            </code>{" "}
            — the npm package wraps the same endpoints. URL builders never call the network; they
            return a deterministic URL you can hand to a browser, spreadsheet importer or CI script.
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
          SDK: <code>@aevion/catalog-client</code> ·{" "}
          <Link href="/api-explorer/catalog" style={{ color: TEAL }}>
            Catalog explorer
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
