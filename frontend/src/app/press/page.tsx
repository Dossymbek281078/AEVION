import type { Metadata } from "next";
import Link from "next/link";
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

// The registry emits `live` and `mvp`. `launched` was an older name that the
// API no longer returns — it is kept here only so an old snapshot still renders.
// Dropping `live` from STATUS_ORDER silently hid 36 of 41 modules while the
// heading kept claiming "41 modules", so any status the catalog reports must
// have an entry here.
const STATUS_COLOR: Record<string, string> = {
  live: "#10b981",
  launched: "#10b981",
  mvp: "#10b981",
  working: "#10b981",
  in_progress: "#f59e0b",
  research: "#8b5cf6",
  planning: "#3b82f6",
  idea: "#94a3b8",
};

const STATUS_ORDER = ["live", "launched", "mvp", "in_progress", "research", "planning", "idea"];

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
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

/**
 * Every status the catalog actually reports, in a stable order — known ones
 * first, anything unrecognised appended rather than dropped. The previous
 * version filtered a hardcoded list, so a status the list did not know about
 * disappeared from the page without any error.
 */
function orderStatuses(catalog: CatalogItem[]): string[] {
  const present = Array.from(new Set(catalog.map((m) => m.status).filter(Boolean)));
  const known = STATUS_ORDER.filter((s) => present.includes(s));
  const unknown = present.filter((s) => !STATUS_ORDER.includes(s)).sort();
  return [...known, ...unknown];
}

function buildKeyStats(
  stats: RegistryStats | null,
  catalog: CatalogItem[],
): Array<{ value: string; label: string; hint: string }> {
  // Counts come from the registry, never from a hardcoded guess: a stale number
  // on a page journalists quote is worse than no number at all.
  const byStatus = stats?.byStatus ?? {};
  const total = stats?.total ?? catalog.length;
  // `live` is the current key; `launched` is tolerated for older snapshots.
  const live = (byStatus.live ?? 0) + (byStatus.launched ?? 0);
  const mvp = byStatus.mvp ?? 0;
  const rest = Math.max(0, total - live - mvp);

  const hintParts = [`${live} live`, `${mvp} MVP`];
  if (rest > 0) hintParts.push(`${rest} earlier stage`);

  return [
    {
      value: String(total),
      label: "modules in the registry",
      hint: hintParts.join(" · "),
    },
    {
      value: "1",
      label: "person built it",
      hint: "AI as the only engineer · public commit history",
    },
    { value: "3", label: "languages", hint: "EN · RU · KK from day 1" },
    { value: "Ed25519", label: "signature stack", hint: "+ Shamir SSS · post-quantum-ready" },
  ];
}

/**
 * Counts inside quotable copy are derived, never typed in. A journalist copies
 * this text verbatim into a published article; a hardcoded figure here goes
 * stale the next time a module ships and there is no way to take it back.
 */
function buildOneLiners(total: number): string[] {
  return [
    `AEVION is a platform of ${total} modules under one login — built in eight months by one person who cannot write code, with AI as the only engineer.`,
    "AEVION is what one person plus AI agents can now build: an AI gateway, an app builder, payments, post-quantum signatures and an authorship registry, under a single identity.",
    "AEVION turns authorship into payable rights — register what you make, prove it cryptographically, and get paid for it, on one trust core.",
  ];
}

const BRAND_COLORS = [
  { hex: "#0d9488", name: "Teal · primary"       },
  { hex: "#7dd3fc", name: "Sky · QRight"         },
  { hex: "#a78bfa", name: "Violet · Awards/Demo" },
  { hex: "#fbbf24", name: "Amber · Bank/AEV"     },
  { hex: "#5eead4", name: "Mint · Quantum Shield" },
  { hex: "#f472b6", name: "Pink · Bureau/Film"   },
];

const COVERAGE_NOTE =
  "Coverage and analyst commentary will be linked here as it lands. For first-party briefings (architecture deep-dive, demo, founder interview) email yahiin1978@gmail.com with subject \"AEVION press\".";

/** Same rule as the one-liners: the counts come from the registry, not from memory. */
function buildBoilerplate(total: number, live: number): string {
  return (
    `AEVION is a platform of ${total} modules — ${live} of them live — running under one login: ` +
    `an AI gateway that routes across five model providers, DevHub (describe an application in ` +
    `plain language and get a working project with a live preview), a payments layer, ` +
    `post-quantum digital signatures (ML-DSA-65, FIPS 204), an authorship registry, and a digital ` +
    `bank settling in AEV. It was built in eight months by one person, Dosymbek Zhakiya — a ` +
    `construction-expertise professional in Kazakhstan who is not a programmer. AI wrote every ` +
    `line; he decided what to build and verified that it worked. The commit history is public ` +
    `under his real name. AEVION ships in EN, RU and KK from day one.`
  );
}

export default async function PressPage() {
  const [stats, catalog] = await Promise.all([fetchStats(), fetchCatalog()]);
  const KEY_STATS = buildKeyStats(stats, catalog);
  const totalModules = stats?.total ?? catalog.length;
  const liveModules = (stats?.byStatus?.live ?? 0) + (stats?.byStatus?.launched ?? 0);
  const ONE_LINERS = buildOneLiners(totalModules);
  const BOILERPLATE = buildBoilerplate(totalModules, liveModules);
  return (
    <main style={{ background: "linear-gradient(180deg, #f8fafc 0%, #fff 200px)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px" }}>
        {/* Одна ссылка назад вместо Wave1Nav.
            Wave1Nav — внутренняя навигация по всем модулям, она стоит на 116
            страницах и там уместна. Здесь нет: /press открывает журналист по
            ссылке из письма, и с ней на телефоне до заголовка «AEVION Press Kit»
            оказывалось ~1250px, то есть полторы прокрутки чужого каталога
            (замер iPhone 13, 390×844, issue #949). Глобальная шапка на странице
            остаётся — второй навигации не нужно. */}
        <nav aria-label="Back to site" style={{ marginBottom: 14, fontSize: 13 }}>
          <Link href="/" style={{ color: "#0f766e", fontWeight: 800, textDecoration: "none" }}>
            ← AEVION
          </Link>
        </nav>

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
            {orderStatuses(catalog).map((statusKey) => {
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
