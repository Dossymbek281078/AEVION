import PlanningLanding from "@/components/PlanningLanding";

export default function KidsAILanding() {
  return (
    <PlanningLanding
      id="kids-ai-content"
      code="KIDS-AI"
      highlightLetter="K"
      highlightColor="amber"
      badge="PLANNING"
      heroTagline="Education · Kids · Multi-language"
      heroTitle="Curious kids, safe AI."
      heroAccent="safe AI."
      heroSubtitle="Безопасный многоязычный AI-контент для детей: мультформаты, логопедический эффект, родительский dashboard и измеримая образовательная польза."
      features={[
        { t: "🛡 Safe by default", d: "Жёсткие фильтры контента + родительский dashboard с полным аудитом сессий." },
        { t: "🌐 Multi-language", d: "С первого дня — 3+ языка, без английского как «default»." },
        { t: "🗣 Логопедия", d: "Модуль произношения отслеживает прогресс. Голосовая ОС не имитация — реальная польза." },
        { t: "🎯 По возрасту", d: "Образовательный план привязан к возрастной шкале. Никакого «one-size-fits-all»." },
      ]}
    />
  );
}
