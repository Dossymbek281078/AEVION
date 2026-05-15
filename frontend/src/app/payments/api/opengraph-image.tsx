import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Developer API";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "REST. JSON. Idempotent.",
      subtitle:
        "OpenAPI 3.1 spec, Bearer auth, Idempotency-Key header, official Node + Python SDKs, in-page Try-It runner backed by a real /api/payments/v1 surface.",
      badge: "Developer API",
      accent: "#a78bfa",
      accentSecondary: "#60a5fa",
      pills: ["OpenAPI 3.1", "Node + Python", "Try-It", "Bearer auth"],
      emoji: "⚙️",
    }),
    { ...size }
  );
}
