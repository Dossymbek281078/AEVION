import PlanningLanding from "@/components/PlanningLanding";

export default function QGoodLanding() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QGood",
            applicationCategory: "HealthApplication",
            operatingSystem: "Web, iOS, Android",
            description:
              "AI mental health support with clinical-grade protocols, offline mode, PHQ-9/GAD-7 integration with HealthAI, and human-specialist escalation on risk. Also: charity campaigns platform.",
            url: "https://aevion.app/qgood",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Clinical-grade conversation protocols",
              "Offline LLM mode (private)",
              "HealthAI screener integration (PHQ-9, GAD-7)",
              "Risk escalation to human specialist",
              "Charity campaigns platform",
            ],
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />
    <PlanningLanding
      id="qgood"
      code="QGOOD"
      highlightLetter="Q"
      highlightColor="emerald"
      badge="RESEARCH"
      heroTagline="Psychology · Mental Health · AI"
      heroTitle="Mind, supported."
      heroAccent="supported."
      heroSubtitle="AI-сопровождение психологического благополучия: разговорный собеседник, офлайн-режим, глубокая персонализация. Тесная связка с HealthAI screener (PHQ-9 / GAD-7) и эскалация к живому специалисту при риске."
      features={[
        { t: "🧠 Clinical-grade", d: "Сценарии под клиническим ревью. Никаких «универсальных» советов — только проверенные протоколы." },
        { t: "📵 Offline-режим", d: "Локальная LLM в приватном режиме. Ваши разговоры не покидают устройство." },
        { t: "🩺 Link с HealthAI", d: "PHQ-9 / GAD-7 скрининг встроен. Цифры — в QRight личного дашборда." },
        { t: "🚑 Escalation", d: "При обнаружении риска — мгновенный кейс на живого специалиста. Не имитация поддержки." },
      ]}
      relatedModules={[
        { id: "healthai", title: "HealthAI", summary: "PHQ-9 / GAD-7 скрининг + триаж — числовая основа для QGood-сессий." },
        { id: "psyapp-deps", title: "PsyApp", summary: "Выход из зависимостей с поведенческой аналитикой — параллельный трек к QGood." },
        { id: "qlife", title: "QLife", summary: "Personal OS, где QGood — один из 6 столпов." },
      ]}
    />
    </>
  );
}
