import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Compliance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Compliance, file-and-forget.",
      subtitle:
        "4-tier KYC ladder, sanctions screening across OFAC / EU / UN / UK / KZ, multi-jurisdiction VAT/GST, downloadable Planet-anchored reports.",
      badge: "Compliance",
      accent: "#a5b4fc",
      accentSecondary: "#c4b5fd",
      pills: ["KYC tiers", "5 sanctions lists", "VAT / GST", "Planet-anchored"],
      emoji: "📋",
    }),
    { ...size }
  );
}
