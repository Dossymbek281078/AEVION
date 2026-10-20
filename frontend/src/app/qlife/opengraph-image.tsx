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
      title: "Longevity log: biomarkers and habits.",
      accent: "biomarkers and habits.",
      subtitle: "Biomarker log · trends · AI habits plan · not medical advice, results not guaranteed",
      pills: ["🧪 Biomarkers", "📈 Trends", "🧠 AI plan", "⚕ Not medical advice"],
    },
    "emerald",
  );
}
