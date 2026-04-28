import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "Cool-down queue — AEVION Bank",
  description: "Anti-impulse 12-72h hold for non-essential payments. The wallet waits — you only confirm when it really matters.",
  openGraph: {
    title: "AEVION Bank Cool-Down Queue",
    description: "Anti-impulse hold for non-essential payments.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: { card: "summary_large_image", title: "AEVION Bank Cool-Down Queue", description: "Anti-impulse hold." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/cooldown" },
};

export default function CooldownLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/cooldown" name="Cool-Down Queue" />
      {children}
    </>
  );
}
