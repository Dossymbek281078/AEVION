import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION · Live ecosystem demo — 27 nodes, one trust pipeline",
  description:
    "Walk through every AEVION module: registry → signature → bureau → compliance → wallet. Live API metrics. From idea to court-grade certificate in 90 seconds.",
  openGraph: {
    title: "AEVION ecosystem — live product demo",
    description: "12 live MVPs across IP, signatures, bureau, compliance, AI, banking, chess. Walk the full trust pipeline.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION live demo",
    description: "Walk every module of the trust ecosystem.",
  },
  alternates: { canonical: "/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
