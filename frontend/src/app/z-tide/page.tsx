import PlanningLanding from "@/components/PlanningLanding";

export default function ZTideLanding() {
  return (
    <PlanningLanding
      id="z-tide"
      code="Z-TIDE"
      highlightLetter="Z"
      highlightColor="violet"
      badge="IDEA"
      heroTagline="Research · Energy currency · Concept"
      heroTitle="Currency, but energy-anchored."
      heroAccent="energy-anchored."
      heroSubtitle="Концептуальная валюта, связанная с энергией / эмоциями / социальным вкладом. Research-проект: можно ли строить экономику, где «единица» — не trust количества, а энергозатраты + социальная польза."
      features={[
        { t: "🔬 Чисто research", d: "Не product roadmap, а исследование границ концепции. Открытый whitepaper." },
        { t: "⚡ Energy-anchored", d: "Привязка к измеримым актам (объём работы / влияние), не к спекулятивному курсу." },
        { t: "🪪 Не анонимна", d: "Каждая единица аудируема через QSign. Опровергает гипотезу, что privacy = anonymity." },
        { t: "🪐 Параллельный слой", d: "Не replace AEV. Экспериментальный layer параллельно основному монетарному контуру." },
      ]}
    />
  );
}
