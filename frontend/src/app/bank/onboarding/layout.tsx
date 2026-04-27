import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get started — AEVION Bank",
  description: "Five-step setup for AEVION Bank — sign in, top up, send your first AEC, save toward a goal, build Trust Score. Each step takes seconds.",
  openGraph: {
    title: "Get started with AEVION Bank",
    description: "Five steps, sixty seconds, full creator-economy wallet.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "Get started — AEVION Bank",
    description: "Five-step setup. Sixty seconds.",
  },
  robots: { index: true, follow: true },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
