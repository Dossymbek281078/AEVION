import type { Metadata } from "next";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { getApiBase } from "@/lib/apiBase";

export const revalidate = 3600;

type RegistryStats = {
  total: number;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
  byTag: { tag: string; count: number }[];
};

type CatalogItem = {
  id: string;
  name: string;
  status: string;
  frontend: string;
  tags?: string[];
};

async function fetchStats(): Promise<RegistryStats | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/aevion/registry-stats`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return (await r.json()) as RegistryStats;
  } catch {
    return null;
  }
}

async function fetchCatalog(): Promise<CatalogItem[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/aevion/catalog?fields=id,name,status,frontend,tags`, {
      next: { revalidate: 3600 },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.items || []) as CatalogItem[];
  } catch {
    return [];
  }
}

const STATUS_COLOR: Record<string, string> = {
  launched: "#10b981",
  mvp: "#10b981",
  working: "#10b981",
  in_progress: "#f59e0b",
  research: "#8b5cf6",
  planning: "#3b82f6",
  idea: "#94a3b8",
};

const STATUS_ORDER = ["launched", "mvp", "in_progress", "research", "planning", "idea"];

const STATUS_LABEL: Record<string, string> = {
  launched: "Launched",
  mvp: "MVP",
  in_progress: "In progress",
  research: "Research",
  planning: "Planning",
  idea: "Idea",
};

export const metadata: Metadata = {
  title: "AEVION Press Kit — brand, boilerplate, contact",
  description:
    "Press kit for AEVION: brand assets, one-liner, boilerplate, key stats and direct contact. For journalists, analysts and partners covering trust infrastructure for AI and creator economy.",
  alternates: { canonical: "/press" },
  openGraph: {
    title: "AEVION Press Kit",
    description: "Brand, boilerplate, contact — everything a journalist needs in one page.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Press Kit",
    description: "Brand assets, boilerplate, key stats, contact.",
  },
};

function buildKeyStats(stats: RegistryStats | null): Array<{ value: string; label: string; hint: string }> {
  const total = stats?.total ?? 29;
  const liveCount = (stats?.byStatus?.launched ?? 0) + (stats?.byStatus?.mvp ?? 0);
  const emerging = total - liveCount;
  return [
    {
      value: String(total),
      label: "product nodes",
      hint: `${liveCount} live MVPs/launched, ${emerging} emerging`,
    },
    { value: "$340B", label: "addressable market", hint: "IP, creator economy, payments" },
    { value: "3", label: "languages", hint: "EN · RU · KK from day 1" },
    { value: "Ed25519", label: "signature stack", hint: "+ Shamir SSS · post-quantum-ready" },
  ];
}

const ONE_LINERS = [
  "AEVION is the trust operating system for digital creation: registry, signature, bureau, validators, bank — under one identity.",
  "AEVION turns authorship into payable rights — register IP in seconds, settle royalties in AEC, all on one Trust Graph.",
  "AEVION is what you get when you bundle USPTO, Stripe, DocuSign and a creator wallet into a single quantum-resistant pipeline.",
];

const BRAND_COLORS = [
  { hex: "#0d9488", name: "Teal · primary"       },
  { hex: "#7dd3fc", name: "Sky · QRight"         },
  { hex: "#a78bfa", name: "Violet · Awards/Demo" },
  { hex: "#fbbf24", name: "Amber · Bank/AEC"     },
  { hex: "#5eead4", name: "Mint · Quantum Shield" },
  { hex: "#f472b6", name: "Pink · Bureau/Film"   },
];

const COVERAGE_NOTE =
  "Coverage and analyst commentary will be linked here as it lands. For first-party briefings (architecture deep-dive, demo, founder interview) email yahiin1978@gmail.com with subject \"AEVION press\".";

const BOILERPLATE = `AEVION is a trust infrastructure platform for digital creation. It bundles IP registration (QRight), cryptographic signatures (QSign), a patent bureau, validator-quorum compliance certification (Planet), creator awards, and a digital bank (AEC) under a single identity and a single Trust Graph. Authorship is provable from the first second; payouts settle straight to a wallet that already understands royalties, autopilot rules and savings goals. The crypto floor is Ed25519 + Shamir's Secret Sharing, designed to remain credible after the post-quantum transition. AEVION ships in EN, RU and KK from day one.`;

export default async function PressPage() {
  const [stats, catalog] = await Promise.all([fetchStats(), fetchCatalog()]);
  const KEY_STATS = buildKeyStats(stats);
  return (
    <main style={{ background: "linear-gradient(180deg, #f8fafc 0%, #fff 200px)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px" }}>
        <Wave1Nav />

        <div style={{ marginTop: 12 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: "#0d9488",
              margin: "0 0 8px",
              textTransform: "uppercase",
            }}
          >
            For press · analysts · partners
          </p>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              margin: "0 0 12px",
              color: "#0f172a",
            }}
          >
            AEVION Press Kit
          </h1>
          <p style={{ fontSize: 15, color: "#475569", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
            One page for journalists. Brand assets, boilerplate, key stats, founder contact.
            Anything missing? Email{" "}
            <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20press" style={{ color: "#0d9488", fontWeight: 800 }}>
              yahiin1978@gmail.com
            </a>
            {" "}with subject &quot;AEVION press&quot; and I&apos;ll respond within 24 hours.
          </p>
        </div>

        <section
          style={{
            marginTop: 28,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>Key stats</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {KEY_STATS.map((s) => (
              <div key={s.label} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(13,148,136,0.05)", border: "1px solid rgba(13,148,136,0.18)" }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#0d9488", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</div>
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{s.label}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{s.hint}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>One-liners</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>
            Pick whichever fits the angle of the piece. Quote freely.
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, color: "#0f172a", lineHeight: 1.65, fontSize: 14 }}>
            {ONE_LINERS.map((l, i) => (
              <li key={i} style={{ marginBottom: 10 }}>{l}</li>
            ))}
          </ol>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px" }}>Boilerplate paragraph</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>
            Standard 100-word description for end-of-article use. Quote without modification.
          </p>
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "rgba(15,23,42,0.04)",
              border: "1px solid rgba(15,23,42,0.08)",
              fontSize: 14,
              lineHeight: 1.65,
              color: "#0f172a",
              fontFamily: "ui-serif, Georgia, serif",
            }}
          >
            {BOILERPLATE}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 14px" }}>Brand colors</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {BRAND_COLORS.map((c) => (
              <div key={c.hex} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: c.hex, border: "1px solid rgba(15,23,42,0.08)" }} />
                <div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{c.hex}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{c.name}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 14, lineHeight: 1.5 }}>
            Logo SVG: download from{" "}
            <a href="/icon" style={{ color: "#0d9488", fontWeight: 700 }}>/icon</a>
            {" "}(512×512 master). Apple-touch icon at{" "}
            <a href="/apple-icon" style={{ color: "#0d9488", fontWeight: 700 }}>/apple-icon</a>.
            For vector or larger renders, email the press contact below.
          </p>
        </section>

        {catalog.length > 0 && (
          <section
            style={{
              marginTop: 16,
              padding: 22,
              borderRadius: 16,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px" }}>
              AEVION at a glance — {catalog.length} modules
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px", lineHeight: 1.6 }}>
              The full product line, grouped by stage. Auto-generated from{" "}
              <Link href="/api/aevion/catalog" style={{ color: "#0d9488", fontWeight: 700 }}>
                /api/aevion/catalog
              </Link>{" "}
              · machine-readable in JSON, CSV, Markdown.
            </p>
            {STATUS_ORDER.filter((s) => catalog.some((m) => m.status === s)).map((statusKey) => {
              const modules = catalog
                .filter((m) => m.status === statusKey)
                .sort((a, b) => a.name.localeCompare(b.name));
              const color = STATUS_COLOR[statusKey] || "#94a3b8";
              return (
                <div key={statusKey} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#64748b",
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: color }} aria-hidden />
                    {STATUS_LABEL[statusKey] || statusKey} · {modules.length}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    }}
                  >
                    {modules.map((m) => (
                      <a
                        key={m.id}
                        href={m.frontend}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(15,23,42,0.04)",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#0f172a",
                          textDecoration: "none",
                          borderLeft: `2px solid ${color}`,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.name.split("—")[0].trim()}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 6px" }}>Press downloads</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px", lineHeight: 1.6 }}>
            Direct links to assets and machine-readable data. Free use for editorial coverage with attribution.
          </p>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {[
              { href: "/icon", label: "Logo · master SVG 512×512", hint: "Site favicon source" },
              { href: "/apple-icon", label: "Apple touch icon", hint: "180×180 PNG" },
              { href: "/opengraph-image", label: "Default OG image", hint: "1200×630 social card" },
              { href: "/press/opengraph-image", label: "Press OG image", hint: "1200×630 press-kit card" },
              { href: "/api/aevion/catalog", label: "Catalog JSON", hint: "All modules + tags + status" },
              { href: "/api/aevion/catalog?format=csv", label: "Catalog CSV", hint: "Spreadsheet-friendly" },
              { href: "/api/aevion/catalog?format=md", label: "Catalog Markdown", hint: "Drop into a doc" },
              { href: "/api/aevion/registry-stats", label: "Registry stats JSON", hint: "By-status + by-tag counts" },
              { href: "/api/aevion/health", label: "Live health JSON", hint: "Per-service probe" },
              { href: "/status", label: "Public status page", hint: "Live dashboard" },
            ].map((a) => (
              <a
                key={a.href}
                href={a.href}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(13,148,136,0.04)",
                  border: "1px solid rgba(13,148,136,0.18)",
                  textDecoration: "none",
                  color: "#0f172a",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0d9488" }}>{a.label} →</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{a.hint}</div>
              </a>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>Coverage</h2>
          <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{COVERAGE_NOTE}</p>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>Press contact</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.95 }}>
            <div>
              <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20press" style={{ color: "#fff", fontWeight: 800 }}>
                yahiin1978@gmail.com
              </a>
              {" "}— subject &quot;AEVION press&quot;, response within 24h.
            </div>
            <div style={{ marginTop: 6 }}>
              For investor briefings:{" "}
              <Link href="/pitch" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
                /pitch
              </Link>
              . For a live walk-through:{" "}
              <Link href="/demo" style={{ color: "#fff", fontWeight: 800, textDecoration: "underline" }}>
                /demo
              </Link>
              .
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
