import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Webhooks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Signed events. Replay-safe.",
      subtitle:
        "HMAC-SHA256 signed payloads, X-AEVION-Timestamp + X-AEVION-Signature headers, exponential-backoff retries, full delivery audit log.",
      badge: "Webhooks",
      accent: "#c4b5fd",
      accentSecondary: "#5eead4",
      pills: ["HMAC-SHA256", "5-min replay window", "Retry", "Audit log"],
      emoji: "⚡",
    }),
    { ...size }
  );
}
