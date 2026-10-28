"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthToken } from "@/lib/auth";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { QStoreNotify } from "../QStoreNotify";
import { useQStoreT, catName, priceText, dateText } from "../i18n";

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
  /** С 28.10.2026 сервер отдаёт demo: true у заглушек без файла — их не продаём. */
  demo?: boolean;
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
  const id = String(params?.id ?? "");
  const { lang, t } = useQStoreT();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Отказ показывается отказом (красным, role="alert"), а не зелёной плашкой.
  const [noticeIsError, setNoticeIsError] = useState(false);
  const showNotice = (text: string, isError: boolean) => {
    setNotice(text);
    setNoticeIsError(isError);
  };
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
      // 503 хранилища — не «товара нет»: отдельное состояние.
      if (!pRes.ok) {
        setLoadFailed(true);
        setProduct(null);
        return;
      }
      setLoadFailed(false);
      const pData = await pRes.json();
      setProduct(pData.product || null);
      if (rRes.ok) {
        const rData = await rRes.json();
        setReviews(rData.reviews || []);
      }
    } catch {
      setLoadFailed(true);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handlePurchase = async () => {
    if (!product || product.demo) return;
    const token = typeof window !== "undefined" ? getAuthToken() : null;
    if (!token) {
      showNotice(t("buy.signIn"), true);
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch(apiUrl(`/api/qstore/products/${product.id}/purchase`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.checkoutUrl) {
        window.location.href = d.checkoutUrl;
      } else if (res.ok) {
        showNotice(t("buy.done"), false);
        fetchAll();
      } else {
        // Код сервера на экран не идёт. 410 demo_product_not_for_sale — тот же
        // текст, что на плашке демо-товара, и карточка переходит в демо-вид.
        const code = typeof d?.error === "string" ? d.error : "";
        if (res.status === 410 || code === "demo_product_not_for_sale") {
          setProduct((p) => (p ? { ...p, demo: true } : p));
          showNotice(t("demo.badge"), true);
        } else if (code === "no_payment_provider") showNotice(t("buy.noProvider"), true);
        else if (res.status === 401) showNotice(t("buy.signIn"), true);
        else if (res.status === 404) showNotice(t("buy.notFound"), true);
        else showNotice(t("buy.fail"), true);
      }
    } catch {
      showNotice(t("net.error"), true);
    } finally {
      setPurchasing(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const token = typeof window !== "undefined" ? getAuthToken() : null;
    if (!token) {
      showNotice(t("item.reviewSignIn"), true);
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
        showNotice(t("item.reviewPosted"), false);
        setReviewComment("");
        setReviewRating(5);
        fetchAll();
      } else {
        showNotice(res.status === 401 ? t("item.reviewSignIn") : t("item.reviewFail"), true);
      }
    } catch {
      showNotice(t("net.error"), true);
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
            {t("item.loading")}
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
            {loadFailed && !notFound ? (
              <p role="alert" style={{ color: "#78350f", marginBottom: 24, fontWeight: 600 }}>
                {t("item.loadFail")}
              </p>
            ) : (
              <>
                <h1 style={{ fontSize: 24, color: "#0f172a", margin: "0 0 8px" }}>{t("item.notFound")}</h1>
                <p style={{ color: "#64748b", marginBottom: 24 }}>
                  {t("item.notFoundBody")}
                </p>
              </>
            )}
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
              {t("item.back")}
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
            <span>{catName(lang, product.category)}</span>
          </div>

          {/* Notice */}
          {notice && (
            <div
              role={noticeIsError ? "alert" : "status"}
              data-qstore-notice={noticeIsError ? "error" : "ok"}
              style={{
                background: noticeIsError ? "#fef2f2" : "#f0fdf4",
                border: noticeIsError ? "1px solid #fecaca" : "1px solid #bbf7d0",
                borderRadius: 10,
                padding: "10px 16px",
                marginBottom: 20,
                color: noticeIsError ? "#991b1b" : "#166534",
                fontSize: 14,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              {notice}
              <button aria-label={t("page.close")} onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>×</button>
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
                  }}
                >
                  {catName(lang, product.category)}
                </span>
                {avgRating > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
                    <StarRating value={avgRating} />
                    <span style={{ fontWeight: 600, color: "#374151" }}>{avgRating.toFixed(1)}</span>
                    <span>({t("item.reviewsShort", { n: reviewCount })})</span>
                  </span>
                )}
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
                  {priceText(lang, product.price, product.currency)}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
                  {t("item.listed", { date: dateText(lang, product.createdAt) })}
                </div>

                {product.demo ? (
                  // 28.10.2026: демо-заглушка без файла — ни кнопки, ни формы «оплата скоро».
                  <div data-qstore-demo role="note" style={{ padding: "12px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t("demo.badge")}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>{t("demo.hint")}</div>
                  </div>
                ) : product.price > 0 ? (
                  <QStoreNotify productId={product.id} productTitle={product.title} />
                ) : (
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
                  {purchasing ? t("buy.processing") : t("card.getFree")}
                </button>
                )}

                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, fontSize: 13, color: "#64748b" }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#94a3b8" }}>{t("item.seller")}</span>{" "}
                    <Link
                      href={`/qstore/seller/${encodeURIComponent(product.sellerId)}`}
                      style={{ color: "#0d9488", fontWeight: 600, textDecoration: "none" }}
                    >
                      {product.sellerId.slice(0, 12)}…
                    </Link>
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
                    {t("item.sellerProfile")}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews section */}
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 16px" }}>
              {t("item.reviewsHeading", { n: reviewCount })}
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
                {t("item.leaveReview")}
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
                    aria-label={t("item.stars", { n })}
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
                aria-label={t("item.reviewAria")}
                placeholder={t("item.reviewPh")}
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
                {reviewSubmitting ? t("item.posting") : t("item.postReview")}
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
                {t("item.noReviews")}
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
                        {dateText(lang, r.createdAt)}
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
