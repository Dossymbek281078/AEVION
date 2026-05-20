import type { Metadata } from "next";
import Link from "next/link";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getApiBase } from "@/lib/apiBase";

/* ----------------------------- ISR ----------------------------- */

export const revalidate = 3600;

/* ----------------------------- metadata ----------------------------- */

export const metadata: Metadata = {
  title: "@aevion-io/catalog-client — TypeScript SDK for AEVION Hub",
  description:
    "Zero-dependency, strict-typed client for the AEVION module catalog API. npm install @aevion-io/catalog-client.",
  alternates: { canonical: "/sdk" },
  openGraph: {
    title: "@aevion-io/catalog-client",
    description: "Zero-dep TypeScript SDK for AEVION Hub.",
    siteName: "AEVION",
  },
};

/* ----------------------------- tokens ----------------------------- */

const TEAL = "#0d9488";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const GREEN = "#10b981";
const BG = "#f8fafc";
const CARD_BORDER = "rgba(15,23,42,0.08)";

const FALLBACK_VERSION = "0.5.0";

const COOKBOOK_URL =
  "https://github.com/Dossymbek281078/AEVION/blob/main/docs/SDK_USAGE.md";
const GITHUB_PACKAGE_URL =
  "https://github.com/Dossymbek281078/AEVION/tree/main/packages/aevion-catalog-client";

/* ----------------------------- types ----------------------------- */

interface ChangelogEntry {
  version: string;
  date: string;
  bullets: string[];
}

interface RegistryStatsLite {
  total: number;
  statuses: number;
}

/* ----------------------------- helpers ----------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readPackageVersion(): Promise<string> {
  try {
    const pkgPath = path.join(
      process.cwd(),
      "..",
      "packages",
      "aevion-catalog-client",
      "package.json",
    );
    const raw = await fs.readFile(pkgPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed.version === "string") {
      return parsed.version;
    }
  } catch {
    // fall through
  }
  return FALLBACK_VERSION;
}

async function readChangelog(): Promise<ChangelogEntry[]> {
  try {
    const cp = path.join(
      process.cwd(),
      "..",
      "packages",
      "aevion-catalog-client",
      "CHANGELOG.md",
    );
    const raw = await fs.readFile(cp, "utf8");
    return parseChangelog(raw).slice(0, 4);
  } catch {
    return [];
  }
}

/**
 * Parses CHANGELOG.md sections in the form `## [x.y.z] — YYYY-MM-DD` and
 * collects bullet lines (`- foo`) under each. `### Added` etc. headings are skipped.
 */
function parseChangelog(md: string): ChangelogEntry[] {
  const lines = md.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  // Accept en-dash (—), em-dash (—), or hyphen as the version/date separator
  const headRe = /^##\s+\[([^\]]+)\]\s*[—\-–]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/;
  const bulletRe = /^\s*-\s+(.+?)\s*$/;

  for (const line of lines) {
    const headMatch = line.match(headRe);
    if (headMatch) {
      if (current) entries.push(current);
      current = { version: headMatch[1], date: headMatch[2], bullets: [] };
      continue;
    }
    if (!current) continue;
    if (/^###\s/.test(line)) continue; // skip "### Added"
    const bulletMatch = line.match(bulletRe);
    if (bulletMatch) {
      // Strip backtick wrappers for cleaner card text but keep the rest
      const text = bulletMatch[1].replace(/\s+/g, " ").trim();
      if (text) current.bullets.push(text);
    }
  }
  if (current) entries.push(current);
  return entries;
}

async function readRegistryStats(): Promise<RegistryStatsLite | null> {
  try {
    const url = `${getApiBase()}/api/aevion/registry-stats`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!isRecord(data)) return null;

    const total = typeof data.total === "number" ? data.total : null;

    let statusCount: number | null = null;
    if (isRecord(data.byStatus)) {
      statusCount = Object.keys(data.byStatus).length;
    } else if (Array.isArray(data.byStatus)) {
      statusCount = data.byStatus.length;
    }

    if (total === null || statusCount === null) return null;
    return { total, statuses: statusCount };
  } catch {
    return null;
  }
}

/* ----------------------------- static content ----------------------------- */

const INSTALL_LINE = "npm i @aevion-io/catalog-client";

const QUICK_START = `import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const live = await cat.mvpsAndLaunched();   // status: mvp | launched
const security = await cat.searchByTag("security");
const stats = await cat.stats();
const badge = cat.badgeUrl("qsign");        // shields.io-style SVG URL

console.log(\`\${stats.total} modules, \${live.length} live\`);`;

const WHY = [
  {
    title: "Zero runtime dependencies",
    body: "Uses the global fetch. Node 18+ and modern browsers — no transitive deps, no native modules.",
  },
  {
    title: "Strict TypeScript types",
    body: "Every response is typed end-to-end. No any. Field projection narrows the return type for you.",
  },
  {
    title: "Node, browser, edge",
    body: "Pure-fetch core works in Vercel Edge, Cloudflare Workers, Deno, Bun, and the browser.",
  },
  {
    title: "Live ecosystem catalog",
    body: "One client for every AEVION module — status, tags, kind, OpenAPI, OG, health, sitemap, badges.",
  },
];

const API_GROUPS: { group: string; methods: { name: string; desc: string }[] }[] = [
  {
    group: "Read",
    methods: [
      { name: "list(opts?)", desc: "Filtered list with optional field projection." },
      { name: "get(id)", desc: "Single-module deep lookup. Throws on 404." },
      { name: "stats()", desc: "Taxonomy: byStatus, byKind, top tags, total." },
      { name: "health()", desc: "Aggregate per-service probe (ok/degraded/down)." },
    ],
  },
  {
    group: "Helpers",
    methods: [
      { name: "searchByTag(tag)", desc: "List filtered by any-tag match." },
      { name: "byStatus(status)", desc: "List filtered by one or more statuses." },
      { name: "byKind(kind)", desc: "List filtered by one or more kinds." },
      { name: "mvpsAndLaunched()", desc: "Sugar — everything that's live." },
      { name: "topTags(n)", desc: "Top-N tags computed client-side from stats()." },
    ],
  },
  {
    group: "Hub aggregates",
    methods: [
      { name: "openapi()", desc: "AEVION aggregate OpenAPI 3.1 index across modules." },
      { name: "sitemap()", desc: "Parsed /api/aevion/sitemap.xml as SitemapEntry[]." },
    ],
  },
  {
    group: "Graph",
    methods: [
      { name: "relatedModules(id)", desc: "Server-computed related modules for one id." },
      { name: "graph(opts?)", desc: "Full tag-overlap graph — top-K edges per node." },
      { name: "neighbours(id, opts?)", desc: "Single-source neighbours by Jaccard similarity." },
    ],
  },
  {
    group: "Search & diff",
    methods: [
      { name: "findByText(query, opts?)", desc: "Substring search across name/code/tags/description." },
      { name: "diff(idA, idB)", desc: "Field equality + tag-set Jaccard with shared/onlyA/onlyB." },
      { name: "fingerprintModule(id)", desc: "Stable djb2 content hash for cache invalidation." },
    ],
  },
  {
    group: "URL builders",
    methods: [
      { name: "csvUrl(opts?)", desc: "Builds a CSV download URL — no network round-trip." },
      { name: "markdownUrl(opts?)", desc: "Builds a Markdown export URL — great for README tables." },
      { name: "badgeUrl(id)", desc: "Builds the shields.io-style SVG badge URL for a module." },
    ],
  },
];

const BOTTOM_CTAS = [
  { label: "Try it live →", href: "/api-explorer/sdk", external: false, accent: TEAL },
  { label: "Browse explorer →", href: "/api-explorer", external: false, accent: "#0ea5e9" },
  { label: "GitHub source →", href: GITHUB_PACKAGE_URL, external: true, accent: "#475569" },
  { label: "Cookbook →", href: COOKBOOK_URL, external: true, accent: "#8b5cf6" },
] as const;

/* ----------------------------- subcomponents ----------------------------- */

function VersionPill({ version }: { version: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.16)",
        color: "#fff",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.02em",
        border: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: GREEN,
          boxShadow: "0 0 0 3px rgba(16,185,129,0.25)",
        }}
      />
      v{version}
    </span>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.2em",
          color: TEAL,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          margin: 0,
          letterSpacing: "-0.02em",
          color: TEXT,
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function CodeCard({
  label,
  body,
  size = 13,
}: {
  label?: string;
  body: string;
  size?: number;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(15,23,42,0.1)",
        background: "#0f172a",
      }}
    >
      {label && (
        <div
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 800,
            color: "#94a3b8",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {label}
        </div>
      )}
      <pre
        style={{
          margin: 0,
          padding: "16px 18px",
          fontSize: size,
          lineHeight: 1.65,
          color: "#e2e8f0",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          overflowX: "auto",
        }}
      >
        {body}
      </pre>
    </div>
  );
}

/* ----------------------------- page ----------------------------- */

export default async function SdkLandingPage() {
  const [version, changelog, registryStats] = await Promise.all([
    readPackageVersion(),
    readChangelog(),
    readRegistryStats(),
  ]);

  return (
    <main style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      {/* Hero — full bleed */}
      <section
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, rgba(16,185,129,0.45), transparent), linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)",
          color: "#fff",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 20px 72px" }}>
          <Link
            href="/developers"
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            ← Developers
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 18,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.78)",
              }}
            >
              AEVION TypeScript SDK
            </span>
            <VersionPill version={version} />
          </div>

          <h1
            style={{
              fontSize: "clamp(34px, 5.2vw, 64px)",
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: "-0.045em",
              margin: "14px 0 16px",
              color: "#fff",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            @aevion-io/catalog-client
          </h1>
          <p
            style={{
              fontSize: "clamp(15px, 1.8vw, 19px)",
              color: "rgba(255,255,255,0.85)",
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 760,
              fontWeight: 500,
            }}
          >
            Zero-dependency TypeScript SDK for the AEVION Hub catalog API.
          </p>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/api-explorer/sdk"
              style={{
                padding: "12px 22px",
                borderRadius: 10,
                background: "#fff",
                color: TEXT,
                fontWeight: 800,
                fontSize: 14,
                textDecoration: "none",
                letterSpacing: "0.01em",
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.45)",
              }}
            >
              Try it live →
            </Link>
            <a
              href={COOKBOOK_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "12px 22px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                textDecoration: "none",
                letterSpacing: "0.01em",
                border: "1px solid rgba(255,255,255,0.28)",
              }}
            >
              Read the cookbook
            </a>
          </div>

          {registryStats && (
            <div
              style={{
                marginTop: 28,
                display: "inline-flex",
                gap: 16,
                padding: "10px 16px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 12.5,
                color: "rgba(255,255,255,0.9)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span>
                <strong style={{ color: "#fff" }}>{registryStats.total}</strong> modules
              </span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>
                <strong style={{ color: "#fff" }}>{registryStats.statuses}</strong> statuses
              </span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ opacity: 0.85 }}>refreshed daily</span>
            </div>
          )}
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px 80px" }}>
        {/* Install */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle kicker="Step 1" title="Install" />
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "#0f172a",
              color: "#e2e8f0",
              border: "1px solid rgba(13,148,136,0.4)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
            >
              bash
            </span>
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 15,
                color: "#5eead4",
                flex: 1,
                minWidth: 0,
              }}
            >
              {INSTALL_LINE}
            </code>
            <span
              style={{
                fontSize: 11,
                color: "#94a3b8",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              Node 18+ · 0 deps
            </span>
          </div>
        </section>

        {/* Quick start */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle kicker="Step 2" title="Quick start" />
          <CodeCard label="TypeScript" body={QUICK_START} />
        </section>

        {/* Why */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle kicker="Why" title="Why this SDK" />
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
            }}
          >
            {WHY.map((card) => (
              <div
                key={card.title}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: "#fff",
                  border: `1px solid ${CARD_BORDER}`,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: TEXT,
                    marginBottom: 6,
                  }}
                >
                  {card.title}
                </div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>{card.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* API surface */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle kicker="Reference" title="API surface" />
          <div
            style={{
              borderRadius: 14,
              background: "#fff",
              border: `1px solid ${CARD_BORDER}`,
              overflow: "hidden",
            }}
          >
            {API_GROUPS.map((g, idx) => (
              <div
                key={g.group}
                style={{
                  padding: "14px 18px",
                  borderTop: idx === 0 ? "none" : `1px solid ${CARD_BORDER}`,
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "minmax(140px, 180px) 1fr",
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: TEAL,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    paddingTop: 4,
                  }}
                >
                  {g.group}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {g.methods.map((m) => (
                    <div
                      key={m.name}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(180px, 240px) 1fr",
                        gap: 14,
                        alignItems: "baseline",
                      }}
                    >
                      <code
                        style={{
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          fontSize: 13,
                          color: TEXT,
                          fontWeight: 700,
                        }}
                      >
                        {m.name}
                      </code>
                      <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                        {m.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live status */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle kicker="Live" title="Live status" />
          <div
            style={{
              padding: 22,
              borderRadius: 14,
              background: "#fff",
              border: `1px solid ${CARD_BORDER}`,
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: registryStats ? GREEN : "#94a3b8",
                boxShadow: registryStats ? "0 0 0 4px rgba(16,185,129,0.18)" : "none",
              }}
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              {registryStats ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>
                    {registryStats.total} modules across {registryStats.statuses} statuses
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                    Refreshed daily from <code style={{ fontFamily: "ui-monospace, monospace" }}>/api/aevion/registry-stats</code>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>
                    Live registry stats unavailable
                  </div>
                  <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                    The Hub catalog endpoint did not respond during build. Try the live playground.
                  </div>
                </>
              )}
            </div>
            <Link
              href="/api-explorer/sdk"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: TEAL,
                color: "#fff",
                fontWeight: 800,
                fontSize: 12.5,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Open playground →
            </Link>
          </div>
        </section>

        {/* Versions */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle kicker="Versions" title="Recent releases" />
          {changelog.length === 0 ? (
            <div
              style={{
                padding: 18,
                borderRadius: 14,
                background: "#fff",
                border: `1px solid ${CARD_BORDER}`,
                fontSize: 13,
                color: MUTED,
              }}
            >
              Changelog unavailable at build time. See{" "}
              <a
                href={`${GITHUB_PACKAGE_URL}/blob/main/CHANGELOG.md`}
                target="_blank"
                rel="noreferrer"
                style={{ color: TEAL, fontWeight: 700, textDecoration: "underline" }}
              >
                CHANGELOG.md on GitHub
              </a>
              .
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              }}
            >
              {changelog.map((entry, idx) => (
                <div
                  key={entry.version}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    background: "#fff",
                    border: idx === 0 ? `1px solid ${TEAL}55` : `1px solid ${CARD_BORDER}`,
                    boxShadow: idx === 0 ? "0 8px 24px -16px rgba(13,148,136,0.45)" : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        fontSize: 16,
                        fontWeight: 900,
                        color: idx === 0 ? TEAL : TEXT,
                      }}
                    >
                      v{entry.version}
                    </span>
                    {idx === 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: "#fff",
                          background: TEAL,
                          padding: "2px 7px",
                          borderRadius: 999,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Latest
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        color: MUTED,
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        marginLeft: "auto",
                      }}
                    >
                      {entry.date}
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {entry.bullets.slice(0, 5).map((b, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 12.5,
                          color: "#334155",
                          lineHeight: 1.5,
                          paddingLeft: 14,
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 8,
                            width: 5,
                            height: 5,
                            borderRadius: 999,
                            background: TEAL,
                          }}
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bottom CTAs */}
        <section>
          <SectionTitle kicker="Next" title="Where to next" />
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            }}
          >
            {BOTTOM_CTAS.map((cta) =>
              cta.external ? (
                <a
                  key={cta.label}
                  href={cta.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    padding: 18,
                    borderRadius: 14,
                    background: "#fff",
                    border: `1px solid ${cta.accent}40`,
                    textDecoration: "none",
                    color: TEXT,
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: cta.accent }}>{cta.label}</span>
                </a>
              ) : (
                <Link
                  key={cta.label}
                  href={cta.href}
                  style={{
                    display: "block",
                    padding: 18,
                    borderRadius: 14,
                    background: "#fff",
                    border: `1px solid ${cta.accent}40`,
                    textDecoration: "none",
                    color: TEXT,
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: cta.accent }}>{cta.label}</span>
                </Link>
              ),
            )}
          </div>
        </section>

        <div
          style={{
            marginTop: 36,
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          SDK: <code style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>@aevion-io/catalog-client</code>
          {" "}· MIT · <Link href="/developers" style={{ color: TEAL }}>Developers</Link>
          {" "}· <Link href="/changelog" style={{ color: TEAL }}>Platform changelog</Link>
          {" "}· <Link href="/status" style={{ color: TEAL }}>Public status</Link>
        </div>
      </div>
    </main>
  );
}
