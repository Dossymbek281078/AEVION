import PlanningLanding from "@/components/PlanningLanding";

export default function LifeBoxLanding() {
  return (
    <PlanningLanding
      id="lifebox"
      code="LIFEBOX"
      highlightLetter="L"
      highlightColor="amber"
      badge="PLANNING"
      heroTagline="Digital Safe · 100-year storage · Inheritance"
      heroTitle="Letter to your future self, sealed."
      heroAccent="sealed."
      heroSubtitle="Цифровой сейф для будущего «я»: документы, знания, инструкции, ценности. Долгоживущее хранилище с протоколом доступа после смерти и наследованием через QShield (Shamir-разбиение)."
      features={[
        { t: "⏳ 100-летнее", d: "Forward-compatible форматы. Не падает при смене вендора через 20 лет." },
        { t: "🪪 Shamir inheritance", d: "Наследование через QShield Shamir-shares: 3 из 5 наследников + опекуны = доступ." },
        { t: "🔍 QSign audit", d: "Каждый доступ — подпись + аудит. Никаких незамеченных открытий." },
        { t: "🎚 Triggers", d: "Смерть / недееспособность / явное открытие — три независимых сценария разблокировки." },
      ]}
    />
  );
}
