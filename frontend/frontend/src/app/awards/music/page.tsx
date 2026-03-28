import type { Metadata } from "next";
import { AwardPortal } from "../AwardPortal";

export const metadata: Metadata = {
  title: "AEVION Music Awards — премия Planet",
  description:
    "Музыкальная премия экосистемы AEVION: подача в Planet (тип music), сертификат compliance, голосование участников.",
  openGraph: {
    title: "AEVION Music Awards",
    description: "Премия для ИИ и цифровой музыки на слое Planet.",
  },
};

export default function MusicAwardsPage() {
  return <AwardPortal variant="music" />;
}
