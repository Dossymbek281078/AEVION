import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "QPersona — AI Personality Twin";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "QPERSONA",
      badge: "RESEARCH",
      title: "Your AI doppelganger.",
      accent: "doppelganger.",
      subtitle: "Text + voice + decision-history clone · delegates routine comms in your style",
      pills: ["📝 Текст", "🎙 Голос", "🧠 Решения", "🪪 QSign-аудит"],
    },
    "rose",
  );
}
