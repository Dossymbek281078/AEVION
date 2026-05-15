import { planningOgImage, planningOgSize, planningOgContentType } from "@/lib/planningOg";

export const runtime = "edge";
export const alt = "QChainGov — DAO Governance";
export const size = planningOgSize;
export const contentType = planningOgContentType;

export default async function Image() {
  return planningOgImage(
    {
      code: "QCHAINGOV",
      badge: "IDEA",
      title: "Governance that survives a vote.",
      accent: "survives a vote.",
      subtitle: "Identity-bound votes · QSign chain · quadratic voting · delegate trees",
      pills: ["🪪 Identity-bound", "📜 Open initiatives", "✍️ QSign-chain", "🎯 Quadratic"],
    },
    "sky",
  );
}
