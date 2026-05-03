import { ImageResponse } from "next/og";
import { ogJsx } from "../_og";

export const runtime = "edge";
export const alt = "AEVION Payments — Audit log";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    ogJsx({
      title: "Every API call, signed and traceable.",
      subtitle:
        "Append-only audit log of every state-changing call to the Payments Rail. Persisted via KV — survives cold starts. Filterable by action, target, actor.",
      badge: "Audit",
      accent: "#94a3b8",
      accentSecondary: "#cbd5e1",
      pills: ["Per-actor", "5s refresh", "1k retention", "KV-backed"],
      emoji: "🧾",
    }),
    { ...size }
  );
}
