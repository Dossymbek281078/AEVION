import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const metadata: Metadata = {
  title: "AEVION API explorer — interactive playground for the Hub catalog",
  description:
    "Interactive tools for the AEVION Hub API: build catalog queries with chip filters, generate ready-made Markdown/HTML badges, see live responses with copyable curl + SDK snippets.",
  alternates: { canonical: "/api-explorer" },
  openGraph: {
    title: "AEVION API explorer",
    description: "Build queries against /api/aevion/catalog. Live preview. Copy curl + SDK snippets.",
    type: "website",
    siteName: "AEVION",
  },
};

export const revalidate = 3600;

type RegistryStats = { total: number; byStatus: Record<string, number> } | null;

async function fetchStats(): Promise<RegistryStats> {
  try {
    const r = await fetch(`${getApiBase()}/api/aevion/registry-stats`, {
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    return (await r.json()) as RegistryStats;
  } catch {
    return null;
  }
}

const CARDS = [
  {
    href: "/api-explorer/catalog",
    title: "Catalog explorer",
    blurb:
      "Build queries against /api/aevion/catalog with chip filters (status, kind, tag, projection, format). Live response preview, copyable URL + curl + TypeScript SDK snippet.",
    cta: "Open catalog explorer",
    accent: "#0d9488",
  },
  {
    href: "/api-explorer/badges",
    title: "Badge builder",
    blurb:
      "Pick modules from a searchable checklist → copy ready-made Markdown or HTML embedding shields.io-style SVG badges that auto-update with module status.",
    cta: "Open badge builder",
    accent: "#8b5cf6",
  },
  {
    href: "/api-explorer/health",
    title: "Health dashboard",
    blurb:
      "Live per-service latency sparklines across the AEVION fleet — a dev-focused complement to /status with response-time history and error counters.",
    cta: "Open health dashboard",
    accent: "#06b6d4",
  },
  {
    href: "/api-explorer/openapi",
    title: "OpenAPI inspector",
    blurb:
      "Aggregate API index across 19 modules and 30 services. Browse endpoints grouped by tag, inspect operations, copy paths into your client of choice.",
    cta: "Open OpenAPI inspector",
    accent: "#f59e0b",
  },
  {
    href: "/api-explorer/sitemap",
    title: "Sitemap viewer",
    blurb:
      "Parsed urlset rendered with priority bars and group-by toggles (path, changefreq, month). Quick way to audit indexable coverage end-to-end.",
    cta: "Open sitemap viewer",
    accent: "#0ea5e9",
  },
  {
    href: "/api-explorer/version",
    title: "Version + SDKs",
    blurb:
      "Backend uptime, release SHA, build timestamp and the catalogue of published TypeScript clients — one place to verify what's deployed and what's installable.",
    cta: "Open version + SDKs",
    accent: "#ec4899",
  },
  {
    href: "/api-explorer/sdk",
    title: "SDK playground",
    blurb:
      "Live demo of every @aevion/catalog-client method via dropdown. Pick a method, see the request, the response and the exact TypeScript snippet to copy.",
    cta: "Open SDK playground",
    accent: "#3b82f6",
  },
  {
    href: "/api-explorer/graph",
    title: "Module graph",
    blurb:
      "SVG force-directed visualisation of tag-overlap (Jaccard) similarity. Drag nodes, hover edges, see which modules cluster around shared concepts.",
    cta: "Open module graph",
    accent: "#f43f5e",
  },
  {
    href: "/api-explorer/diff",
    title: "Module diff",
    blurb:
      "Side-by-side compare two modules — field-by-field equality plus tag-Jaccard overlap. Spot drift, audit parity, document the deltas in one screen.",
    cta: "Open module diff",
    accent: "#22c55e",
  },
  {
    href: "/api-explorer/search",
    title: "Module search",
    blurb:
      "Live full-text search across name, code, description and tags with a relevance score per hit. Type to filter the catalogue in real time.",
    cta: "Open module search",
    accent: "#f97316",
  },
];

export default async function ApiExplorerIndexPage() {
  const stats = await fetchStats();
  const total = stats?.total ?? 29;
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "60px 20px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/developers" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
            ← Developers
          </Link>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 900,
              margin: "10px 0 12px",
              letterSpacing: "-0.02em",
            }}
          >
            AEVION API explorer
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "#475569",
              margin: 0,
              maxWidth: 760,
              lineHeight: 1.65,
            }}
          >
            Interactive tools for the{" "}
            <Link href="/developers" style={{ color: "#0d9488", fontWeight: 700 }}>
              AEVION Hub API
            </Link>
            . {total} modules, one taxonomy, three export formats. Build queries by clicking,
            then copy the URL, curl command or SDK snippet straight into your code.
          </p>
          <div style={{ marginTop: 12 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(13,148,136,0.12)",
                color: "#0d9488",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              10 interactive tools · live data
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            marginBottom: 28,
          }}
        >
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              style={{
                display: "block",
                padding: "20px 22px",
                borderRadius: 14,
                background: "#fff",
                border: `1px solid ${c.accent}30`,
                textDecoration: "none",
                color: "#0f172a",
                transition: "transform 120ms, box-shadow 120ms",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: c.accent,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Interactive
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
                {c.title}
              </h2>
              <p style={{ fontSize: 13.5, color: "#475569", margin: "0 0 14px", lineHeight: 1.6 }}>
                {c.blurb}
              </p>
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: c.accent,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {c.cta} →
              </span>
            </Link>
          ))}
        </div>

        <section
          style={{
            padding: "20px 22px",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 14,
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 900, margin: "0 0 10px" }}>API surface</h3>
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {[
              { ep: "/api/aevion/catalog", desc: "List modules (filters + projection + format)" },
              { ep: "/api/aevion/catalog/:id", desc: "Single-module deep lookup + relatedModules" },
              { ep: "/api/aevion/registry-stats", desc: "By-status / by-kind / top tags histogram" },
              { ep: "/api/aevion/health", desc: "Aggregate health across all probed services" },
              { ep: "/api/aevion/badges/:id.svg", desc: "shields.io-style SVG badge per module" },
              { ep: "/api/aevion/openapi.json", desc: "OpenAPI 3.1 index across modules" },
              { ep: "/api/aevion/sitemap.xml", desc: "Cross-module sitemap" },
              { ep: "/api/aevion/version", desc: "Build info + uptime + release SHA" },
            ].map((r) => (
              <a
                key={r.ep}
                href={r.ep}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(15,23,42,0.04)",
                  textDecoration: "none",
                  color: "#0f172a",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    color: "#0d9488",
                  }}
                >
                  {r.ep}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2, lineHeight: 1.5 }}>
                  {r.desc}
                </div>
              </a>
            ))}
          </div>
        </section>

        <section
          style={{
            padding: "20px 22px",
            borderRadius: 12,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 900, margin: "0 0 6px", color: "#0f172a" }}>
            TypeScript SDK
          </h3>
          <p style={{ fontSize: 13, color: "#475569", margin: "0 0 10px", lineHeight: 1.6 }}>
            Zero-dependency client for the Hub API. Strict types, optional fetch injection, four
            runnable examples shipped alongside the package source.
          </p>
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              lineHeight: 1.5,
              overflow: "auto",
            }}
          >{`import { AevionCatalog } from "@aevion/catalog-client";

const cat = new AevionCatalog();
const { items } = await cat.list({ status: "mvp" });
const qsign = await cat.get("qsign");
const stats = await cat.stats();`}</pre>
          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
            Source:{" "}
            <a
              href="https://github.com/Dossymbek281078/AEVION/tree/main/packages/aevion-catalog-client"
              style={{ color: "#0d9488", fontWeight: 700 }}
              target="_blank"
              rel="noreferrer"
            >
              packages/aevion-catalog-client
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
