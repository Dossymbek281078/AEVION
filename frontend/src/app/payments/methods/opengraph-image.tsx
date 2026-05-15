import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Payment Methods";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "12 methods. One API.",
      subtitle:
        "Cards, wallets (Apple Pay, Google Pay, Kaspi), bank transfers (SEPA, ACH, Wire), crypto (BTC Lightning, USDC), and AEVION rails — unified.",
      badge: "Payment Methods",
      accent: "#60a5fa",
      accentSecondary: "#a78bfa",
      pills: ["Visa & MC", "Apple Pay", "USDC", "AEC Credits"],
      emoji: "💳",
    }),
    { ...size }
  );
}
