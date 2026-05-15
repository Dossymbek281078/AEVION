import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "QMaskCard — Protected Bank Card";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "QMASKCARD",
      badge: "PLANNING",
      title: "Real card never leaves your wallet.",
      accent: "never leaves your wallet.",
      subtitle: "N virtual cards per real · per-merchant limits · self-destruct · antifraud on network",
      pills: ["🪪 N виртуальных", "🎯 Лимиты", "💣 Self-destruct", "🛡 Антифрод"],
    },
    "amber",
  );
}
