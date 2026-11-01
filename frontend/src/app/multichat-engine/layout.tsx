import type { Metadata } from "next";

// 31.10.2026, решение Оркестратора «обещать только то, что есть»: здесь стояло «6 агентов, Claude / GPT / Gemini /
// DeepSeek / Grok, @упоминания», а консоль страницы — совет из ТРЁХ агентов (CouncilConsole.tsx, PANEL): Аналитик,
// Скептик, Практик; основные поставщики Claude (Anthropic), Gemini (Google), открытая модель через OpenRouter, при сбое —
// запасной. GPT в совете нет. Чек подписан Ed25519 (замер прода 31.10). Без входа — 2 вопроса в день (замер 30–31.10).
export const metadata: Metadata = {
  title: "Multichat — a council of three AI agents · совет трёх ИИ-агентов",
  description:
    "Ask one question — three AI agents (Analyst, Skeptic, Practitioner) answer independently via Claude, Gemini and open models, and you see where they disagree. Signed receipt, 2 free questions a day. Один вопрос — три независимых ответа ИИ-агентов и карта разногласий.",
  keywords: [
    "AI council",
    "compare AI answers",
    "multi-agent",
    "Claude",
    "Gemini",
    "OpenRouter",
    "AEVION",
    "Мультичат",
  ],
  openGraph: {
    title: "AEVION Мультичат — совет трёх ИИ-агентов",
    description:
      "Один вопрос — три агента с разными ролями отвечают независимо (Claude, Gemini, открытая модель), и сразу видно, где ответы расходятся. Подписанный чек, 2 вопроса в день бесплатно.",
    type: "website",
    siteName: "AEVION",
    url: "/multichat-engine",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION Мультичат — совет трёх ИИ-агентов",
    description: "Три независимых ответа на один вопрос и карта разногласий. 2 вопроса в день бесплатно.",
  },
  alternates: { canonical: "/multichat-engine" },
};

export default function MultichatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
