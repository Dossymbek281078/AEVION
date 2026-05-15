import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "DeepSan — Anti-chaos Productivity";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "DEEPSAN",
      badge: "RESEARCH",
      title: "Order from the inbox storm.",
      accent: "from the inbox storm.",
      subtitle: "Tasks as states · AI inbox parser · enforced focus · QCoreAI agent bridge",
      pills: ["🔁 States", "🧹 Inbox", "🎯 Focus", "🤖 QCoreAI"],
    },
    "rose",
  );
}
