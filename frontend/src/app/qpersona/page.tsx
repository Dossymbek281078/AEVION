import PlanningLanding from "@/components/PlanningLanding";

export default function QPersonaLanding() {
  return (
    <PlanningLanding
      id="qpersona"
      code="QPERSONA"
      highlightLetter="Q"
      highlightColor="rose"
      badge="RESEARCH"
      heroTagline="AI Personality Twin · Voice · Decisions"
      heroTitle="Your AI doppelganger."
      heroAccent="doppelganger."
      heroSubtitle="Цифровой аватар-заместитель: AI-двойник по вашим текстам, голосу и истории решений. Делегирует рутинные коммуникации, сохраняя ваш стиль. Эскалирует спорные кейсы к вам."
      features={[
        { t: "📝 Текст", d: "1000+ ваших сообщений — модель копирует стиль, лексику, эмодзи. Без «промпт-инжиниринга»." },
        { t: "🎙 Голос", d: "5 минут речи — генерируем войс-клон для голосовых ответов в мессенджерах." },
        { t: "🧠 Решения", d: "100+ прошлых решений (купить/отказать/перенести) — учим when-to-escalate." },
        { t: "🪪 QSign-аудит", d: "Каждый ответ аватара подписан и аудируем. Никаких незаметных подмен." },
      ]}
      relatedModules={[
        { id: "qcoreai", title: "QCoreAI", summary: "AI engine + история диалогов — топливо для клонирования стиля QPersona." },
        { id: "deepsan", title: "DeepSan", summary: "Задачи-состояния → исполняет QPersona вашим стилем." },
        { id: "qsign", title: "QSign", summary: "Подпись каждого ответа аватара — аудит и анти-deepfake защита." },
      ]}
    />
  );
}
