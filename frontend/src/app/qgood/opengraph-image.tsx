import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "QGood — Psychology & Mental Health";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "QGOOD",
      badge: "RESEARCH",
      title: "Mind, supported.",
      accent: "supported.",
      subtitle: "AI mental-health companion · offline mode · live-specialist escalation",
      pills: ["🧠 Clinical-grade", "📵 Offline", "🩺 HealthAI link", "🚑 Escalation"],
    },
    "emerald",
  );
}
