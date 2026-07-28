import type { Metadata } from "next";

// До 28.07.2026 страница делила один <title> с 69 другими в разделе,
// и поисковик читал их как копии одной (Search Console: 662 не в индексе).
// Заголовок — тот же текст, что страница показывает в своём <h1>.
export const metadata: Metadata = {
  title: "Changelog — AEVION QBuild",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
