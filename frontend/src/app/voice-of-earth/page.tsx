import PlanningLanding from "@/components/PlanningLanding";

export default function VoiceOfEarthLanding() {
  return (
    <PlanningLanding
      id="voice-of-earth"
      code="VOE"
      highlightLetter="V"
      highlightColor="sky"
      badge="IDEA"
      heroTagline="Music · Multi-language · Authorship"
      heroTitle="Voices of Earth, one song."
      heroAccent="one song."
      heroSubtitle="Международный музыкальный проект: позитивные песни на разных языках, объединённые сквозной темой. Авторство фиксируется через QRight + QSign, роялти — публичный счётчик распределения."
      features={[
        { t: "🌍 Multi-language", d: "Каждая композиция — на отдельном языке/культуре, без принудительного English-приоритета." },
        { t: "🪪 QRight + QSign", d: "Автоматическая фиксация авторства каждой записи. Никаких споров о правах." },
        { t: "💰 Open royalties", d: "Публичный счётчик распределения роялти. Соавторы видят свою долю в реальном времени." },
        { t: "🎬 В Awards / Globus", d: "Лонг-форм видеосерия с релизами через AEVION Awards и карту Globus." },
      ]}
    />
  );
}
