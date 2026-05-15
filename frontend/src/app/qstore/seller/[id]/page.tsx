"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

interface SellerProduct {
  id: string;
  title: string;
  category: string;
  price: number;
  salesCount: number;
}

interface SellerProfile {
  userId: string;
  products: SellerProduct[];
  totalSales: number;
  avgRating: number;
}

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  template: { bg: "#dbeafe", fg: "#1d4ed8" },
  preset: { bg: "#fce7f3", fg: "#9d174d" },
  music: { bg: "#dcfce7", fg: "#15803d" },
  video: { bg: "#ffedd5", fg: "#9a3412" },
  design: { bg: "#f3e8ff", fg: "#6b21a8" },
  code: { bg: "#d1fae5", fg: "#065f46" },
  other: { bg: "#f1f5f9", fg: "#475569" },
};

function priceLabel(price: number): string {
  if (price === 0) return "Free";
  return `$${(price / 100).toFixed(2)}`;
}

function sellerInitial(userId: string): string {
  if (!userId) return "?";
  const trimmed = userId.trim();
  if (trimmed.length === 0) return "?";
  return trimmed[0].toUpperCase();
}

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const stars: string[] = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push("★");
    else if (i === full && half) stars.push("☆");
    else stars.push("☆");
  }
  return (
    <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }}>
      {stars.join("")}
    </span>
  );
}

export default function QStoreSellerProfilePage() {
  const params = useParams();
  const sellerId = String(params?.id ?? "");

  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/qstore/sellers/${encodeURIComponent(sellerId)}`));
      if (res.status === 404) {
        setNotFound(true);
        setProfile(null);
        return;
      }
      if (!res.ok) {
        setProfile(null);
        return;
      }
      const data = await res.json();
      // Treat empty product list with no sales as a "ghost" seller — show as not found.
      if (!data || (Array.isArray(data.products) && data.products.length === 0 && (data.totalSales ?? 0) === 0)) {
        setNotFound(true);
        setProfile(null);
        return;
      }
      setProfile({
        userId: data.userId ?? sellerId,
        products: Array.isArray(data.products) ? data.products : [],
        totalSales: Number(data.totalSales ?? 0),
        avgRating: Number(data.avgRating ?? 0),
      });
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
            {/* Skeleton hero */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ height: 24, width: 240, background: "#e2e8f0", borderRadius: 6, marginBottom: 10 }} />
                <div style={{ height: 14, width: 160, background: "#f1f5f9", borderRadius: 6 }} />
              </div>
            </div>
            {/* Skeleton stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 18,
                    height: 78,
                  }}
                />
              ))}
            </div>
            {/* Skeleton grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 16,
                    height: 150,
                  }}
                />
              ))}
            </div>
          </div>
        </ProductPageShell>
      </>
    );
  }

  if (notFound || !profile) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <h1 style={{ fontSize: 24, color: "#0f172a", margin: "0 0 8px" }}>Seller not found</h1>
            <p style={{ color: "#64748b", marginBottom: 24 }}>
              This seller doesn&apos;t have any public products yet.
            </p>
            <Link
              href="/qstore"
              style={{
                display: "inline-block",
                padding: "9px 20px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Back to QStore
            </Link>
          </div>
        </ProductPageShell>
      </>
    );
  }

  const productCount = profile.products.length;
  const avgPrice =
    productCount > 0
      ? profile.products.reduce((sum, p) => sum + p.price, 0) / productCount
      : 0;
  const displayName = profile.userId.length > 16 ? `${profile.userId.slice(0, 14)}…` : profile.userId;

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
          {/* Breadcrumb */}
          <div style={{ marginBottom: 20, fontSize: 13, color: "#64748b" }}>
            <Link href="/qstore" style={{ color: "#0d9488", textDecoration: "none", fontWeight: 600 }}>
              ← QStore
            </Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span>Seller</span>
          </div>

          {/* Hero header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 28,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: "20px 24px",
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {sellerInitial(profile.userId)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#0f172a",
                  margin: "0 0 6px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
                title={profile.userId}
              >
                {displayName}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 13, color: "#64748b" }}>
                <span>
                  <span style={{ fontWeight: 700, color: "#374151" }}>{productCount}</span>{" "}
                  {productCount === 1 ? "product" : "products"}
                </span>
                <span style={{ color: "#cbd5e1" }}>·</span>
                <span>
                  <span style={{ fontWeight: 700, color: "#374151" }}>{profile.totalSales}</span> total sales
                </span>
                {profile.avgRating > 0 && (
                  <>
                    <span style={{ color: "#cbd5e1" }}>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <StarRating value={profile.avgRating} />
                      <span style={{ fontWeight: 700, color: "#374151" }}>{profile.avgRating.toFixed(1)}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats panel */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Products
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{productCount}</div>
            </div>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Total sales
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{profile.totalSales}</div>
            </div>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Avg rating
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: profile.avgRating > 0 ? "#0f172a" : "#94a3b8" }}>
                {profile.avgRating > 0 ? profile.avgRating.toFixed(1) : "—"}
              </div>
            </div>
          </div>

          {/* Products grid */}
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 14px" }}>
            Products by this seller
          </h2>

          {productCount === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1px dashed #e2e8f0",
                borderRadius: 14,
                padding: 32,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 14,
              }}
            >
              This seller hasn&apos;t published anything public yet.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {profile.products.map((p) => {
                const cat = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.other;
                return (
                  <Link
                    key={p.id}
                    href={`/qstore/${p.id}`}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 16,
                      textDecoration: "none",
                      color: "inherit",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      transition: "border-color 120ms ease, transform 120ms ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span
                        style={{
                          background: cat.bg,
                          color: cat.fg,
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {p.category}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: p.price === 0 ? "#0d9488" : "#0f172a",
                        }}
                      >
                        {priceLabel(p.price)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#0f172a",
                        lineHeight: 1.35,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ marginTop: "auto", fontSize: 12, color: "#94a3b8" }}>
                      {p.salesCount} {p.salesCount === 1 ? "sale" : "sales"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Footer note about avg price (subtle) */}
          {productCount > 0 && (
            <div style={{ marginTop: 18, fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
              Avg price across listings: {priceLabel(Math.round(avgPrice))}
            </div>
          )}
        </div>
      </ProductPageShell>
    </>
  );
}
