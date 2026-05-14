"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

interface Product {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  previewUrl: string;
  tags: string[];
  salesCount: number;
  avgRating?: number;
  reviewCount?: number;
  isPublic: boolean;
  createdAt: string;
}

interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
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

function priceLabel(price: number, currency: string): string {
  if (price === 0) return "Free";
  const sym = currency === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${sym}${(price / 100).toFixed(2)}`;
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

export default function QStoreItemPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(apiUrl(`/api/qstore/products/${id}`)),
        fetch(apiUrl(`/api/qstore/products/${id}/reviews`)),
      ]);
      if (pRes.status === 404) {
        setNotFound(true);
        setProduct(null);
        return;
      }
      const pData = await pRes.json();
      setProduct(pData.product || null);
      if (rRes.ok) {
        const rData = await rRes.json();
        setReviews(rData.reviews || []);
      }
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handlePurchase = async () => {
    if (!product) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token") : null;
    if (!token) {
      setNotice("Sign in to purchase products.");
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch(apiUrl(`/api/qstore/products/${product.id}/purchase`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotice(product.price === 0 ? "Added to your library!" : "Purchase successful!");
        fetchAll();
      } else {
        const d = await res.json();
        setNotice(d.error || "Purchase failed");
      }
    } catch {
      setNotice("Network error");
    } finally {
      setPurchasing(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token") : null;
    if (!token) {
      setNotice("Sign in to leave a review.");
      return;
    }
    setReviewSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/qstore/products/${product.id}/review`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() || null }),
      });
      if (res.ok) {
        setNotice("Review posted!");
        setReviewComment("");
        setReviewRating(5);
        fetchAll();
      } else {
        const d = await res.json();
        setNotice(d.error || "Failed to post review");
      }
    } catch {
      setNotice("Network error");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px", color: "#94a3b8", textAlign: "center" }}>
            Loading product...
          </div>
        </ProductPageShell>
      </>
    );
  }

  if (notFound || !product) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <h1 style={{ fontSize: 24, color: "#0f172a", margin: "0 0 8px" }}>Product not found</h1>
            <p style={{ color: "#64748b", marginBottom: 24 }}>
              The product you&apos;re looking for doesn&apos;t exist or has been removed.
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

  const cat = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.other;
  const avgRating = product.avgRating || 0;
  const reviewCount = product.reviewCount || reviews.length;

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px 80px" }}>
          {/* Breadcrumb */}
          <div style={{ marginBottom: 20, fontSize: 13, color: "#64748b" }}>
            <Link href="/qstore" style={{ color: "#0d9488", textDecoration: "none", fontWeight: 600 }}>
              ← QStore
            </Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ textTransform: "capitalize" }}>{product.category}</span>
          </div>

          {/* Notice */}
          {notice && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: "10px 16px",
                marginBottom: 20,
                color: "#166534",
                fontSize: 14,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {notice}
              <button onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 700 }}>×</button>
            </div>
          )}

          {/* Hero */}
          <div className="qstore-hero-grid" style={{ marginBottom: 32 }}>
            {/* Left: image + description */}
            <div>
              {product.previewUrl ? (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    background: "#f8fafc",
                    borderRadius: 14,
                    overflow: "hidden",
                    marginBottom: 24,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <img
                    src={product.previewUrl}
                    alt={product.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                    borderRadius: 14,
                    marginBottom: 24,
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 48,
                    color: "#cbd5e1",
                  }}
                >
                  🛒
                </div>
              )}

              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 12px" }}>
                {product.title}
              </h1>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <span
                  style={{
                    background: cat.bg,
                    color: cat.fg,
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "capitalize",
                  }}
                >
                  {product.category}
                </span>
                {avgRating > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
                    <StarRating value={avgRating} />
                    <span style={{ fontWeight: 600, color: "#374151" }}>{avgRating.toFixed(1)}</span>
                    <span>({reviewCount} {reviewCount === 1 ? "review" : "reviews"})</span>
                  </span>
                )}
                <span style={{ fontSize: 13, color: "#94a3b8" }}>· {product.salesCount} sales</span>
              </div>

              {product.description && (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 20,
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "#374151",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {product.description}
                </div>
              )}

              {product.tags && product.tags.length > 0 && (
                <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {product.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        background: "#f1f5f9",
                        color: "#475569",
                        borderRadius: 12,
                        padding: "3px 10px",
                        fontSize: 12,
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: purchase card */}
            <div>
              <div
                className="qstore-purchase-card"
                style={{
                  background: "#fff",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: product.price === 0 ? "#0d9488" : "#0f172a",
                    marginBottom: 4,
                  }}
                >
                  {priceLabel(product.price, product.currency)}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
                  Listed {new Date(product.createdAt).toLocaleDateString()}
                </div>

                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: 10,
                    border: "none",
                    background: purchasing
                      ? "#e2e8f0"
                      : product.price === 0
                        ? "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)"
                        : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: purchasing ? "#94a3b8" : "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: purchasing ? "not-allowed" : "pointer",
                    marginBottom: 14,
                  }}
                >
                  {purchasing ? "Processing..." : product.price === 0 ? "Get free" : "Buy now"}
                </button>

                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, fontSize: 13, color: "#64748b" }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#94a3b8" }}>Seller:</span>{" "}
                    <Link
                      href={`/qstore/seller/${encodeURIComponent(product.sellerId)}`}
                      style={{ color: "#0d9488", fontWeight: 600, textDecoration: "none" }}
                    >
                      {product.sellerId.slice(0, 12)}…
                    </Link>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ color: "#94a3b8" }}>Sales:</span>{" "}
                    <span style={{ fontWeight: 600, color: "#374151" }}>{product.salesCount}</span>
                  </div>
                  <Link
                    href={`/qstore/seller/${encodeURIComponent(product.sellerId)}`}
                    style={{
                      display: "inline-block",
                      width: "100%",
                      textAlign: "center",
                      padding: "8px 0",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#0d9488",
                      fontWeight: 700,
                      fontSize: 13,
                      textDecoration: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    View seller profile →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews section */}
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 16px" }}>
              Reviews ({reviewCount})
            </h2>

            {/* Review form */}
            <form
              onSubmit={handleReviewSubmit}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 12 }}>
                Leave a review
              </div>
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewRating(n)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 22,
                      color: n <= reviewRating ? "#f59e0b" : "#e2e8f0",
                      padding: 0,
                    }}
                    aria-label={`${n} stars`}
                  >
                    ★
                  </button>
                ))}
                <span style={{ marginLeft: 8, alignSelf: "center", fontSize: 13, color: "#64748b" }}>
                  {reviewRating} / 5
                </span>
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience (optional)"
                rows={3}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "inherit",
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />
              <button
                type="submit"
                disabled={reviewSubmitting}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: reviewSubmitting ? "#e2e8f0" : "#0d9488",
                  color: reviewSubmitting ? "#94a3b8" : "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: reviewSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {reviewSubmitting ? "Posting..." : "Post review"}
              </button>
            </form>

            {/* Reviews list */}
            {reviews.length === 0 ? (
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
                No reviews yet. Be the first to share your thoughts!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <StarRating value={r.rating} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                          {r.userId.slice(0, 10)}…
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {r.comment && (
                      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                        {r.comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </ProductPageShell>
      <style jsx>{`
        .qstore-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 32px;
        }
        .qstore-purchase-card {
          position: sticky;
          top: 24px;
        }
        @media (max-width: 768px) {
          .qstore-hero-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .qstore-purchase-card {
            position: static;
          }
        }
      `}</style>
    </>
  );
}
