import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "MapReality — Map of Real Needs";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "MAPREALITY",
      badge: "IDEA",
      title: "The map editors don't show you.",
      accent: "don't show you.",
      subtitle: "Citizen-sourced geo signals · QSign audit · open API · no editorial spin",
      pills: ["📡 Citizen signals", "🗺 Raw geo-data", "🪪 QSign audit", "🔓 Open API"],
    },
    "cyan",
  );
}
