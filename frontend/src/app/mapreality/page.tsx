import PlanningLanding from "@/components/PlanningLanding";

export default function MapRealityLanding() {
  return (
    <PlanningLanding
      id="mapreality"
      code="MAPREALITY"
      highlightLetter="M"
      highlightColor="cyan"
      badge="IDEA"
      heroTagline="Real Needs · Geo-signals · No editorial spin"
      heroTitle="The map editors don't show you."
      heroAccent="don't show you."
      heroSubtitle="Карта реальных событий и потребностей: агрегирование сигналов общества — где нужны волонтёры, врачи, инструменты, информация. Без новостной искажающей подачи и без редакторского контроля."
      features={[
        { t: "📡 Citizen signals", d: "Сигналы от граждан, не от редакторов. Без «топ-новости» и без рекламы." },
        { t: "🗺 Raw geo-data", d: "Сырые данные с гео-привязкой, без интерпретации. Карта — данные, не нарратив." },
        { t: "🪪 QSign audit", d: "Каждый источник сигнала аудируем через QSign. Анти-fake-signal layer." },
        { t: "🔓 Open API", d: "Любой может строить свою визуализацию. Open API без vendor-lock." },
      ]}
    />
  );
}
