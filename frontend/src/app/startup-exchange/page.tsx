import PlanningLanding from "@/components/PlanningLanding";

export default function StartupExchangeLanding() {
  return (
    <PlanningLanding
      id="startup-exchange"
      code="STARTUPX"
      highlightLetter="S"
      highlightColor="violet"
      badge="PLANNING"
      heroTagline="Marketplace · Startups · IP-protected"
      heroTitle="Pitch first. Protect first."
      heroAccent="Protect first."
      heroSubtitle="Биржа стартапов и идей с встроенной защитой авторства через QRight + QSign и безопасной коммуникацией основателей с инвесторами. Smart-NDA через QContract до раскрытия деталей."
      features={[
        { t: "🪪 QRight pitch", d: "Каждый pitch автоматически фиксируется в QRight — авторство ничем не оспорить." },
        { t: "🤝 Smart-NDA", d: "QContract self-destruct до раскрытия. Инвестор не пройдёт дальше без подписи." },
        { t: "💸 QPayNet escrow", d: "Эскроу-платежи и роялти поверх QPayNet. Без посредников и просрочек." },
        { t: "👀 Public reputation", d: "Никаких анонимных инвесторов. История раундов и поведения — публична." },
      ]}
      relatedModules={[
        { id: "qright", title: "QRight", summary: "Авто-фиксация авторства pitch'а — фундамент Startup Exchange." },
        { id: "qcontract", title: "QContract", summary: "Smart-NDA с self-destruct — гейт на раскрытие деталей инвесторам." },
        { id: "qpaynet", title: "QPayNet", summary: "Эскроу-платежи и роялти — финансовая прослойка Exchange." },
      ]}
    />
  );
}
