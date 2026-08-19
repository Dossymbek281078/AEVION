import type { Metadata } from "next";

/**
 * Метаданные страницы живут здесь, а не в page.tsx: сама страница помечена
 * "use client", а клиентский компонент не может экспортировать metadata —
 * директива обязана быть первой строкой файла.
 *
 * Каталог — самая естественная точка входа для того, кто ищет конкретный
 * инструмент, и до 19.08.2026 он наследовал общий заголовок сайта.
 *
 * ⚠️ Проверено 19.08.2026: `tsc` на нарушении этого правила ЗЕЛЁНЫЙ. Это правило
 * сборки Next.js, а не системы типов, и ловится только настоящим next build.
 */
export const metadata: Metadata = {
  title: "Каталог продуктов AEVION: 11 инструментов",
  description:
    "Что уже работает: публикатор TikTok, движок ИИ, бюро авторства, платежи, шахматы, сметный тренажёр. Цены и бесплатные тарифы у каждого.",
  alternates: { canonical: "https://aevion.app/apps" },
  openGraph: {
    title: "Каталог продуктов AEVION",
    description: "Одиннадцать работающих инструментов: от бюро авторства до публикатора TikTok.",
    url: "https://aevion.app/apps",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
