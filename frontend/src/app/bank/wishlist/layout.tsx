import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Wishlist — AEVION Bank",
  description: "Items you're saving toward — each with its own savings counter and target. Pulled from your wallet's local state.",
  openGraph: {
    title: "AEVION Bank Wishlist",
    description: "Wants with savings counters.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Wishlist", description: "Save toward what you want." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/wishlist" },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/wishlist" name="Wishlist" />
      {children}
    </>
  );
}
