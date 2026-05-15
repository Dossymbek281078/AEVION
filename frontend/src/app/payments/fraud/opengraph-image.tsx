import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Fraud detection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Six-layer fraud net.",
      subtitle:
        "Velocity, BIN risk, country mismatch, QSign device fingerprint, high-amount review, proxy/VPN/Tor — blended into a single 0–100 score with a reviewer queue.",
      badge: "Fraud Detection",
      accent: "#fda4af",
      accentSecondary: "#fcd34d",
      pills: ["6 rules", "QSign device", "Reviewer queue", "Risk 0–100"],
      emoji: "🛡️",
    }),
    { ...size }
  );
}
