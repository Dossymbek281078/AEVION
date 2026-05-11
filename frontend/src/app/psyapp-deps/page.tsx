import PlanningLanding from "@/components/PlanningLanding";

export default function PsyAppLanding() {
  return (
    <PlanningLanding
      id="psyapp-deps"
      code="PSYAPP"
      highlightLetter="P"
      highlightColor="rose"
      badge="RESEARCH"
      heroTagline="Addiction Recovery · Behavioral Analytics"
      heroTitle="Out of the loop, on purpose."
      heroAccent="on purpose."
      heroSubtitle="Платформа выхода из зависимостей (алкоголь / курение / ставки): триггер-детекция, групповая поддержка, профилактика срывов на основе поведенческой аналитики. Эскалация к специалисту QGood при риске."
      features={[
        { t: "🎯 Trigger-детектор", d: "ML на time-series поведения. Системный signal за 12–48ч до риска срыва." },
        { t: "👥 Anonymous-by-default", d: "Групповая поддержка с reset identity. Без давления раскрытия и judgement." },
        { t: "🚨 Early-warning", d: "Профилактика срывов: бот, наставник, специалист — по нарастающей." },
        { t: "🩺 Bridge → QGood", d: "Когда поведенческий риск переходит в клинический — мгновенный escalation." },
      ]}
    />
  );
}
