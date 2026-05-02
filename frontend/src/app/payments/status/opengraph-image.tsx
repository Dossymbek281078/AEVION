import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Status";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "All systems operational.",
      subtitle:
        "Live health checks against every public endpoint and the in-memory store. Auto-refreshes every 30 seconds; transparent surface counts and uptime.",
      badge: "Status",
      accent: "#86efac",
      accentSecondary: "#5eead4",
      pills: ["Live checks", "Auto 30s", "Endpoint latency", "Surface counts"],
      emoji: "🟢",
    }),
    { ...size }
  );
}
