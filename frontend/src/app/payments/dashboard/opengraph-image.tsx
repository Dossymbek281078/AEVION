import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Every surface, one screen.",
      subtitle:
        "Live MRR, pending settlements, fraud queue, webhook deliveries, and active links — aggregated across all 8 surfaces of the Payments Rail.",
      badge: "Dashboard",
      accent: "#5eead4",
      accentSecondary: "#86efac",
      pills: ["MRR", "Settlements", "Webhooks 24h", "Activity feed"],
      emoji: "📊",
    }),
    { ...size }
  );
}
