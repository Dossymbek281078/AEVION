import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "Startup Exchange — Protected Ideas Marketplace";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "STARTUPX",
      badge: "PLANNING",
      title: "Pitch first. Protect first.",
      accent: "Protect first.",
      subtitle: "QRight authorship · Smart-NDA · QPayNet escrow · public investor reputation",
      pills: ["🪪 QRight pitch", "🤝 Smart-NDA", "💸 Escrow", "👀 Public reputation"],
    },
    "violet",
  );
}
