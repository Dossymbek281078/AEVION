import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Disputes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Chargebacks, structured.",
      subtitle:
        "Open disputes against any paid link, track 5-state lifecycle (needs_response → under_review → won/lost), 7-day default response window, webhook fanout via the retry queue.",
      badge: "Disputes",
      accent: "#f87171",
      accentSecondary: "#fbbf24",
      pills: ["7-day SLA", "5 states", "Webhook retry", "Evidence trail"],
      emoji: "⚖",
    }),
    { ...size }
  );
}
