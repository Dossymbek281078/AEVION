import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "ShadowNet — privacy network simulator";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "SHADOW",
      badge: "IDEA",
      title: "Network without metadata.",
      accent: "without metadata.",
      subtitle: "Threat models · route simulation · anonymity score · encrypted notes",
      pills: ["🧪 Симулятор", "🗺 Маршрут", "📊 Оценка анонимности", "🔐 AES-GCM в браузере"],
    },
    "cyan",
  );
}
