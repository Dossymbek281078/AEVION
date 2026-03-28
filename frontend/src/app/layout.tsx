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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
