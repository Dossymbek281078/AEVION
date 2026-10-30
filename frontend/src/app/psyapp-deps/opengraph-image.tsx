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
      // 28.10.2026: прежде «behavioral analytics · group support · early-warning · QGood escalation» — ничего из этого
      // в PsyApp нет (в planningStubs это «planned»). Здесь — то, что работает на проде.
      subtitle: "Anonymous day counter · trigger journal · AI support · daily affirmations",
      pills: ["📅 Day counter", "📓 Trigger journal", "💬 AI support", "👤 Anonymous"],
    },
    "rose",
  );
}
