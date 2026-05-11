import PlanningLanding from "@/components/PlanningLanding";

export default function QGoodLanding() {
  return (
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
    />
  );
}
