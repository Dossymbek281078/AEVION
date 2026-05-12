"use client";

import { useState, useEffect } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
  tags: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  tech: { bg: "#eff6ff", fg: "#2563eb" },
  crypto: { bg: "#fff7ed", fg: "#c2410c" },
  ai: { bg: "#f5f3ff", fg: "#7c3aed" },
  business: { bg: "#f0fdf4", fg: "#15803d" },
  science: { bg: "#ecfeff", fg: "#0e7490" },
  world: { bg: "#fef2f2", fg: "#b91c1c" },
};

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? { bg: "#f1f5f9", fg: "#475569" };
  return (
    <span
      style={{
        background: color.bg,
        color: color.fg,
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {category}
    </span>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({
  article,
  expanded,
  onToggle,
  onSummarize,
  aiSummary,
  aiLoading,
}: {
  article: NewsItem;
  expanded: boolean;
  onToggle: () => void;
  onSummarize: (id: string) => void;
  aiSummary: { summary: string; keyPoints: string[] } | null;
  aiLoading: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        marginBottom: 12,
        cursor: "pointer",
        transition: "box-shadow 0.15s",
        boxShadow: expanded ? "0 4px 16px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
      }}
      onClick={onToggle}
    >
      {/* Header row */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <CategoryBadge category={article.category} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{article.source}</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{relativeTime(article.publishedAt)}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", lineHeight: 1.4, marginBottom: 8 }}>
            {article.title}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            {expanded ? article.summary : `${article.summary.slice(0, 120)}${article.summary.length > 120 ? "..." : ""}`}
          </p>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 18, flexShrink: 0, marginTop: 4 }}>
          {expanded ? "▲" : "▼"}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          {/* Tags */}
          {article.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
              {article.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#f1f5f9",
                    color: "#64748b",
                    borderRadius: 20,
                    padding: "2px 10px",
                    fontSize: 12,
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* AI Summary */}
          {aiSummary && (
            <div
              style={{
                background: "#f5f3ff",
                border: "1px solid #ddd6fe",
                borderRadius: 10,
                padding: 16,
                marginTop: 14,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "#7c3aed", marginBottom: 8 }}>
                AI Summary
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                {aiSummary.summary}
              </p>
              {aiSummary.keyPoints.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
                  {aiSummary.keyPoints.map((kp, i) => (
                    <li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                      {kp}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => onSummarize(article.id)}
              disabled={aiLoading}
              style={{
                background: aiLoading ? "#ddd6fe" : "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "7px 16px",
                fontWeight: 600,
                cursor: aiLoading ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              {aiLoading ? "Summarizing..." : "✦ AI Summarize"}
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#f1f5f9",
                color: "#334155",
                border: "none",
                borderRadius: 8,
                padding: "7px 16px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Read Original
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trending Sidebar ─────────────────────────────────────────────────────────

function TrendingSidebar({ articles }: { articles: NewsItem[] }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 }}>
        Trending Now
      </div>
      {articles.map((a, i) => (
        <div
          key={a.id}
          style={{
            display: "flex",
            gap: 12,
            padding: "10px 0",
            borderBottom: i < articles.length - 1 ? "1px solid #f1f5f9" : "none",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#f5f3ff",
              color: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {i + 1}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.3, marginBottom: 4 }}>
              {a.title.slice(0, 60)}{a.title.length > 60 ? "..." : ""}
            </div>
            <CategoryBadge category={a.category} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "tech", label: "Tech" },
  { id: "crypto", label: "Crypto" },
  { id: "ai", label: "AI" },
  { id: "business", label: "Business" },
  { id: "science", label: "Science" },
  { id: "world", label: "World" },
];

export default function QNewsPage() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [trending, setTrending] = useState<NewsItem[]>([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, { summary: string; keyPoints: string[] }>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  async function fetchArticles(cat: string) {
    setLoading(true);
    try {
      const url = apiUrl("/api/qnews/articles") + (cat ? `?category=${cat}` : "");
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json() as { articles: NewsItem[] };
        setArticles(data.articles ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrending() {
    try {
      const resp = await fetch(apiUrl("/api/qnews/trending"));
      if (resp.ok) {
        const data = await resp.json() as { articles: NewsItem[] };
        setTrending(data.articles ?? []);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchArticles(category);
    fetchTrending();
  }, [category]);

  async function handleSummarize(articleId: string) {
    setAiLoading(articleId);
    try {
      const resp = await fetch(apiUrl("/api/qnews/ai/summarize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      if (resp.ok) {
        const data = await resp.json() as { summary: string; keyPoints: string[] };
        setAiSummaries((prev) => ({ ...prev, [articleId]: data }));
      }
    } finally {
      setAiLoading(null);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    background: active ? "#7c3aed" : "#f1f5f9",
    color: active ? "#fff" : "#64748b",
    transition: "all 0.15s",
  });

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, color: "#0f172a" }}>
            QNews
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 15 }}>
            Curated news with AI-powered summaries across tech, crypto, AI, business, science, and world.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
          {/* Main column */}
          <div>
            {/* Category tabs */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  style={tabStyle(category === cat.id)}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Articles */}
            {loading && (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                Loading articles...
              </p>
            )}
            {!loading && articles.length === 0 && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 40,
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📰</div>
                <div>No articles found</div>
              </div>
            )}
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                expanded={expandedId === article.id}
                onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
                onSummarize={handleSummarize}
                aiSummary={aiSummaries[article.id] ?? null}
                aiLoading={aiLoading === article.id}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div>
            <TrendingSidebar articles={trending} />
          </div>
        </div>
      </ProductPageShell>
    </>
  );
}
