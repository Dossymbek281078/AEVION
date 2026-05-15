"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

/* ----------------------------- types ----------------------------- */

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];

interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  [k: string]: JsonValue | undefined;
}

interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  trace?: OperationObject;
  summary?: string;
  description?: string;
  parameters?: JsonValue;
  [k: string]: JsonValue | OperationObject | undefined;
}

interface ServerObject {
  url: string;
  description?: string;
}

interface InfoObject {
  title?: string;
  version?: string;
  description?: string;
}

interface ModuleRef {
  id: string;
  title?: string;
  spec?: string;
  health?: string;
}

interface OpenApiSpec {
  openapi?: string;
  info?: InfoObject;
  servers?: ServerObject[];
  paths?: Record<string, PathItem>;
  generatedAt?: string;
  // both well-known and AEVION-aggregate extensions:
  "x-modules"?: ModuleRef[];
  "x-services"?: ModuleRef[];
  aevion?: {
    name?: string;
    version?: string;
    description?: string;
    modules?: ModuleRef[];
    services?: ModuleRef[];
    sdk?: { npm?: string[]; docs?: string };
    generatedAt?: string;
  };
  // SDK manifest (aggregate-only)
  sdk?: { npm?: string[]; docs?: string };
}

type HttpVerb = "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "trace";

const VERBS: HttpVerb[] = ["get", "post", "put", "delete", "patch", "options", "head", "trace"];

const VERB_COLOR: Record<HttpVerb, string> = {
  get: "#0d9488",
  post: "#3b82f6",
  put: "#f59e0b",
  delete: "#ef4444",
  patch: "#8b5cf6",
  options: "#64748b",
  head: "#64748b",
  trace: "#64748b",
};

/* --------------------------- helpers ---------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") out.push(item);
  }
  return out;
}

function normaliseModules(raw: unknown): ModuleRef[] {
  if (!Array.isArray(raw)) return [];
  const out: ModuleRef[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asString(item.id) || asString(item.name) || asString(item.module);
    if (!id) continue;
    out.push({
      id,
      title: asString(item.title) || asString(item.name),
      spec: asString(item.spec) || asString(item.openapi) || asString(item.url),
      health: asString(item.health),
    });
  }
  return out;
}

interface DerivedView {
  title: string;
  version: string;
  description: string;
  servers: ServerObject[];
  paths: Record<string, PathItem>;
  modules: ModuleRef[];
  services: ModuleRef[];
  sdkNpm: string[];
  sdkDocs?: string;
  generatedAt?: string;
}

function deriveView(spec: OpenApiSpec | null): DerivedView {
  if (!spec) {
    return {
      title: "AEVION Aggregate API",
      version: "",
      description: "",
      servers: [],
      paths: {},
      modules: [],
      services: [],
      sdkNpm: [],
      sdkDocs: undefined,
      generatedAt: undefined,
    };
  }

  const aev = spec.aevion;

  const title =
    asString(spec.info?.title) ||
    asString(aev?.name) ||
    "AEVION Aggregate API";

  const version =
    asString(spec.info?.version) ||
    asString(aev?.version) ||
    asString(spec.openapi) ||
    "";

  const description =
    asString(spec.info?.description) ||
    asString(aev?.description) ||
    "";

  const servers: ServerObject[] = Array.isArray(spec.servers)
    ? spec.servers.filter((s): s is ServerObject => isRecord(s) && typeof s.url === "string")
    : [];

  const paths: Record<string, PathItem> = isRecord(spec.paths)
    ? (spec.paths as Record<string, PathItem>)
    : {};

  const modules = [
    ...normaliseModules(spec["x-modules"]),
    ...normaliseModules(aev?.modules),
  ];

  const services = [
    ...normaliseModules(spec["x-services"]),
    ...normaliseModules(aev?.services),
  ];

  const sdkNpm =
    asStringArray(aev?.sdk?.npm) ||
    asStringArray(spec.sdk?.npm) ||
    [];

  const sdkDocs = asString(aev?.sdk?.docs) || asString(spec.sdk?.docs);

  const generatedAt = asString(spec.generatedAt) || asString(aev?.generatedAt);

  return {
    title,
    version,
    description,
    servers,
    paths,
    modules,
    services,
    sdkNpm,
    sdkDocs,
    generatedAt,
  };
}

function operationsForPath(item: PathItem): { verb: HttpVerb; op: OperationObject }[] {
  const out: { verb: HttpVerb; op: OperationObject }[] = [];
  for (const v of VERBS) {
    const candidate = item[v];
    if (isRecord(candidate)) {
      out.push({ verb: v, op: candidate as OperationObject });
    }
  }
  return out;
}

/* ------------------------- subcomponents ------------------------ */

function VerbChip({ verb }: { verb: HttpVerb }) {
  const c = VERB_COLOR[verb];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 4,
        background: `${c}18`,
        color: c,
        fontSize: 10,
        fontWeight: 800,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {verb}
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

interface PathRowProps {
  path: string;
  item: PathItem;
}

function PathRow({ path, item }: PathRowProps) {
  const [open, setOpen] = useState(false);
  const ops = operationsForPath(item);

  // Tags + operationIds aggregated for header preview
  const tagSet = new Set<string>();
  const opIds: string[] = [];
  let firstSummary: string | undefined;
  for (const { op } of ops) {
    if (op.summary && !firstSummary) firstSummary = op.summary;
    if (Array.isArray(op.tags)) {
      for (const t of op.tags) if (typeof t === "string") tagSet.add(t);
    }
    if (typeof op.operationId === "string") opIds.push(op.operationId);
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 10,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: "none",
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {ops.length === 0 ? (
            <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>—</span>
          ) : (
            ops.map(({ verb }) => <VerbChip key={verb} verb={verb} />)
          )}
        </div>
        <code
          style={{
            fontSize: 13,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            color: "#0f172a",
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {path}
        </code>
        <span
          style={{
            fontSize: 10,
            color: "#94a3b8",
            fontFamily: "monospace",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {open ? "▼" : "▶"}
        </span>
      </button>

      {(firstSummary || tagSet.size > 0 || opIds.length > 0) && !open && (
        <div
          style={{
            padding: "0 14px 10px 14px",
            fontSize: 11.5,
            color: "#64748b",
            lineHeight: 1.5,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {firstSummary && (
            <span style={{ flex: 1, minWidth: 200 }}>{firstSummary}</span>
          )}
          {Array.from(tagSet).map((t) => (
            <span
              key={t}
              style={{
                padding: "1px 7px",
                borderRadius: 999,
                background: "rgba(13,148,136,0.1)",
                color: "#0d9488",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {t}
            </span>
          ))}
          {opIds.length > 0 && (
            <code
              style={{
                fontSize: 10.5,
                color: "#94a3b8",
                fontFamily: "monospace",
              }}
            >
              {opIds.join(" · ")}
            </code>
          )}
        </div>
      )}

      {open && (
        <div
          style={{
            padding: "0 14px 14px 14px",
            borderTop: "1px solid rgba(15,23,42,0.06)",
            paddingTop: 12,
          }}
        >
          {ops.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>
              No operations defined under this path.
            </div>
          ) : (
            ops.map(({ verb, op }) => (
              <div key={verb} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <VerbChip verb={verb} />
                  {op.summary && (
                    <span style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 700 }}>
                      {op.summary}
                    </span>
                  )}
                  {typeof op.operationId === "string" && (
                    <code
                      style={{
                        fontSize: 10.5,
                        color: "#64748b",
                        fontFamily: "monospace",
                        background: "rgba(15,23,42,0.06)",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {op.operationId}
                    </code>
                  )}
                  {Array.isArray(op.tags) &&
                    op.tags.filter((t): t is string => typeof t === "string").map((t) => (
                      <span
                        key={t}
                        style={{
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: "rgba(13,148,136,0.1)",
                          color: "#0d9488",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                </div>
                {op.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      lineHeight: 1.6,
                      marginBottom: 6,
                    }}
                  >
                    {op.description}
                  </div>
                )}
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    maxHeight: 320,
                    overflow: "auto",
                    lineHeight: 1.5,
                  }}
                >
                  {JSON.stringify(op, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- page ----------------------------- */

export default function OpenApiExplorerPage() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl("/api/aevion/openapi.json"))
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json = (await r.json()) as OpenApiSpec;
        if (!cancelled) {
          setSpec(json);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => deriveView(spec), [spec]);

  const filteredPaths = useMemo(() => {
    const entries = Object.entries(view.paths);
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(([p]) => p.toLowerCase().includes(q));
  }, [view.paths, search]);

  const apiBase = getApiBase();
  const fullUrl = `${apiBase}/api/aevion/openapi.json`;
  const curl = `curl -s '${fullUrl}' | jq .`;
  const rapidoc = `<rapi-doc spec-url="${fullUrl}" theme="light" render-style="read"></rapi-doc>
<script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>`;

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const pathCount = Object.keys(view.paths).length;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/developers" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← Developers
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            OpenAPI explorer
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Live aggregate of every AEVION module&apos;s OpenAPI spec, served from{" "}
            <code
              style={{
                background: "rgba(15,23,42,0.06)",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              GET /api/aevion/openapi.json
            </code>
            . Browse endpoints across all products in one place, or jump straight to a module&apos;s
            own spec.
          </p>
        </div>

        {/* Snippets */}
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          <CopyCard label="URL" body={fullUrl} copied={copied} onCopy={copy} copyKey="url" />
          <CopyCard label="curl" body={curl} copied={copied} onCopy={copy} copyKey="curl" />
          <CopyCard
            label="Swagger / RapiDoc embed"
            body={rapidoc}
            copied={copied}
            onCopy={copy}
            copyKey="rapidoc"
          />
        </div>

        {/* Header card */}
        <div
          style={{
            padding: "20px 22px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 18,
          }}
        >
          {loading && !spec && (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>Loading spec…</div>
          )}
          {error && !spec && (
            <div style={{ fontSize: 13, color: "#ef4444" }}>
              Probe failed: {error}
            </div>
          )}
          {spec && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {view.title}
                </h2>
                {view.version && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "rgba(13,148,136,0.12)",
                      color: "#0d9488",
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: "monospace",
                    }}
                  >
                    v{view.version}
                  </span>
                )}
                {spec.openapi && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "rgba(15,23,42,0.06)",
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "monospace",
                    }}
                  >
                    OpenAPI {spec.openapi}
                  </span>
                )}
              </div>
              {view.description && (
                <p
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: 13,
                    color: "#475569",
                    lineHeight: 1.6,
                  }}
                >
                  {view.description}
                </p>
              )}
              {view.servers.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    Servers
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {view.servers.map((s) => (
                      <code
                        key={s.url}
                        style={{
                          fontSize: 11.5,
                          padding: "3px 8px",
                          background: "rgba(15,23,42,0.06)",
                          borderRadius: 6,
                          color: "#0f172a",
                          fontFamily: "monospace",
                        }}
                        title={s.description || ""}
                      >
                        {s.url}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  fontSize: 11,
                  color: "#94a3b8",
                  fontFamily: "monospace",
                  marginTop: 8,
                }}
              >
                <span>{pathCount} paths</span>
                <span>{view.modules.length} module specs</span>
                <span>{view.services.length} services</span>
                {view.generatedAt && (
                  <span>generated {new Date(view.generatedAt).toLocaleString()}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Endpoints */}
        <div
          style={{
            padding: "18px 20px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                flex: 1,
                minWidth: 120,
              }}
            >
              Endpoints{" "}
              <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: 13 }}>
                ({filteredPaths.length}/{pathCount})
              </span>
            </h3>
            <input
              type="text"
              placeholder="Filter by path substring…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "7px 10px",
                fontSize: 13,
                border: "1px solid rgba(15,23,42,0.16)",
                borderRadius: 8,
                outline: "none",
                minWidth: 240,
              }}
            />
          </div>

          {pathCount === 0 ? (
            <div
              style={{
                padding: "20px 0",
                fontSize: 13,
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              {loading
                ? "Loading…"
                : "The aggregate spec contains no top-level paths — it indexes per-module specs instead. See the section below."}
            </div>
          ) : filteredPaths.length === 0 ? (
            <div
              style={{
                padding: "20px 0",
                fontSize: 13,
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              No paths match &quot;{search}&quot;.
            </div>
          ) : (
            filteredPaths
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([p, item]) => <PathRow key={p} path={p} item={item} />)
          )}
        </div>

        {/* Per-module specs */}
        {view.modules.length > 0 && (
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                margin: "0 0 4px 0",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              Per-module OpenAPI specs
            </h3>
            <p
              style={{
                margin: "0 0 14px 0",
                fontSize: 12.5,
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              Each AEVION product self-serves its own OpenAPI 3.x spec. Open directly for Swagger / RapiDoc / Insomnia / Postman.
            </p>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {view.modules.map((m) => (
                <a
                  key={m.id}
                  href={m.spec || "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid rgba(15,23,42,0.08)",
                    textDecoration: "none",
                    color: "#0f172a",
                    transition: "border-color 120ms",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{m.title || m.id}</span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        color: "#94a3b8",
                        fontFamily: "monospace",
                      }}
                    >
                      ↗
                    </span>
                  </div>
                  <code
                    style={{
                      fontSize: 10.5,
                      color: "#64748b",
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                      lineHeight: 1.4,
                    }}
                  >
                    {m.spec || "(no spec URL)"}
                  </code>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Per-service health */}
        {view.services.length > 0 && (
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                margin: "0 0 4px 0",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              Service health endpoints
            </h3>
            <p
              style={{
                margin: "0 0 14px 0",
                fontSize: 12.5,
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              Liveness probes for each module. Aggregated dashboard at{" "}
              <Link href="/api-explorer/health" style={{ color: "#0d9488" }}>
                /api-explorer/health
              </Link>
              .
            </p>
            <div
              style={{
                display: "grid",
                gap: 6,
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              }}
            >
              {view.services.map((s) => (
                <a
                  key={s.id}
                  href={s.health || "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 10px",
                    borderRadius: 6,
                    background: "#f8fafc",
                    border: "1px solid rgba(15,23,42,0.08)",
                    textDecoration: "none",
                    color: "#0f172a",
                    fontSize: 12.5,
                    fontFamily: "monospace",
                  }}
                >
                  <span style={{ flex: 1 }}>{s.id}</span>
                  <span style={{ color: "#94a3b8", fontSize: 10 }}>↗</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* SDK */}
        {view.sdkNpm.length > 0 && (
          <div
            style={{
              padding: "14px 18px",
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
                color: "#0d9488",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Published TypeScript clients
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {view.sdkNpm.map((pkg) => (
                <a
                  key={pkg}
                  href={`https://www.npmjs.com/package/${pkg}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "3px 9px",
                    borderRadius: 6,
                    background: "#fff",
                    border: "1px solid rgba(13,148,136,0.3)",
                    color: "#0d9488",
                    fontSize: 11.5,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {pkg}
                </a>
              ))}
            </div>
            {view.sdkDocs && (
              <a
                href={view.sdkDocs}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11.5, color: "#0d9488", textDecoration: "none" }}
              >
                SDK docs →
              </a>
            )}
          </div>
        )}

        {/* Raw JSON */}
        {spec && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              marginBottom: 18,
            }}
          >
            <button
              type="button"
              onClick={() => setRawOpen((v) => !v)}
              style={{
                width: "100%",
                padding: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              <span>Raw spec JSON</span>
              <span
                style={{
                  fontSize: 10,
                  color: "#94a3b8",
                  fontFamily: "monospace",
                  marginLeft: "auto",
                }}
              >
                {rawOpen ? "▼" : "▶"}
              </span>
            </button>
            {rawOpen && (
              <pre
                style={{
                  margin: "10px 0 0 0",
                  padding: 12,
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  maxHeight: 520,
                  overflow: "auto",
                  lineHeight: 1.5,
                }}
              >
                {JSON.stringify(spec, null, 2).slice(0, 60_000)}
              </pre>
            )}
          </div>
        )}

        {/* Footer crosslinks */}
        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: "#94a3b8",
            lineHeight: 1.8,
          }}
        >
          Source: <code>GET /api/aevion/openapi.json</code> ·{" "}
          <Link href="/api-explorer/catalog" style={{ color: "#0d9488" }}>
            Catalog explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/badges" style={{ color: "#0d9488" }}>
            Badge builder
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/health" style={{ color: "#0d9488" }}>
            Health dashboard
          </Link>{" "}
          ·{" "}
          <Link href="/sitemap" style={{ color: "#0d9488" }}>
            Sitemap
          </Link>{" "}
          ·{" "}
          <Link href="/status" style={{ color: "#0d9488" }}>
            Public status
          </Link>
        </div>
      </div>
    </main>
  );
}
