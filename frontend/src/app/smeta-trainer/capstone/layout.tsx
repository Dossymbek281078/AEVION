import type { Metadata } from "next";

// До 28.07.2026 весь раздел отдавал Google один <title> из общего layout,
// и поисковик читал 32 страницы как копии одной (Search Console: 662 не в
// индексе против 428). Заголовок здесь — тот же текст, что в <h1> страницы.
export const metadata: Metadata = {
  title: "Сводный тест по полному циклу сметы — сметный тренажёр AEVION",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
