import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "Z-Tide — Energy & Emotion Currency";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "Z-TIDE",
      badge: "IDEA",
      title: "Currency, but energy-anchored.",
      accent: "energy-anchored.",
      subtitle: "Research project · energy-anchored experimental currency · QSign-audited · parallel to AEV",
      pills: ["🔬 Research", "⚡ Energy-anchored", "🪪 Не анонимна", "🪐 Параллельный"],
    },
    "violet",
  );
}
