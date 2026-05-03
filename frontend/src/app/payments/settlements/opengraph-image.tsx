import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Settlements";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Settle with auto-split.",
      subtitle:
        "Daily or on-demand payouts to bank or AEC wallet. Royalty splits to creator pool / IP holder / platform / treasury execute via AEVION Bank.",
      badge: "Settlements",
      accent: "#86efac",
      accentSecondary: "#5eead4",
      pills: ["Bank + AEC", "Royalty split", "Multi-currency", "Audit trail"],
      emoji: "🏦",
    }),
    { ...size }
  );
}
