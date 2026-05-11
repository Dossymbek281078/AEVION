import PlanningLanding from "@/components/PlanningLanding";

export default function DeepSanLanding() {
  return (
    <PlanningLanding
      id="deepsan"
      code="DEEPSAN"
      highlightLetter="D"
      highlightColor="rose"
      badge="RESEARCH"
      heroTagline="Productivity · Focus · Anti-chaos"
      heroTitle="Order from the inbox storm."
      heroAccent="from the inbox storm."
      heroSubtitle="Антихаос-приложение: планирование, структурирование задач, поддержка фокуса и измеримое снижение когнитивной нагрузки. Bridge к QCoreAI агентам — задачи становятся состояниями, не списками."
      features={[
        { t: "🔁 Tasks as states", d: "Не tasks-as-strings. Каждая задача — состояние: intent → action → close. AI вытягивает next-action." },
        { t: "🧹 Inbox-парсер", d: "1 клик — структура из хаоса email/messengers/notes. AI извлекает action items автоматически." },
        { t: "🎯 Focus-сессии", d: "Принудительные фокус-блоки. Анти-task-switch logic блокирует прерывания контролируемо." },
        { t: "🤖 Bridge к QCoreAI", d: "Задачи могут запускать агентов через QCoreAI. Не «список» — а исполняемые сценарии." },
      ]}
      relatedModules={[
        { id: "qcoreai", title: "QCoreAI", summary: "Agent engine — куда DeepSan делегирует исполнение задач-состояний." },
        { id: "multichat-engine", title: "Multichat Engine", summary: "Inbox-источник: DeepSan вытягивает action items прямо из переписок." },
        { id: "qpersona", title: "QPersona", summary: "AI-двойник для исполнения рутинных задач вашим стилем." },
      ]}
    />
  );
}
