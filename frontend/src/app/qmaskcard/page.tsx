import PlanningLanding from "@/components/PlanningLanding";

export default function QMaskCardLanding() {
  return (
    <PlanningLanding
      id="qmaskcard"
      code="QMASKCARD"
      highlightLetter="Q"
      highlightColor="amber"
      badge="PLANNING"
      heroTagline="Disposable cards · Privacy · Antifraud"
      heroTitle="Real card never leaves your wallet."
      heroAccent="never leaves your wallet."
      heroSubtitle="Защищённая банковская карта: одноразовые виртуальные копии для каждой покупки, антифрод-механика, лимиты per-merchant и self-destruct по сценариям."
      features={[
        { t: "🪪 N виртуальных на 1 реальную", d: "Под каждый магазин/подписку — собственная виртуалка. Реальный номер не покидает кошелёк." },
        { t: "🎯 Лимит per-card", d: "Каждая виртуалка с собственным лимитом и сроком. Утечка одной не открывает остальные." },
        { t: "💣 Self-destruct", d: "По сценарию: после 1 платежа / даты / суммы — карта сгорает. Подписочный фрод невозможен." },
        { t: "🛡 Антифрод на network", d: "Merchant не видит реальный номер. Сам banking-уровень считает виртуалку первичным entity." },
      ]}
    />
  );
}
