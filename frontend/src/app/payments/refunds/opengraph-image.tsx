import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Refunds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Refunds, signed and traceable.",
      subtitle:
        "Issue partial or full refunds against any paid link. payment.refunded webhooks fire to every enabled endpoint with the same HMAC scheme as captures.",
      badge: "Refunds",
      accent: "#fb923c",
      accentSecondary: "#f59e0b",
      pills: ["Partial refunds", "HMAC fanout", "Idempotent", "Audit-ready"],
      emoji: "↩",
    }),
    { ...size }
  );
}
