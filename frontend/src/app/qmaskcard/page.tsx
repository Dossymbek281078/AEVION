import PlanningLanding from "@/components/PlanningLanding";

export default function QMaskCardLanding() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QMaskCard",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web, iOS, Android",
            description:
              "Virtual disposable cards: N virtual cards per real card with per-merchant limits, self-destruct rules, and network-level antifraud. Merchant never sees the real number.",
            url: "https://aevion.app/qmaskcard",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Multiple virtuals per real card",
              "Per-card limit + expiry",
              "Self-destruct rules (1-payment, date, sum)",
              "Network-level antifraud",
              "Subscription fraud immunity",
            ],
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />
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
      relatedModules={[
        { id: "qpaynet", title: "QPayNet", summary: "Платёжная инфраструктура AEVION — куда подключается эмиссия виртуалок." },
        { id: "bank", title: "AEVION Bank", summary: "Банковский слой — реальный счёт под QMaskCard виртуалками." },
        { id: "qcontract", title: "QContract", summary: "Smart-документ под рекуррент-подписку — лимит карты совпадает с лимитом QContract." },
      ]}
    />
    </>
  );
}
