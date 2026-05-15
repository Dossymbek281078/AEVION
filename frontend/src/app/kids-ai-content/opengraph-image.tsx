import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "Kids AI Content — Safe Multi-language Learning";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "KIDS-AI",
      badge: "PLANNING",
      title: "Curious kids, safe AI.",
      accent: "safe AI.",
      subtitle: "Safe AI for kids · multi-language · speech therapy · age-tiered",
      pills: ["🛡 Safe by default", "🌐 Multi-language", "🗣 Логопедия", "🎯 По возрасту"],
    },
    "amber",
  );
}
