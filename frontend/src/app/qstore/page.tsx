"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthToken } from "@/lib/auth";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { catalog } from "@/lib/aevionCatalog";
import { PaddleUpgradeButton } from "@/components/PaddleUpgradeButton";
import ModulePricingChip from "@/components/ModulePricingChip";
import { useQstoreT } from "./i18n";

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

// Подписи — из словаря (./i18n): здесь только идентификаторы.
const SORT_IDS = ["popular", "newest", "trending", "rating"] as const;

const CATEGORY_IDS = ["", "template", "preset", "music", "video", "design", "code", "other"] as const;

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  template: { bg: "#dbeafe", fg: "#1d4ed8" },
  preset: { bg: "#fce7f3", fg: "#9d174d" },
  music: { bg: "#dcfce7", fg: "#15803d" },
  video: { bg: "#ffedd5", fg: "#9a3412" },
  design: { bg: "#f3e8ff", fg: "#6b21a8" },
  code: { bg: "#d1fae5", fg: "#065f46" },
  other: { bg: "#f1f5f9", fg: "#475569" },
};

function priceLabel(price: number, currency: string, free: string): string {
  if (price === 0) return free;
  const sym = currency === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${sym}${(price / 100).toFixed(2)}`;
}

function CategoryBadge({ category }: { category: string }) {
  const { catName } = useQstoreT();
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
      {catName(category)}
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
  const { t } = useQstoreT();
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
            {priceLabel(product.price, product.currency, t("free"))}
          </span>
          {/* 20.10.2026: у платных товаров кассы нет (503 no_payment_provider) — вместо «Buy»
              ведём на страницу товара, где форма «Payment soon — leave your email» (QStoreNotify). */}
          {product.price > 0 ? (
            <span
              data-qstore-payment-soon
              style={{ padding: compact ? "5px 12px" : "7px 16px", borderRadius: 8, background: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: compact ? 12 : 13 }}
            >
              {t("paySoon")}
            </span>
          ) : (
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
            /* Имя РАЗЛИЧАЕТ товар, а не повторяет действие.
               Замер соседнего окна на живом проде 04.09.2026: на этой странице
               27 кнопок с одинаковым именем «купить». Читалка умеет показать
               список кнопок — человек так и выбирает, куда нажать; двадцать
               семь одинаковых строк подряд выбирать не дают. И это
               единственный экран платформы, где отдают деньги за КОНКРЕТНЫЙ
               товар.
               Признак опасного места общий: подпись внутри цикла отрисовки. */
            aria-label={
              product.price === 0
                ? t("getFree.aria", { title: product.title })
                : t("buy.aria", { title: product.title })
            }
          >
            {product.price === 0 ? t("getFree") : t("buy")}
          </button>
          )}
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
  const { t, count, catName } = useQstoreT();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
        // Отказ хранилища и пустой каталог — РАЗНЫЕ новости, а `|| []`
        // превращало первое во второе. С 21.08.2026 бэкенд отвечает 503 и
        // объяснением вместо пустого списка; без этой проверки покупатель
        // по-прежнему видел бы работающий пустой магазин и ушёл бы.
        if (!res.ok) {
          setLoadError(
            typeof data?.warning === "string"
              ? data.warning
              : t("err.catalog"),
          );
          setProducts([]);
          return;
        }
        setLoadError(null);
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
    const token = typeof window !== "undefined" ? getAuthToken() : null;
    if (!token) {
      setNotice(t("n.signInBuy"));
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
          setNotice(t("n.bought"));
          fetchProducts();
          fetchFeatured();
        }
      } else if (d.error?.includes("checkout_not_enabled")) {
        setNotice(t("n.gateway"));
      } else {
        // Сервер отдаёт человеческий `message` рядом с машинным `error` —
        // читаем именно его. Без этого покупатель видел бы код вроде
        // "no_payment_provider": 19.08.2026 в бэкенде появились честные
        // отказы вместо тихой выдачи товара без оплаты, и без этой строки
        // одна незаметная неисправность заменилась бы другой — кнопкой,
        // которая ругается непонятным словом.
        setNotice(d.message || d.error || t("n.buyFailed"));
      }
    } catch {
      setNotice(t("n.network"));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const token = typeof window !== "undefined" ? getAuthToken() : null;
    if (!token) { setFormError(t("n.signInList")); return; }
    if (!form.title.trim()) { setFormError(t("n.titleReq")); return; }
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
      if (!res.ok) { setFormError(d.error || t("n.createFailed")); return; }
      setShowForm(false);
      setForm({ title: "", description: "", category: "template", price: "0" });
      fetchProducts();
      fetchFeatured();
    } catch {
      setFormError(t("n.network"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Wave1Nav />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px 16px" }}>
        <PaddleUpgradeButton variant="banner" appId="qstore" />
        <div style={{ marginTop: 10 }}>
          <ModulePricingChip moduleId="qstore" />
        </div>
      </div>
      <ProductPageShell>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px 80px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
                QStore
              </h1>
              <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                {t("hero.sub")}
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
              {t("hero.list")}
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
              <button onClick={() => setNotice(null)} aria-label={t("close")} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 700 }}>×</button>
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
                {t("form.heading")}
              </div>
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input aria-label={t("form.title")}
                  placeholder={t("form.titlePh")}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                />
                <textarea aria-label={t("form.desc")}
                  placeholder={t("form.desc")}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, resize: "vertical" }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <select
                    aria-label={t("form.category")}
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                  >
                    {CATEGORY_IDS.slice(1).map((c) => (
                      <option key={c} value={c}>{catName(c)}</option>
                    ))}
                  </select>
                  <input aria-label={t("form.price")}
                    type="number"
                    placeholder={t("form.pricePh")}
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
                    {creating ? t("form.listing") : t("form.submit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFormError(null); }}
                    style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#64748b" }}
                  >
                    {t("form.cancel")}
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
                  {t("featured")}
                </h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(
                    [
                      { id: "popular", label: t("featured.popular") },
                      { id: "trending", label: t("featured.trending") },
                      { id: "newest", label: t("featured.newest") },
                      { id: "topRated", label: t("featured.topRated") },
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
                  {t("featured.empty")}
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
            {CATEGORY_IDS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: selectedCategory === c ? "2px solid #0d9488" : "2px solid #e2e8f0",
                  background: selectedCategory === c ? "#f0fdfa" : "#fff",
                  color: selectedCategory === c ? "#0d9488" : "#374151",
                  fontWeight: selectedCategory === c ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {c ? catName(c) : t("cat.all")}
              </button>
            ))}
            <input aria-label={t("search.aria")}
              placeholder={t("search")}
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
              {loading ? "" : count("count", products.length)}
              {selectedCategory && (
                <span style={{ marginLeft: 6, color: "#0d9488", fontWeight: 600 }}>
                  · {catName(selectedCategory)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("sort.label")}</span>
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
                {SORT_IDS.map((o) => (
                  <option key={o} value={o}>{t(`sort.${o}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Product grid */}
          {loading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px 0", fontSize: 15 }}>
              {t("loading")}
            </div>
          ) : loadError ? (
            // Отдельное состояние, а не «товаров нет». Пустой каталог при
            // живой базе — это ответ; пустой при упавшей — отказ, и говорить
            // «будьте первым» в этот момент значит выдавать сбой за законную
            // пустоту: человек уйдёт, решив, что магазин пуст.
            <div
              role="alert"
              style={{ textAlign: "center", color: "#78350f", padding: "48px 20px" }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                {t("err.catalogH")}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.55, maxWidth: 520, margin: "0 auto" }}>
                {loadError}
              </div>
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                {t("empty.h")}
              </div>
              <div style={{ fontSize: 14 }}>{t("empty.p")}</div>
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
