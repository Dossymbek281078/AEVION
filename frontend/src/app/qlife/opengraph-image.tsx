import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "QLife — Personal Operating System";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "QLIFE",
      badge: "IDEA",
      title: "Your entire life in one OS.",
      accent: "entire life in one OS.",
      subtitle: "Personal OS · shell over AEVION modules · cross-module AI insights · polyglot",
      pills: ["🪟 Shell", "🧠 Cross-module", "🩺 Healthy", "🌐 Polyglot"],
    },
    "emerald",
  );
}
