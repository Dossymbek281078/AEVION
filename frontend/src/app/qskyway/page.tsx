import type { Metadata } from "next";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import QSkywayClient from "./_client";

const TITLE = "QSkyway — navigation layer for the urban sky";
const DESCRIPTION =
  "Provider-independent 3D air corridors + rules for air taxis, live on real buildings in "
  + "Astana, NYC & Tokyo. Routed against what the regulators actually publish: FAA airspace "
  + "ceilings over Manhattan, Japan's MLIT permission regime over Tokyo — and an honest \"no "
  + "source\" where none exists. Live METAR wind, height-data provenance, an airspace-slot "
  + "rights market, and every flight exportable as a signed justification document.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "urban air mobility", "UAM", "eVTOL", "air taxi", "air corridors", "vertiport",
    "airspace management", "3D city", "navigation", "AEVION", "QSkyway",
  ],
  alternates: { canonical: "/qskyway" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/qskyway",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function Page() {
  const r = await fetchOrPaywall("/api/qskyway/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return <QSkywayClient />;
}
