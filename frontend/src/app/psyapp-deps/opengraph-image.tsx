import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "PsyApp — Dependencies Exit";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "PSYAPP",
      badge: "RESEARCH",
      title: "Out of the loop, on purpose.",
      accent: "on purpose.",
      subtitle: "Behavioral analytics · anonymous group support · early-warning · QGood escalation",
      pills: ["🎯 Trigger-детектор", "👥 Anonymous", "🚨 Early-warning", "🩺 Bridge → QGood"],
    },
    "rose",
  );
}
