import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { getSiteUrl } from "@/lib/siteUrl";

// Dynamic SEO + JSON-LD for QStore product detail pages.
//
// The page itself is `"use client"` (it manages purchase, reviews, etc.), so
// metadata + structured data live here in the server-side layout. We fetch
// the same /api/qstore/products/:id endpoint the page uses, but with a short
// revalidate window so OG scrapers always get fresh title/price/rating.

type Product = {
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
  /** С 28.10.2026: демо-заглушка без файла — не продаётся. */
  demo?: boolean;
};

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function loadProduct(id: string): Promise<Product | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/qstore/products/${encodeURIComponent(id)}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { product?: Product };
    return json.product ?? null;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function priceLabel(price: number, currency: string): string {
  if (price === 0) return "Free";
  const code = (currency || "usd").toUpperCase();
  const sym = code === "USD" ? "$" : `${code} `;
  return `${sym}${(price / 100).toFixed(2)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const SITE = getSiteUrl();
  const canonical = `${SITE}/qstore/${encodeURIComponent(id)}`;
  const ogImage = `${SITE}/api-backend/api/qstore/og.svg?id=${encodeURIComponent(id)}`;

  const fallback: Metadata = {
    title: "Товар QStore — маркетплейс цифровых товаров AEVION",
    description:
      "Товар на маркетплейсе цифровых товаров AEVION QStore: продавцы выставляют свои шаблоны, пресеты, код, музыку и дизайн.",
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: "Товар QStore — AEVION",
      description: "Товар на маркетплейсе цифровых товаров AEVION QStore.",
      url: canonical,
      siteName: "AEVION",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "AEVION QStore" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Товар QStore — AEVION",
      description: "Товар на маркетплейсе цифровых товаров AEVION QStore.",
      images: [ogImage],
    },
  };

  const product = await loadProduct(id);
  if (!product) return fallback;

  const price = priceLabel(product.price, product.currency);
  // 28.10.2026: демо-заглушка — не товар: без цены в заголовке и без индексации.
  // «Digital delivery» снято: у платных товаров касса не подключена.
  const titleLine = product.demo
    ? clip(`${product.title} — демо-пример, не продаётся`, 60)
    : clip(`${product.title} — ${price} on AEVION QStore`, 60);
  const desc = clip(
    product.demo
      ? "Демо-пример карточки товара QStore: файла за ним нет, купить его нельзя."
      : product.description || `${product.category} on AEVION QStore.`,
    158
  );

  return {
    title: titleLine,
    description: desc,
    alternates: { canonical },
    ...(product.demo ? { robots: { index: false, follow: true } } : {}),
    keywords: [
      "AEVION",
      "QStore",
      "digital marketplace",
      product.category,
      ...(product.tags || []).slice(0, 8),
    ].filter(Boolean),
    openGraph: {
      type: "website",
      title: titleLine,
      description: desc,
      url: canonical,
      siteName: "AEVION",
      images: [{ url: ogImage, width: 1200, height: 630, alt: product.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleLine,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function QStoreItemLayout({ params, children }: Props) {
  const { id } = await params;
  const SITE = getSiteUrl();
  const product = await loadProduct(id);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
      { "@type": "ListItem", position: 2, name: "QStore", item: `${SITE}/qstore` },
      {
        "@type": "ListItem",
        position: 3,
        name: product?.title || "Product",
        item: `${SITE}/qstore/${encodeURIComponent(id)}`,
      },
    ],
  };

  // Предложение (Offer) для поисковика — только там, где его можно принять: демо-заглушка
  // не продаётся, а у платных товаров касса не подключена (сервер: 503 no_payment_provider,
  // на странице — форма «оплата скоро»). Остаются бесплатные товары, которые выдаются сразу.
  const offerable = !!product && !product.demo && product.price === 0;
  const productJsonLd = product && !product.demo
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": `${SITE}/qstore/${encodeURIComponent(product.id)}`,
        name: product.title,
        description: product.description || `${product.category} on AEVION QStore.`,
        category: product.category,
        sku: product.id,
        brand: { "@type": "Organization", name: "AEVION", url: SITE },
        image: product.previewUrl
          ? [product.previewUrl]
          : [`${SITE}/api-backend/api/qstore/og.svg?id=${encodeURIComponent(product.id)}`],
        offers: offerable ? {
          "@type": "Offer",
          price: (product.price / 100).toFixed(2),
          priceCurrency: (product.currency || "USD").toUpperCase(),
          availability: product.isPublic
            ? "https://schema.org/InStock"
            : "https://schema.org/Discontinued",
          url: `${SITE}/qstore/${encodeURIComponent(product.id)}`,
          seller: {
            "@type": "Organization",
            name: "AEVION QStore",
            url: `${SITE}/qstore/seller/${encodeURIComponent(product.sellerId)}`,
          },
          itemCondition: "https://schema.org/NewCondition",
        } : undefined,
        aggregateRating:
          product.avgRating && product.reviewCount && product.reviewCount > 0
            ? {
                "@type": "AggregateRating",
                ratingValue: Number(product.avgRating.toFixed(2)),
                reviewCount: product.reviewCount,
                bestRating: 5,
                worstRating: 1,
              }
            : undefined,
        keywords: (product.tags || []).join(", ") || undefined,
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {productJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      ) : null}
      {children}
    </>
  );
}
