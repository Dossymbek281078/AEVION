import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Multichat Engine — parallel AI agents · совет ИИ-агентов в одном окне",
  description:
    "Run 6 specialised AI agents in parallel — General, Code, Finance, IP/Legal, Compliance, Translator — across Claude / GPT / Gemini / DeepSeek / Grok. Cross-agent @mention handoff, broadcast, custom prompts, MD/JSON export. Шесть ИИ-агентов параллельно в одном окне: совет моделей, передача вопроса между агентами, экспорт. Live.",
  keywords: [
    "AI agents",
    "parallel chat",
    "multi-agent",
    "Claude",
    "GPT",
    "Gemini",
    "DeepSeek",
    "Grok",
    "AEVION",
    "QCoreAI",
    "AI orchestration",
  ],
  openGraph: {
    // 13.09.2026: перевод англоязычного превью (см. qright/layout.tsx).
    // Число ролей проверено по коду 09.09: их шесть и они названы поимённо;
    // «три агента» на странице — это пресет, а не предел. locale был "en"
    // при русском подписчике — тоже поправлен.
    title: "AEVION Мультичат — параллельные ИИ-агенты в одном окне",
    description:
      "Шесть ИИ-агентов с разными ролями в одном окне: общий, код, финансы, право, комплаенс, перевод. Пять поставщиков моделей, передача задачи через @упоминание.",
    type: "website",
    siteName: "AEVION",
    url: "/multichat-engine",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Мультичат — параллельные ИИ-агенты",
    description: "Шесть агентов в одном окне. Передача через @упоминание. Работает.",
  },
  alternates: { canonical: "/multichat-engine" },
};

export default function MultichatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
