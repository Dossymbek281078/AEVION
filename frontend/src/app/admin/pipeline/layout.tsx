import type { Metadata } from "next";

// Админка: в выдаче ей не место. Из карты сайта такие исключены 28.07.2026,
// но на страницу, куда ведёт ссылка, робот всё равно зайдёт — метатег говорит
// об этом прямо, а не оставляет выяснять.
export const metadata: Metadata = {
  title: "Pipeline · Admin — AEVION",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
