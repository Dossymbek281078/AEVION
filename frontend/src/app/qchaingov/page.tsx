import PlanningLanding from "@/components/PlanningLanding";

export default function QChainGovLanding() {
  return (
    <PlanningLanding
      id="qchaingov"
      code="QCHAINGOV"
      highlightLetter="Q"
      highlightColor="sky"
      badge="IDEA"
      heroTagline="DAO Governance · Quadratic voting · Audit"
      heroTitle="Governance that survives a vote."
      heroAccent="survives a vote."
      heroSubtitle="DAO-платформа народного управления: голосования, инициативы, прозрачные процессы. Поверх AEVION Auth + QSign — без обхода идентификации через одноразовые кошельки."
      features={[
        { t: "🪪 Identity-bound", d: "Голоса привязаны к AEVION Auth identity. Без анонимных botnet-роёв." },
        { t: "📜 Открытые инициативы", d: "Любой создаёт предложение. Threshold-фильтр от спама без gatekeeper-цензуры." },
        { t: "✍️ QSign-цепочка", d: "Под каждым голосом — QSign-подпись. Откатить решение задним числом нельзя." },
        { t: "🎯 Quadratic + delegate", d: "Quadratic voting + delegate-trees: концентрация капитала ≠ концентрация решений." },
      ]}
    />
  );
}
