import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";
import { pickLang } from "@/lib/qrightServerI18n";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type RegistryItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  effectiveStatus: string;
  effectiveTier: string;
  tags: string[];
  runtime: { primaryPath: string | null };
};

type RegistryResponse = {
  total: number;
  matched: number;
  items: RegistryItem[];
};

type TagsResponse = { items: { tag: string; count: number }[] };

type Props = {
  params: Promise<{ tag: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TIER_COLOR: Record<string, string> = {
  mvp_live: "#0d9488",
  platform_api: "#2563eb",
  portal_only: "#94a3b8",
};

type CopyT = {
  back: string;
  title: string;
  subtitle: string;
  matched: string;
  empty: string;
  rss: string;
  allTags: string;
};

const COPY: Record<"en" | "ru", CopyT> = {
  en: {
    back: "← All modules",
    title: "AEVION modules · #{tag}",
    subtitle: "Every module tagged #{tag}, with live tier and status.",
    matched: "{n} of {total} modules",
    empty: "No modules carry this tag.",
    rss: "RSS for #{tag} →",
    allTags: "← All tags",
  },
  ru: {
    back: "← Все модули",
    title: "Модули AEVION · #{tag}",
    subtitle: "Все модули с тегом #{tag} и их актуальный tier/статус.",
    matched: "{n} из {total} модулей",
    empty: "Ни один модуль не помечен этим тегом.",
    rss: "RSS для #{tag} →",
    allTags: "← Все теги",
  },
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 18,
  background: "#fff",
};

async function loadRegistryByTag(tag: string): Promise<RegistryResponse | null> {
  try {
    const r = await fetch(
      `${getApiBase()}/api/modules/registry?tag=${encodeURIComponent(tag)}&limit=200`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    return (await r.json()) as RegistryResponse;
  } catch {
    return null;
  }
}

async function loadTags(): Promise<TagsResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/modules/tags`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) as TagsResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const t = tag.toLowerCase();
  const ogImage = `${getApiBase()}/api/modules/og.svg`;
  const title = `AEVION modules · #${t}`;
  const description = `Every AEVION module tagged #${t}, with live tier and status.`;
  return {
    title,
    description,
    alternates: {
      types: {
        "application/rss+xml": `${getApiBase()}/api/modules/tags/${encodeURIComponent(t)}/changelog.rss`,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ModulesTagPage({ params, searchParams }: Props) {
  const { tag: tagRaw } = await params;
  const tag = tagRaw.toLowerCase();
  const sp = (await searchParams) || {};
  const h = await headers();
  const lang = pickLang(sp, h);
  const t = COPY[lang];

  const [registry, tags] = await Promise.all([loadRegistryByTag(tag), loadTags()]);
  const apiBase = getApiBase();
  const rssHref = `${apiBase}/api/modules/tags/${encodeURIComponent(tag)}/changelog.rss`;
  const tagExists = !!tags?.items.find((i) => i.tag === tag);

  // Structured data: BreadcrumbList only — tag pages don't have a single
  // canonical entity, just a filtered listing.
  const ldJson = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "AEVION modules", item: "/modules" },
        {
          "@type": "ListItem",
          position: 2,
          name: `#${tag}`,
          item: `/modules/tags/${tag}`,
        },
      ],
    },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "32px 16px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 16, display: "flex", gap: 14 }}>
          <Link
            href="/modules"
            style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
          >
            {t.back}
          </Link>
          <a
            href={rssHref}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#ea580c",
              textDecoration: "none",
              fontFamily: "monospace",
              marginLeft: "auto",
            }}
          >
            {t.rss.replace("{tag}", tag)}
          </a>
        </div>

        <h1
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: "#0f172a",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {t.title.replace("{tag}", tag)}
        </h1>
        <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24, lineHeight: 1.6 }}>
          {t.subtitle.replace("{tag}", tag)}
        </p>

        {!tagExists && (
          <div style={{ ...card, color: "#854d0e", borderColor: "rgba(234,179,8,0.4)", marginBottom: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>#{tag}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{t.empty}</div>
          </div>
        )}

        {registry && (
          <div style={{ marginBottom: 14, fontSize: 12, color: "#64748b" }}>
            {t.matched
              .replace("{n}", String(registry.matched))
              .replace("{total}", String(registry.total))}
          </div>
        )}

        {registry && registry.items.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {registry.items.map((m) => (
              <ModuleCard key={m.id} m={m} />
            ))}
          </div>
        )}

        {tags && tags.items.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              {t.allTags}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {tags.items.slice(0, 30).map((tt) => {
                const isActive = tt.tag === tag;
                return (
                  <Link
                    key={tt.tag}
                    href={`/modules/tags/${encodeURIComponent(tt.tag)}`}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${isActive ? "#0d9488" : "rgba(15,23,42,0.15)"}`,
                      background: isActive ? "#0d9488" : "#fff",
                      color: isActive ? "#fff" : "#475569",
                      fontSize: 11,
                      fontWeight: 700,
                      textDecoration: "none",
                      fontFamily: "monospace",
                    }}
                  >
                    #{tt.tag}{" "}
                    <span style={{ color: isActive ? "rgba(255,255,255,0.7)" : "#94a3b8", fontSize: 10 }}>
                      {tt.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ModuleCard({ m }: { m: RegistryItem }) {
  const tierColor = TIER_COLOR[m.effectiveTier] || "#94a3b8";
  return (
    <Link
      href={`/modules/${encodeURIComponent(m.id)}`}
      style={{
        ...card,
        padding: 16,
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{m.name}</span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: tierColor + "22",
            color: tierColor,
            fontSize: 10,
            fontWeight: 800,
            fontFamily: "monospace",
          }}
        >
          {m.effectiveTier}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: "rgba(15,23,42,0.06)",
            color: "#475569",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        >
          {m.effectiveStatus}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#475569", marginTop: 6, lineHeight: 1.5 }}>
        {m.description}
      </div>
      {m.tags && m.tags.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {m.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background: "rgba(13,148,136,0.08)",
                color: "#0d9488",
                fontSize: 10,
                fontFamily: "monospace",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
