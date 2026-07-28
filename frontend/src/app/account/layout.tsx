import type { Metadata } from "next";

// Служебная страница: в выдаче ей не место. Из карты сайта такие уже
// исключены 28.07.2026, но на страницу, куда ведёт ссылка, робот всё
// равно зайдёт — метатег говорит об этом прямо.
export const metadata: Metadata = {
  title: "Account — AEVION",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
