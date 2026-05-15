import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "Voice of Earth — Multi-language Music";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "VOE",
      badge: "IDEA",
      title: "Voices of Earth, one song.",
      accent: "one song.",
      subtitle: "Multi-language songs · on-chain authorship · open royalty splits",
      pills: ["🌍 Multi-language", "🪪 QRight + QSign", "💰 Open royalties", "🎬 Awards/Globus"],
    },
    "sky",
  );
}
