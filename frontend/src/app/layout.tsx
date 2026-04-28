import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientProviders } from "@/components/ClientProviders";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app"),
  title: {
    default: "AEVION — Trust infrastructure for digital assets & IP",
    template: "%s · AEVION",
  },
  description:
    "Global platform for IP registration (QRight), cryptographic signatures (QSign), patent bureau, compliance certification (Planet), awards, digital banking and more. 27 product nodes on interactive Globus map.",
  openGraph: {
    title: "AEVION — Trust infrastructure & Globus",
    description:
      "Registry, signatures, bureau, compliance and product map. Live product environment.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — Trust OS",
    description: "Registry · signatures · bureau · compliance · bank · awards · 27 nodes.",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AEVION",
  url: "https://aevion.app",
  logo: "https://aevion.app/icon.png",
  description:
    "Trust infrastructure for digital assets and intellectual property. IP registry (QRight), cryptographic signatures (QSign), patent bureau, compliance certification (Planet), awards, digital banking.",
  sameAs: ["https://aevion.app/pitch"],
  contactPoint: [
    { "@type": "ContactPoint", contactType: "investor relations", email: "yahiin1978@gmail.com", areaServed: "Worldwide" },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AEVION",
  url: "https://aevion.app",
  inLanguage: ["en", "ru", "kk"],
  publisher: { "@type": "Organization", name: "AEVION" },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://aevion.app/help?q={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
