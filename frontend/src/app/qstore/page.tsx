"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { catalog } from "@/lib/aevionCatalog";

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

interface FeaturedBuckets {
  popular: Product[];
  newest: Product[];
  trending: Product[];
  topRated: Product[];
}

const SORT_OPTIONS: { id: string; name: string }[] = [
  { id: "popular", name: "Most popular" },
  { id: "newest", name: "Newest" },
  { id: "trending", name: "Trending" },
  { id: "rating", name: "Top rated" },
];

const CATEGORIES = [
  { id: "", name: "All" },
  { id: "template", name: "Templates" },
  { id: "preset", name: "Presets" },
  { id: "music", name: "Music" },
  { id: "video", name: "Video" },
  { id: "design", name: "Design" },
  { id: "code", name: "Code" },
  { id: "other", name: "Other" },
];

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

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.fg,
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {category}
    </span>
  );
}

function ProductCard({
  product,
  onPurchase,
  compact,
}: {
  product: Product;
  onPurchase: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/qstore/${product.id}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: compact ? 14 : 20,
          display: "flex",
          flexDirection: "column",
          gap: compact ? 8 : 10,
          transition: "box-shadow 0.15s, transform 0.15s",
          cursor: "pointer",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {product.previewUrl && (
          <div
            style={{
              width: "100%",
              height: compact ? 90 : 120,
              background: "#f8fafc",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <img
              src={product.previewUrl}
              alt={product.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <CategoryBadge category={product.category} />
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{product.salesCount} sales</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: compact ? 14 : 15, color: "#0f172a", lineHeight: 1.3 }}>
          {product.title}
        </div>
        {!compact && product.description && (
          <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
            {product.description.slice(0, 100)}{product.description.length > 100 ? "..." : ""}
          </div>
        )}
        {!!(product.avgRating && product.avgRating > 0) && (
          <div style={{ fontSize: 12, color: "#f59e0b", display: "flex", alignItems: "center", gap: 4 }}>
            <span>★ {product.avgRating.toFixed(1)}</span>
            <span style={{ color: "#94a3b8" }}>({product.reviewCount ?? 0})</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: compact ? 14 : 16,
              color: product.price === 0 ? "#0d9488" : "#0f172a",
            }}
          >
            {priceLabel(product.price, product.currency)}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPurchase(product.id);
            }}
            style={{
              padding: compact ? "5px 12px" : "7px 16px",
              borderRadius: 8,
              border: "none",
              background: product.price === 0
                ? "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)"
                : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: compact ? 12 : 13,
              cursor: "pointer",
            }}
          >
            {product.price === 0 ? "Get free" : "Buy"}
          </button>
        </div>
      </div>
    </Link>
  );
}

interface CreateForm {
  title: string;
  description: string;
  category: string;
  price: string;
}

export default function QStorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState<string>("popular");
  const [featured, setFeatured] = useState<FeaturedBuckets | null>(null);
  const [featuredTab, setFeaturedTab] = useState<keyof FeaturedBuckets>("popular");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>({ title: "", description: "", category: "template", price: "0" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      // SDK supports the `sort` parameter only. When the user applies a
      // category filter or a search query — both server-side params the
      // SDK doesn't expose yet — fall back to a raw fetch so behaviour
      // stays identical to before this refactor.
      if (selectedCategory || searchQ) {
        const params = new URLSearchParams();
        if (selectedCategory) params.set("category", selectedCategory);
        if (searchQ) params.set("q", searchQ);
        if (sortBy) params.set("sort", sortBy);
        const res = await fetch(apiUrl(`/api/qstore/products?${params}`));
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        const data = await catalog.qstore.products({
          sort: sortBy as "popular" | "newest" | "trending" | "rating",
        });
        // SDK response shape: { total, sort, items }. Backend legacy used
        // `products`. Cast through unknown — backend item shape is a
        // superset of QStoreProduct.
        const items = (data as unknown as { items?: Product[]; products?: Product[] });
        setProducts(items.items || items.products || []);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQ, sortBy]);

  const fetchFeatured = useCallback(async () => {
    try {
      const data = await catalog.qstore.featured({ limit: 6 });
      setFeatured({
        popular: (data.popular as unknown as Product[]) || [],
        newest: (data.newest as unknown as Product[]) || [],
        trending: (data.trending as unknown as Product[]) || [],
        topRated: (data.topRated as unknown as Product[]) || [],
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchFeatured();
  }, [fetchFeatured]);

  const handlePurchase = async (productId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token") : null;
    if (!token) {
      setNotice("Sign in to purchase products.");
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/qstore/products/${productId}/purchase`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        if (d.checkoutUrl) {
          window.location.href = d.checkoutUrl;
        } else {
          setNotice("Purchase successful!");
          fetchProducts();
          fetchFeatured();
        }
      } else if (d.error?.includes("checkout_not_enabled")) {
        setNotice("Payment gateway is being verified — available within 1-3 days. Write us at support@aevion.app to purchase manually.");
      } else {
        setNotice(d.error || "Purchase failed");
      }
    } catch {
      setNotice("Network error");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token") : null;
    if (!token) { setFormError("Sign in to list products"); return; }
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/api/qstore/me/products"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          price: Number(form.price) * 100, // convert to cents
        }),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error || "Failed to create"); return; }
      setShowForm(false);
      setForm({ title: "", description: "", category: "template", price: "0" });
      fetchProducts();
      fetchFeatured();
    } catch {
      setFormError("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px 80px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
                QStore
              </h1>
              <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                Digital marketplace — templates, code, music & more
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              + List a product
            </button>
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

          {/* Create form */}
          {showForm && (
            <div
              style={{
                background: "#fff",
                border: "1.5px solid #0d9488",
                borderRadius: 14,
                padding: 24,
                marginBottom: 28,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 16 }}>
                List a new product
              </div>
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  placeholder="Title *"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                />
                <textarea
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, resize: "vertical" }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                  >
                    {CATEGORIES.slice(1).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Price (USD, 0 = free)"
                    value={form.price}
                    min="0"
                    step="0.01"
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                  />
                </div>
                {formError && <div style={{ color: "#dc2626", fontSize: 13 }}>{formError}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: creating ? "#e2e8f0" : "#0d9488",
                      color: creating ? "#94a3b8" : "#fff",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: creating ? "not-allowed" : "pointer",
                    }}
                  >
                    {creating ? "Listing..." : "List product"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFormError(null); }}
                    style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Featured section */}
          {featured && (featured.popular.length > 0 || featured.newest.length > 0 || featured.trending.length > 0) && (
            <section style={{ marginBottom: 36 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  ✨ Featured
                </h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(
                    [
                      { id: "popular", label: "🔥 Popular" },
                      { id: "trending", label: "📈 Trending" },
                      { id: "newest", label: "🆕 New" },
                      { id: "topRated", label: "⭐ Top rated" },
                    ] as { id: keyof FeaturedBuckets; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFeaturedTab(t.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 18,
                        border: featuredTab === t.id ? "1.5px solid #7c3aed" : "1.5px solid #e2e8f0",
                        background: featuredTab === t.id ? "#f5f3ff" : "#fff",
                        color: featuredTab === t.id ? "#6d28d9" : "#64748b",
                        fontWeight: featuredTab === t.id ? 700 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {featured[featuredTab].length === 0 ? (
                <div
                  style={{
                    background: "#fff",
                    border: "1px dashed #e2e8f0",
                    borderRadius: 12,
                    padding: 24,
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}
                >
                  Nothing here yet.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 14,
                  }}
                >
                  {featured[featuredTab].map((p) => (
                    <ProductCard key={p.id} product={p} onPurchase={handlePurchase} compact />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Category filter chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: selectedCategory === c.id ? "2px solid #0d9488" : "2px solid #e2e8f0",
                  background: selectedCategory === c.id ? "#f0fdfa" : "#fff",
                  color: selectedCategory === c.id ? "#0d9488" : "#374151",
                  fontWeight: selectedCategory === c.id ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {c.name}
              </button>
            ))}
            <input
              placeholder="Search..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "2px solid #e2e8f0",
                fontSize: 16,
                outline: "none",
                minWidth: 140,
                flex: "1 1 160px",
                maxWidth: 240,
              }}
            />
          </div>

          {/* Sort + result heading */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 14, color: "#64748b" }}>
              {loading ? "" : `${products.length} ${products.length === 1 ? "product" : "products"}`}
              {selectedCategory && (
                <span style={{ marginLeft: 6, color: "#0d9488", fontWeight: 600 }}>
                  · {CATEGORIES.find((c) => c.id === selectedCategory)?.name}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#fff",
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 600,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Product grid */}
          {loading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px 0", fontSize: 15 }}>
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                No products yet
              </div>
              <div style={{ fontSize: 14 }}>Be the first to list one!</div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                gap: 20,
              }}
            >
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onPurchase={handlePurchase} />
              ))}
            </div>
          )}
        </div>
      </ProductPageShell>
    </>
  );
}
