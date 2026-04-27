"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Cert = {
  id: string;
  objectId: string;
  title: string;
  kind: string;
  description: string;
  authorName: string | null;
  country: string | null;
  city: string | null;
  contentHash: string;
  protectedAt: string;
  verifiedCount: number;
};

type AuthorProfile = {
  slug: string;
  name: string;
  stats: {
    certificates: number;
    verifications: number;
    countries: string[];
    firstProtectedAt: string | null;
    lastProtectedAt: string | null;
    byKind: Array<{ kind: string; count: number }>;
  };
  certificates: Cert[];
};

const KIND_ICON: Record<string, string> = {
  music: "🎵",
  code: "💻",
  design: "🎨",
  text: "📝",
  video: "🎬",
  idea: "💡",
  other: "📦",
};

const KIND_COLOR: Record<string, string> = {
  music: "#fbbf24",
  code: "#5eead4",
  design: "#fda4af",
  text: "#93c5fd",
  video: "#c4b5fd",
  idea: "#fdba74",
  other: "#cbd5e1",
};

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 30) return `${day} d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  const yr = Math.round(mo / 12);
  return `${yr} y ago`;
}

export default function AuthorPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [data, setData] = useState<AuthorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(apiUrl(`/api/pipeline/authors/${encodeURIComponent(slug)}`));
        if (res.status === 404) {
          if (!cancelled) setError("Author not found in the registry.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AuthorProfile;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed to load author");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main>
        <ProductPageShell maxWidth={960}>
          <Wave1Nav />
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Loading author profile…</div>
            <div style={{ fontSize: 12, marginTop: 4, fontFamily: "ui-monospace, Menlo, monospace" }}>{slug}</div>
          </div>
        </ProductPageShell>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main>
        <ProductPageShell maxWidth={960}>
          <Wave1Nav />
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
              {error || "Author not found"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>
              The slug <code style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{slug}</code> didn&apos;t match any
              author in the public registry.
            </div>
            <Link
              href="/bureau"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: 10,
                background: "#0f172a",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              ← Browse the registry
            </Link>
          </div>
        </ProductPageShell>
      </main>
    );
  }

  const { name, stats, certificates } = data;

  return (
    <main>
      <ProductPageShell maxWidth={960}>
        <Wave1Nav />

        {/* Header */}
        <section
          style={{
            padding: "28px 24px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
            color: "#f1f5f9",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#5eead4",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Author profile
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em" }}>{name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16, fontSize: 13, color: "#cbd5e1" }}>
            <div>
              <span style={{ color: "#5eead4", fontWeight: 800 }}>{stats.certificates}</span> certificate
              {stats.certificates === 1 ? "" : "s"}
            </div>
            <div>
              <span style={{ color: "#5eead4", fontWeight: 800 }}>{stats.verifications.toLocaleString()}</span> verification
              {stats.verifications === 1 ? "" : "s"}
            </div>
            {stats.countries.length > 0 && (
              <div>
                Countries: <span style={{ color: "#fff" }}>{stats.countries.join(", ")}</span>
              </div>
            )}
            {stats.firstProtectedAt && (
              <div>
                First protected: <span style={{ color: "#fff" }}>{formatRelative(stats.firstProtectedAt)}</span>
              </div>
            )}
          </div>
          {stats.byKind.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
              {stats.byKind.map((k) => (
                <span
                  key={k.kind}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    color: KIND_COLOR[k.kind] || "#cbd5e1",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {KIND_ICON[k.kind] || "📦"} {k.kind} · {k.count}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Cert list */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Protected works
            </div>
            <Link
              href="/bureau"
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0d9488",
                textDecoration: "none",
              }}
            >
              ← Browse all authors
            </Link>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {certificates.map((c) => {
              const color = KIND_COLOR[c.kind] || "#64748b";
              return (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: 14,
                    background: "#fff",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{KIND_ICON[c.kind] || "📦"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 800,
                          background: `${color}20`,
                          color,
                          textTransform: "uppercase",
                        }}
                      >
                        {c.kind}
                      </span>
                      <span title={new Date(c.protectedAt).toLocaleString()} style={{ fontSize: 11, color: "#94a3b8" }}>
                        {formatRelative(c.protectedAt)}
                      </span>
                      {c.verifiedCount > 0 && (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>verified {c.verifiedCount}×</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#0f172a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#475569",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.description}
                    </div>
                  </div>
                  <Link
                    href={`/verify/${c.id}`}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      background: "#0d9488",
                      color: "#fff",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    Verify →
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </ProductPageShell>
    </main>
  );
}
