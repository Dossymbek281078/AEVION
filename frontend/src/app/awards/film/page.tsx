import type { Metadata } from "next";
import { AwardPortal } from "../AwardPortal";

export const metadata: Metadata = {
  title: "AEVION Film Awards — премия Planet",
  description:
    "Кинопремия экосистемы AEVION: подача в Planet (тип movie), сертификат compliance, голосование участников.",
  openGraph: {
    title: "AEVION Film Awards",
    description: "Премия для ИИ и цифрового кино на слое Planet.",
  },
};

export default function FilmAwardsPage() {
  return <AwardPortal variant="film" />;
}
