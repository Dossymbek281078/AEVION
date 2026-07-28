import type { Metadata } from "next";

// До 28.07.2026 все страницы раздела отдавали Google один и тот же <title>
// из общего layout, и поисковик читал их как копии одной страницы
// (Search Console: 662 не в индексе против 428). Заголовок здесь — тот же
// текст, который страница показывает в своём <h1>.
export const metadata: Metadata = {
  title: "Analytics — QCoreAI · AEVION",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
