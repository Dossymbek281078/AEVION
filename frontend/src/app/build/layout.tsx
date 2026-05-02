import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AEVION QBuild — Construction & Recruiting",
  description:
    "QBuild is the AEVION marketplace for construction projects, vacancies, and direct contractor messaging. Post projects, hire crews, get hired.",
  openGraph: {
    type: "website",
    title: "AEVION QBuild",
    description:
      "Marketplace for construction projects, vacancies, and direct contractor messaging.",
    siteName: "AEVION QBuild",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QBuild",
    description:
      "Marketplace for construction projects, vacancies, and direct contractor messaging.",
  },
};

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* PWA manifest for /build — enables "Add to Home Screen" on mobile */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <link rel="manifest" href="/build-manifest.json" />
      {children}
    </>
  );
}
