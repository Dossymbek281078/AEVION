"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, getApiBase } from "@/lib/apiBase";

/* ----------------------------- types ----------------------------- */

interface VersionInfo {
  node: string;
  env: string;
  uptimeSec: number;
  release: string | null;
  // tolerate optional extras the backend currently returns
  service?: string;
  pid?: number;
  commit?: string | null;
  timestamp?: string;
}

interface SdkManifest {
  npm: string[];
  docs?: string;
}

interface OpenApiIndexShape {
  aevion?: {
    sdk?: SdkManifest;
  };
  // SDK manifest may also live at top-level on some shapes
  sdk?: SdkManifest;
}

/* --------------------------- helpers ---------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

function parseNodeMajor(node: string | undefined): number | null {
  if (!node) return null;
  const m = node.match(/v?(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function envColor(env: string | undefined): string {
  const e = (env || "").toLowerCase();
  if (e === "production" || e === "prod") return "#10b981";
  if (e === "staging" || e === "stage" || e === "preview") return "#f59e0b";
  if (e === "development" || e === "dev" || e === "local") return "#f59e0b";
  return "#64748b";
}

function shortSha(sha: string | null | undefined): string {
  if (!sha) return "n/a";
  return sha.length > 8 ? sha.slice(0, 8) : sha;
}

function normaliseSdk(raw: unknown): SdkManifest | null {
  if (!isRecord(raw)) return null;
  const npmRaw = raw.npm;
  if (!Array.isArray(npmRaw)) return null;
  const npm: string[] = [];
  for (const item of npmRaw) {
    if (typeof item === "string" && item.trim()) npm.push(item.trim());
  }
  const docs = typeof raw.docs === "string" ? raw.docs : undefined;
  return { npm, docs };
}

function deriveSdk(index: OpenApiIndexShape | null): SdkManifest {
  if (!index) return { npm: [] };
  const fromAev = normaliseSdk(index.aevion?.sdk);
  if (fromAev) return fromAev;
  const fromTop = normaliseSdk(index.sdk);
  if (fromTop) return fromTop;
  return { npm: [] };
}

/* ------------------------- subcomponents ------------------------ */

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

function StatCell({
  label,
  value,
  dotColor,
  tooltip,
  mono,
  trailing,
}: {
  label: string;
  value: string;
  dotColor?: string;
  tooltip?: string;
  mono?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
      title={tooltip}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {dotColor && (
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: dotColor,
              boxShadow: `0 0 0 3px ${dotColor}25`,
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#0f172a",
            fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
        >
          {value}
        </span>
        {trailing}
      </div>
    </div>
  );
}

/* ----------------------------- page ----------------------------- */

export default function VersionExplorerPage() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [sdk, setSdk] = useState<SdkManifest>({ npm: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Tick every 30s to keep the displayed uptime fresh (it advances locally
  // between fetches — version is static between deploys so we don't re-fetch).
  const [, setNowTick] = useState(0);

  const apiBase = getApiBase();
  const fullUrl = `${apiBase}/api/aevion/version`;
  const curl = `curl -s '${fullUrl}' | jq .`;
  const sdkSnippet = `import { AevionCatalog } from "@aevion-io/catalog-client";
const cat = new AevionCatalog();
const info = await cat.openapi();
// info.aevion.sdk.npm  → published TS clients
// info.aevion.version  → API index version`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [verRes, openRes] = await Promise.all([
        fetch(apiUrl("/api/aevion/version")),
        fetch(apiUrl("/api/aevion/openapi.json")),
      ]);
      if (!verRes.ok) throw new Error("version HTTP " + verRes.status);
      const verJson = (await verRes.json()) as VersionInfo;
      setVersion(verJson);

      if (openRes.ok) {
        const openJson = (await openRes.json()) as OpenApiIndexShape;
        setSdk(deriveSdk(openJson));
      } else {
        setSdk({ npm: [] });
      }
      setError(null);
      setLastFetched(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // Adjust uptime by the wall-clock drift since we fetched it, so the hero
  // pill doesn't appear frozen.
  const effectiveUptime = useMemo(() => {
    if (!version) return 0;
    if (!lastFetched) return version.uptimeSec;
    const drift = Math.max(0, Math.floor((Date.now() - lastFetched) / 1000));
    return version.uptimeSec + drift;
  }, [version, lastFetched]);

  const nodeMajor = parseNodeMajor(version?.node);
  const nodeOk = nodeMajor !== null && nodeMajor >= 20;
  const nodeDot = nodeOk ? "#10b981" : "#f59e0b";

  const envName = version?.env || "unknown";
  const envDot = envColor(version?.env);

  const heroPillBg = `${envDot}18`;
  const heroPillColor = envDot;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/developers" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← Developers
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: "8px 0", letterSpacing: "-0.02em" }}>
            Version & SDK explorer
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            Build info for{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              GET /api/aevion/version
            </code>{" "}
            plus the live list of published TypeScript clients, pulled from{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>
              /api/aevion/openapi.json
            </code>
            . Version is static between deploys — use the refresh button if you just shipped.
          </p>
        </div>

        {/* Snippets */}
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          <CopyCard label="URL" body={fullUrl} copied={copied} onCopy={copy} copyKey="url" />
          <CopyCard label="curl" body={curl} copied={copied} onCopy={copy} copyKey="curl" />
          <CopyCard
            label="@aevion-io/catalog-client (same info)"
            body={sdkSnippet}
            copied={copied}
            onCopy={copy}
            copyKey="sdk"
          />
        </div>

        {/* Hero card */}
        <div
          style={{
            padding: "26px 28px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              {version?.service || "aevion-hub"}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: "#0f172a",
              }}
            >
              AEVION Backend
            </h2>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: heroPillBg,
                  color: heroPillColor,
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {envName}
              </span>
              {version && (
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(15,23,42,0.06)",
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  }}
                  title={`Precise: ${version.uptimeSec}s (at last fetch)`}
                >
                  up {formatUptime(effectiveUptime)}
                </span>
              )}
              {loading && !version && (
                <span style={{ fontSize: 11, color: "#0d9488", fontFamily: "monospace" }}>loading…</span>
              )}
              {error && !version && (
                <span style={{ fontSize: 11, color: "#ef4444", fontFamily: "monospace" }}>
                  Probe failed: {error}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "1px solid rgba(13,148,136,0.3)",
              background: loading ? "rgba(13,148,136,0.06)" : "#0d9488",
              color: loading ? "#0d9488" : "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Detail grid */}
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            marginBottom: 22,
          }}
        >
          <StatCell
            label="Node version"
            value={version?.node || "—"}
            dotColor={version ? nodeDot : undefined}
            mono
            tooltip={nodeOk ? "Node ≥ 20" : "Node < 20"}
          />
          <StatCell
            label="Environment"
            value={envName}
            dotColor={version ? envDot : undefined}
          />
          <StatCell
            label="Uptime"
            value={version ? formatUptime(effectiveUptime) : "—"}
            tooltip={
              version
                ? `Precise: ${version.uptimeSec}s at last fetch${
                    lastFetched ? ` (${new Date(lastFetched).toLocaleTimeString()})` : ""
                  }`
                : undefined
            }
            mono
          />
          <StatCell
            label="Release SHA"
            value={shortSha(version?.release)}
            mono
            trailing={
              version?.release ? (
                <button
                  type="button"
                  onClick={() => copy(version.release || "", "release")}
                  style={{
                    marginLeft: "auto",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: copied === "release" ? "#10b981" : "rgba(15,23,42,0.06)",
                    color: copied === "release" ? "#fff" : "#475569",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {copied === "release" ? "✓" : "Copy"}
                </button>
              ) : undefined
            }
          />
        </div>

        {/* SDK section */}
        <div
          style={{
            padding: "20px 22px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              Published SDKs
            </h3>
            <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
              {sdk.npm.length} package{sdk.npm.length === 1 ? "" : "s"}
            </span>
            {sdk.docs && (
              <a
                href={sdk.docs}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "#0d9488",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                SDK docs ↗
              </a>
            )}
          </div>
          <p
            style={{
              margin: "0 0 14px 0",
              fontSize: 12.5,
              color: "#64748b",
              lineHeight: 1.6,
            }}
          >
            Sourced live from{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "1px 5px", borderRadius: 4 }}>
              aevion.sdk.npm
            </code>{" "}
            in the aggregate OpenAPI index. Each card has a one-line install snippet.
          </p>

          {sdk.npm.length === 0 ? (
            <div
              style={{
                padding: "24px 0",
                fontSize: 13,
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              {loading ? "Loading SDK manifest…" : "No SDKs published in the manifest yet."}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {sdk.npm.map((pkg) => {
                const installCmd = `npm i ${pkg}`;
                const npmUrl = `https://npmjs.com/package/${pkg}`;
                const key = `pkg:${pkg}`;
                return (
                  <div
                    key={pkg}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "#f8fafc",
                      border: "1px solid rgba(15,23,42,0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <code
                        style={{
                          fontSize: 13,
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          fontWeight: 800,
                          color: "#0f172a",
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pkg}
                      </code>
                      <a
                        href={npmUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 10,
                          color: "#0d9488",
                          textDecoration: "none",
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: "1px solid rgba(13,148,136,0.3)",
                          background: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        npm ↗
                      </a>
                    </div>
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "#0f172a",
                        color: "#e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: "#94a3b8",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          flexShrink: 0,
                        }}
                      >
                        Install
                      </span>
                      <code
                        style={{
                          fontSize: 11.5,
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {installCmd}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(installCmd, key)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: copied === key ? "#10b981" : "rgba(255,255,255,0.08)",
                          color: copied === key ? "#0f172a" : "#e2e8f0",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 10,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {copied === key ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Raw payload */}
        {version && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
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
                marginBottom: 8,
                fontSize: 11,
                color: "#64748b",
              }}
            >
              <span style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Raw response
              </span>
              {lastFetched && (
                <span style={{ fontFamily: "monospace" }}>
                  fetched {new Date(lastFetched).toLocaleTimeString()}
                </span>
              )}
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
                maxHeight: 280,
                overflow: "auto",
                lineHeight: 1.5,
              }}
            >
              {JSON.stringify(version, null, 2)}
            </pre>
          </div>
        )}

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
            marginBottom: 14,
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
            Tip
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
            Use the release SHA to pin a client to a specific deploy when filing bug reports, or to
            verify a rollout in production. Uptime resets on every Railway redeploy — a short uptime
            on a non-staging env usually means a deploy landed within the last few minutes.
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
          Source: <code>GET /api/aevion/version</code> +{" "}
          <code>GET /api/aevion/openapi.json</code> ·{" "}
          <Link href="/api-explorer/catalog" style={{ color: "#0d9488" }}>
            Catalog explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/health" style={{ color: "#0d9488" }}>
            Health dashboard
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/openapi" style={{ color: "#0d9488" }}>
            OpenAPI explorer
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/badges" style={{ color: "#0d9488" }}>
            Badge builder
          </Link>{" "}
          ·{" "}
          <Link href="/api-explorer/sitemap" style={{ color: "#0d9488" }}>
            Sitemap explorer
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
