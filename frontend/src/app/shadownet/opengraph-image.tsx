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
      // 28.10: прежде «Network without metadata.» — сервер хранит псевдоним, время и размер заметки, это неправда
      title: "Encrypted notes. Simulated routes.",
      accent: "Simulated routes.",
      subtitle: "Threat models · route simulation · anonymity score · encrypted notes",
      pills: ["🧪 Simulator", "🗺 Route", "📊 Anonymity score", "🔐 AES-GCM in the browser"],
    },
    "cyan",
  );
}
