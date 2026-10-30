import type { Metadata, Viewport } from "next";
import { serverLang } from "@/lib/serverLang";
import { ServerLangProvider } from "@/lib/serverLangContext";

// Язык первого кадра платной стены (PaywallScreen) выбирает сервер: кука →
// Accept-Language → ru. Без этого SSR-кадр стены для русского гостя английский
// и перерисовывается после гидрации (lib/serverLangContext.tsx, 30.10.2026).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Хвост "· AEVION" не пишем: корневой layout добавляет его шаблоном
  // "%s · AEVION". В openGraph ниже он остаётся — там шаблона нет.
  title: "HealthAI — Personal AI Doctor",
  description:
    "Personal AI Doctor: rule-based symptom triage, daily wellness log, BMI, trends, risk indicators, PHQ-9 & GAD-7 screeners, weekly plan, cycle tracker, family profiles. RU/EN.",
  keywords: ["HealthAI", "AEVION", "AI doctor", "symptom checker", "wellness", "PHQ-9", "personal health"],
  openGraph: {
    title: "HealthAI — Personal AI Doctor · AEVION",
    description:
      "Personal AI Doctor: symptom triage, wellness log, BMI, PHQ-9/GAD-7 screeners, weekly plan, cycle tracker, family profiles. RU/EN.",
    type: "website",
    siteName: "AEVION HealthAI",
    url: "/healthai",
  },
  twitter: {
    card: "summary_large_image",
    title: "HealthAI — AI Doctor · AEVION",
    description: "Symptom triage, wellness log, PHQ-9/GAD-7, weekly plan. Free, private, no diagnosis.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#070b14",
  colorScheme: "dark",
};

export default async function HealthAILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await serverLang("ru");
  return <ServerLangProvider lang={lang}>{children}</ServerLangProvider>;
}
