import type { Metadata } from "next";

// Админка QBuild: в выдаче ей не место. Из карты сайта исключена, но на
// страницу по ссылке робот зайдёт — метатег говорит это прямо.
export const metadata: Metadata = {
  title: "Verification queue — AEVION QBuild",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
