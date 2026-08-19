import type { Metadata } from "next";

/**
 * Метаданные страницы живут здесь, а не в page.tsx: сама страница помечена
 * "use client", а клиентский компонент не может экспортировать metadata —
 * директива обязана быть первой строкой файла.
 *
 * Описание намеренно скупое: пишу только то, что страница делает.
 *
 * ⚠️ Проверено 19.08.2026: `tsc` на нарушении этого правила ЗЕЛЁНЫЙ. Это правило
 * сборки Next.js, а не системы типов, и ловится только настоящим next build.
 */
export const metadata: Metadata = {
  title: "AEVION Studio — сборка роликов и материалов",
  description:
    "Инструмент студии AEVION: подготовка визуальных материалов и роликов из готовых блоков.",
  alternates: { canonical: "https://aevion.app/studio" },
  openGraph: {
    title: "AEVION Studio",
    description: "Сборка роликов и визуальных материалов из готовых блоков.",
    url: "https://aevion.app/studio",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
