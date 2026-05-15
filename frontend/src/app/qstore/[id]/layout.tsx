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
    title: "QStore product — AEVION digital marketplace",
    description:
      "Digital product on the AEVION QStore marketplace: templates, presets, code, music and design assets. Public catalogue, instant delivery.",
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: "QStore product — AEVION",
      description: "Digital product on the AEVION QStore marketplace.",
      url: canonical,
      siteName: "AEVION",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "AEVION QStore" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "QStore product — AEVION",
      description: "Digital product on the AEVION QStore marketplace.",
      images: [ogImage],
    },
  };

  const product = await loadProduct(id);
  if (!product) return fallback;

  const price = priceLabel(product.price, product.currency);
  const titleLine = clip(`${product.title} — ${price} on AEVION QStore`, 60);
  const desc = clip(
    product.description ||
      `${product.category} on AEVION QStore. ${product.salesCount} sales. Digital delivery.`,
    158
  );

  return {
    title: titleLine,
    description: desc,
    alternates: { canonical },
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

  const productJsonLd = product
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
        offers: {
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
        },
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
