import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "ShadowNet — Alternative Private Network";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "SHADOW",
      badge: "IDEA",
      title: "Network without metadata.",
      accent: "without metadata.",
      subtitle: "Over VeilNetX · mesh fallback · E2E without metadata · open-source clients",
      pills: ["🧅 Над VeilNetX", "📡 Mesh fallback", "🔐 E2E", "📂 Open + reproducible"],
    },
    "cyan",
  );
}
