import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Circles — AEVION Bank",
  description: "Group circles overview — your shared payment groups, member counts, recent activity. Drop a payment request, settle a tab, all in one chat-like surface.",
  openGraph: {
    title: "AEVION Bank Circles",
    description: "Group payments inside group chats. Settle tabs without screenshots.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank Circles",
    description: "Group circles for shared payments.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/bank/circles" },
};

export default function CirclesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
