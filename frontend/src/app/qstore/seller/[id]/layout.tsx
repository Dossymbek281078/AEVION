import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { getSiteUrl } from "@/lib/siteUrl";

// Dynamic SEO + JSON-LD for QStore seller profile pages. The page is a
// client component; this server-side layout fetches the same profile feed
// the page renders to keep title/description/JSON-LD honest.

type SellerProduct = {
  id: string;
  title: string;
  category: string;
  price: number;
  salesCount: number;
};

type SellerProfile = {
  userId: string;
  products: SellerProduct[];
  totalSales: number;
  avgRating: number;
};

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function loadProfile(id: string): Promise<SellerProfile | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/qstore/sellers/${encodeURIComponent(id)}`, {
      next: { revalidate: 180 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SellerProfile;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const SITE = getSiteUrl();
  const canonical = `${SITE}/qstore/seller/${encodeURIComponent(id)}`;
  const ogImage = `${SITE}/api-backend/api/qstore/og.svg?seller=${encodeURIComponent(id)}`;

  const fallback: Metadata = {
    title: "Seller — AEVION QStore",
    description:
      "Seller profile on the AEVION QStore digital marketplace. View listings, total sales, ratings and reviews.",
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title: "Seller — AEVION QStore",
      description: "Seller profile on the AEVION QStore digital marketplace.",
      url: canonical,
      siteName: "AEVION",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "AEVION QStore seller" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Seller — AEVION QStore",
      description: "Seller profile on the AEVION QStore digital marketplace.",
      images: [ogImage],
    },
  };

  const profile = await loadProfile(id);
  if (!profile) return fallback;

  const shortId = id.length > 10 ? `${id.slice(0, 8)}…` : id;
  const titleLine = clip(
    `Seller ${shortId} — ${profile.products.length} listings on AEVION QStore`,
    60
  );
  const desc = clip(
    `${profile.products.length} digital products on AEVION QStore. ${profile.totalSales} total sales, ${profile.avgRating ? profile.avgRating.toFixed(1) : "—"}★ average rating.`,
    158
  );

  return {
    title: titleLine,
    description: desc,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      title: titleLine,
      description: desc,
      url: canonical,
      siteName: "AEVION",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Seller ${shortId}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleLine,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function QStoreSellerLayout({ params, children }: Props) {
  const { id } = await params;
  const SITE = getSiteUrl();
  const profile = await loadProfile(id);
  const canonical = `${SITE}/qstore/seller/${encodeURIComponent(id)}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
      { "@type": "ListItem", position: 2, name: "QStore", item: `${SITE}/qstore` },
      { "@type": "ListItem", position: 3, name: `Seller ${id}`, item: canonical },
    ],
  };

  const profileJsonLd = profile
    ? {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": canonical,
        url: canonical,
        name: `AEVION QStore seller ${id}`,
        mainEntity: {
          "@type": "Person",
          identifier: profile.userId,
          name: `Seller ${id}`,
          url: canonical,
          aggregateRating:
            profile.avgRating > 0
              ? {
                  "@type": "AggregateRating",
                  ratingValue: Number(profile.avgRating.toFixed(2)),
                  reviewCount: profile.products.length,
                  bestRating: 5,
                  worstRating: 1,
                }
              : undefined,
        },
      }
    : null;

  const itemListJsonLd =
    profile && profile.products.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Listings by seller ${id} on AEVION QStore`,
          numberOfItems: profile.products.length,
          itemListElement: profile.products.slice(0, 20).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE}/qstore/${encodeURIComponent(p.id)}`,
            name: p.title,
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {profileJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }}
        />
      ) : null}
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}
      {children}
    </>
  );
}
