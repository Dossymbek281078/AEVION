import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "LifeBox — Digital Safe for Future Self";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "LIFEBOX",
      badge: "PLANNING",
      title: "Letter to your future self, sealed.",
      accent: "sealed.",
      subtitle: "100-year storage · Shamir inheritance · QSign access audit · trigger-based unlock",
      pills: ["⏳ 100-летнее", "🪪 Shamir", "🔍 QSign audit", "🎚 Triggers"],
    },
    "amber",
  );
}
