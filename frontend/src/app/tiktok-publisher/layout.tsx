import type { Metadata } from "next";

/**
 * Метаданные страницы живут здесь, а не в page.tsx: сама страница помечена
 * "use client", а клиентский компонент не может экспортировать metadata —
 * директива обязана быть первой строкой файла.
 *
 * 🔴 ЭТОТ адрес указан в заявке на Content Posting API. Ревьюер, открыв его,
 * видел заголовок «AEVION — Trust infrastructure for digital assets & IP» — то
 * есть страница, которая должна быть инструментом для авторов, представлялась
 * инфраструктурой для интеллектуальной собственности. Ровно то несоответствие,
 * из-за которого заявку и отклоняли как «internal use».
 *
 * ⚠️ Проверено 19.08.2026: `tsc` на нарушении этого правила ЗЕЛЁНЫЙ. Это правило
 * сборки Next.js, а не системы типов, и ловится только настоящим next build.
 */
export const metadata: Metadata = {
  title: "TikTok Publisher — публикация роликов в свой аккаунт",
  description:
    "Подключите свой аккаунт TikTok и отправьте готовый ролик в черновики или сразу в ленту: подпись, уровень приватности, раскрытие коммерческого контента и метка ИИ.",
  alternates: { canonical: "https://aevion.app/tiktok-publisher" },
  openGraph: {
    title: "TikTok Publisher — публикация в свой аккаунт TikTok",
    description: "Подключение через OAuth, черновики или прямая публикация, раскрытие коммерческого контента.",
    url: "https://aevion.app/tiktok-publisher",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
