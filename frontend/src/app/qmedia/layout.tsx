import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QMedia — Music · Videos · Creative AI · AEVION",
  description: "Stream music, watch videos, create with AI: lyrics, titles, color palettes — all in one social media hub.",
  alternates: { canonical: "https://aevion.app/qmedia" },
  openGraph: {
    type: "website",
    url: "https://aevion.app/qmedia",
    title: "QMedia — Music · Videos · Creative AI",
    description: "All-in-one media hub: tracks, playlists, videos, AI lyrics/titles/palettes.",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

export default function QMediaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QMedia",
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web",
            description: "Music streaming, video sharing, and AI creative tools (lyrics, titles, color palettes) on one social hub.",
            url: "https://aevion.app/qmedia",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Music streaming + playlists",
              "Video sharing",
              "AI lyrics generator",
              "AI song title suggestions",
              "AI mood-based color palettes",
              "Likes + creator profiles",
            ],
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />
      {children}
    </>
  );
}
