import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Subscriptions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Recurring billing, simplified.",
      subtitle:
        "Plans with optional trials, weekly through yearly intervals, smart-dunning retries on day 1/3/7, MRR + ARR tracking across 4 currencies.",
      badge: "Subscriptions",
      accent: "#7dd3fc",
      accentSecondary: "#c4b5fd",
      pills: ["Trials", "MRR / ARR", "Smart dunning", "4 currencies"],
      emoji: "🔁",
    }),
    { ...size }
  );
}
