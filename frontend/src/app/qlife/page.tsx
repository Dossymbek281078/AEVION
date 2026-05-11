import PlanningLanding from "@/components/PlanningLanding";

export default function QLifeLanding() {
  return (
    <PlanningLanding
      id="qlife"
      code="QLIFE"
      highlightLetter="Q"
      highlightColor="emerald"
      badge="IDEA"
      heroTagline="Personal Operating System"
      heroTitle="Your entire life in one OS."
      heroAccent="entire life in one OS."
      heroSubtitle="Personal OS — сборка-композит 6 столпов AEVION (HealthAI / QRight / Multichat / QGood / QTradeOffline / QSign) в единый «жизненный» интерфейс. Cross-module insights, polyglot UI с первого дня."
      features={[
        { t: "🪟 Shell над модулями", d: "Не отдельный продукт. Интегрированный shell над уже работающими AEVION-модулями." },
        { t: "🧠 Cross-module insights", d: "AI видит данные через границы модулей: «вы реже звоните, когда HRV падает»." },
        { t: "🩺 Healthy by default", d: "HealthAI триаж + QGood mental-health встроены, без переключения контекста." },
        { t: "🌐 Polyglot UI", d: "3+ языка с первого дня. Не «English first», а equal-tier." },
      ]}
      relatedModules={[
        { id: "healthai", title: "HealthAI", summary: "Здоровье-столп — триаж, screener, план. Уже работает." },
        { id: "qgood", title: "QGood", summary: "Mental-health столп — AI-собеседник + clinical-grade сценарии." },
        { id: "multichat-engine", title: "Multichat", summary: "Коммуникации-столп — диалоги через несколько LLM в одном чате." },
      ]}
    />
  );
}
