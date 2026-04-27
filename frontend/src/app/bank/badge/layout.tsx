import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION Bank — Trust Badge embed",
  description: "Generate an embeddable Trust Badge SVG for your portfolio, profile, or website.",
  robots: { index: true, follow: true },
};

export default function BadgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
