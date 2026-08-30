import type { Metadata } from "next";
import { BreadcrumbsJsonLd } from "../_components/BreadcrumbsJsonLd";

export const metadata: Metadata = {
  title: "AEVION Bank — Leaderboard",
  description: "Top creators, chess champions, and referrers across the AEVION trust network.",
  robots: { index: true, follow: true },
  // Своя карточка предпросмотра. Без неё ссылка на таблицу лидеров приходит в
  // мессенджер общим заголовком сайта — а её пересылают чаще прочих страниц
  // банка, ради того чтобы показать своё место.
  openGraph: {
    title: "AEVION Bank — Leaderboard",
    description: "Top creators, chess champions and referrers across the AEVION trust network.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Bank — Leaderboard",
    description: "Top creators, chess champions and referrers across the AEVION trust network.",
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbsJsonLd path="/bank/leaderboard" name="Leaderboard" />
      {children}
    </>
  );
}
