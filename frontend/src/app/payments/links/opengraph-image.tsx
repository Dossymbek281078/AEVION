import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Payment Links";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Shareable links in seconds.",
      subtitle:
        "Generate one-time or recurring payment links. Public /pay/[id] checkout works on any device — no integration required.",
      badge: "Payment Links",
      accent: "#5eead4",
      accentSecondary: "#a78bfa",
      pills: ["Multi-currency", "Expiry", "Copy + Share", "Public checkout"],
      emoji: "🔗",
    }),
    { ...size }
  );
}
