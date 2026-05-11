import PlanningLanding from "@/components/PlanningLanding";

export default function ShadowNetLanding() {
  return (
    <PlanningLanding
      id="shadownet"
      code="SHADOW"
      highlightLetter="S"
      highlightColor="cyan"
      badge="IDEA"
      heroTagline="Private Network · Mesh · Anonymous"
      heroTitle="Network without metadata."
      heroAccent="without metadata."
      heroSubtitle="Альтернативная приватная сеть поверх VeilNetX — анонимный форум, mesh-обмен и off-grid коммуникации. End-to-end шифрование без leak метаданных, open-source клиенты, воспроизводимые сборки."
      features={[
        { t: "🧅 Поверх VeilNetX", d: "Tor-маршрутизация — base layer. ShadowNet — поведенческий слой над ним." },
        { t: "📡 Mesh fallback", d: "Mesh-обмен при отсутствии интернета. Локальные узлы держат связь даже в blackout." },
        { t: "🔐 E2E без метаданных", d: "End-to-end шифрование + минимизация side-channel и timing-leak." },
        { t: "📂 Open + reproducible", d: "Open-source клиенты + воспроизводимые сборки. Никаких «доверьтесь нам»." },
      ]}
      relatedModules={[
        { id: "veilnetx", title: "VeilNetX", summary: "Tor-маршрутизация — базовый слой, поверх которого работает ShadowNet." },
        { id: "quantum-shield", title: "Quantum Shield", summary: "Shamir secret-sharing — для распределённого хранения ключей mesh-узлов." },
        { id: "qsign", title: "QSign", summary: "Подпись сообщений в ShadowNet без раскрытия идентичности отправителя." },
      ]}
    />
  );
}
