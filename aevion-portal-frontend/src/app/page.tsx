"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const Globe3D = dynamic(() => import("../components/Globe3D"), { ssr: false });

const apps = [
  { id: "globus", label: "GLOBUS", desc: "Центральный портал экосистемы", href: "/", color: "#4f46e5", icon: "🌍", status: "active" },
  { id: "qcoreai", label: "QCoreAI", desc: "AI мультичат — код, контент, музыка, кино", href: "/qcore", color: "#8b5cf6", icon: "🧠", status: "active" },
  { id: "qright", label: "QRight", desc: "Регистрация и защита авторских прав", href: "/qright", color: "#16a34a", icon: "📜", status: "active" },
  { id: "qsign", label: "QSign", desc: "Цифровая подпись и верификация", href: "/qsign", color: "#2563eb", icon: "✍️", status: "active" },
  { id: "aipb", label: "IP Bureau", desc: "Электронное патентное бюро", href: "/aevion-ip-bureau", color: "#7c3aed", icon: "🏛️", status: "planning" },
  { id: "multichat", label: "Multichat", desc: "Мультичат с параллельными агентами", href: "/qcore", color: "#a855f7", icon: "💬", status: "planning" },
  { id: "qfusionai", label: "QFusionAI", desc: "Гибридный AI движок", href: "#", color: "#6366f1", icon: "🔮", status: "planning" },
  { id: "qtradeoffline", label: "QTradeOffline", desc: "Офлайн-платежи и переводы", href: "/qtrade", color: "#0d9488", icon: "💱", status: "planning" },
  { id: "qpaynet", label: "QPayNet", desc: "Платёжное ядро AEVION", href: "#", color: "#059669", icon: "💳", status: "planning" },
  { id: "qmaskcard", label: "QMaskCard", desc: "Защищённая банковская карта", href: "#", color: "#0891b2", icon: "🃏", status: "idea" },
  { id: "veilnetx", label: "VeilNetX", desc: "Приватная крипто-сеть", href: "#", color: "#7c3aed", icon: "🔒", status: "planning" },
  { id: "cyberchess", label: "CyberChess", desc: "Шахматная платформа", href: "/cyberchess", color: "#475569", icon: "♟️", status: "active" },
  { id: "healthai", label: "HealthAI", desc: "Персональный AI-доктор", href: "#", color: "#dc2626", icon: "🏥", status: "planning" },
  { id: "qlife", label: "QLife", desc: "Антистарение и биомаркеры", href: "#", color: "#e11d48", icon: "🧬", status: "idea" },
  { id: "qgood", label: "QGood", desc: "Психология и ментальное здоровье", href: "#", color: "#f59e0b", icon: "🧘", status: "idea" },
  { id: "psyapp", label: "PsyApp", desc: "Выход из зависимостей", href: "#", color: "#d97706", icon: "🌱", status: "idea" },
  { id: "qpersona", label: "QPersona", desc: "Цифровой аватар", href: "#", color: "#ec4899", icon: "🤖", status: "idea" },
  { id: "kids-ai", label: "Kids AI", desc: "Детский обучающий контент", href: "#", color: "#f97316", icon: "🧒", status: "planning" },
  { id: "voice-of-earth", label: "Voice of Earth", desc: "Международный музыкальный проект", href: "#", color: "#eab308", icon: "🎤", status: "idea" },
  { id: "startup-exchange", label: "StartupX", desc: "Биржа стартапов и идей", href: "#", color: "#84cc16", icon: "🚀", status: "planning" },
  { id: "deepsan", label: "DeepSan", desc: "Антихаос-приложение", href: "#", color: "#06b6d4", icon: "🎯", status: "idea" },
  { id: "mapreality", label: "MapReality", desc: "Карта реальных событий", href: "#", color: "#14b8a6", icon: "🗺️", status: "idea" },
  { id: "z-tide", label: "Z-Tide", desc: "Энергетическая валюта", href: "#", color: "#a78bfa", icon: "⚡", status: "idea" },
  { id: "qcontract", label: "QContract", desc: "Саморазрушающиеся документы", href: "#", color: "#f43f5e", icon: "📄", status: "idea" },
  { id: "shadownet", label: "ShadowNet", desc: "Приватный альтернативный интернет", href: "#", color: "#334155", icon: "🌐", status: "idea" },
  { id: "lifebox", label: "LifeBox", desc: "Цифровой сейф для будущего", href: "#", color: "#10b981", icon: "🗄️", status: "idea" },
  { id: "qchaingov", label: "QChainGov", desc: "DAO-управление", href: "#", color: "#8b5cf6", icon: "🏗️", status: "idea" },
  { id: "ai-music", label: "AI Music", desc: "Создание и защита музыки", href: "/ai-music", color: "#f97316", icon: "🎵", status: "active" },
  { id: "ai-cinema", label: "AI Cinema", desc: "Создание и защита фильмов", href: "/ai-cinema", color: "#ec4899", icon: "🎬", status: "active" },
];

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#dcfce7", text: "#16a34a", label: "Active" },
  planning: { bg: "#dbeafe", text: "#2563eb", label: "Planning" },
  idea: { bg: "#f3e8ff", text: "#7c3aed", label: "Idea" },
};

export default function HomePage() {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const selected = apps.find((a) => a.id === selectedApp);
  const filtered = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  return (
    <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #f0f4ff 0%, #e8ecf8 100%)", color: "#1e293b" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px 0" }}>
        <h1 style={{ fontSize: 42, fontWeight: 800, textAlign: "center", marginBottom: 4, background: "linear-gradient(135deg, #4f46e5, #7c3aed, #9333ea)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          AEVION GLOBUS
        </h1>
        <p style={{ color: "#64748b", fontSize: 15, textAlign: "center", maxWidth: 520, marginBottom: 4 }}>
          Планета возможностей · Астана, Казахстан
        </p>
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center" }}>{apps.length} проектов в экосистеме</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, maxWidth: 1200, margin: "20px auto 0", padding: "0 20px", minHeight: 520 }}>
        <div style={{ height: 520, position: "relative", background: "radial-gradient(circle at 50% 50%, #c7d2fe22 0%, transparent 70%)", borderRadius: 20 }}>
          <Globe3D onSelectApp={(app) => setSelectedApp(app.id)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 40px" }}>
          {selected ? (
            <div style={{ animation: "fadeIn 0.3s" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{selected.icon}</div>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: selected.color, marginBottom: 4 }}>{selected.label}</h2>
              <span style={{ ...statusColors[selected.status], padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, display: "inline-block", marginBottom: 12, background: statusColors[selected.status].bg, color: statusColors[selected.status].text }}>{statusColors[selected.status].label}</span>
              <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>{selected.desc}</p>
              {selected.href !== "#" && (
                <Link href={selected.href} style={{ display: "inline-block", padding: "12px 28px", borderRadius: 10, background: selected.color, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
                  Открыть {selected.label}
                </Link>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌍</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#4f46e5", marginBottom: 8 }}>Выберите проект</h2>
              <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>Все 29 проектов базируются в Астане, Казахстан. Кликните на точку или выберите из списка.</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "32px auto", padding: "0 20px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#475569" }}>Все проекты ({filtered.length})</h3>
          <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: 10, padding: 3, border: "1px solid #e2e8f0" }}>
            {[{ key: "all", label: "Все" }, { key: "active", label: "Active" }, { key: "planning", label: "Planning" }, { key: "idea", label: "Idea" }].map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: filter === f.key ? "#4f46e5" : "transparent", color: filter === f.key ? "#fff" : "#64748b" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {filtered.map((app) => (
            <Link key={app.id} href={app.href} style={{ textDecoration: "none" }} onMouseEnter={() => setSelectedApp(app.id)} onMouseLeave={() => setSelectedApp(null)}>
              <div style={{ padding: "14px", borderRadius: 12, background: selectedApp === app.id ? "#fff" : "#f8fafc", border: `1px solid ${selectedApp === app.id ? app.color + "44" : "#e2e8f0"}`, boxShadow: selectedApp === app.id ? `0 4px 16px ${app.color}12` : "none", transition: "all 0.2s", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{app.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: app.color }}>{app.label}</span>
                  </div>
                  <span style={{ padding: "2px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: statusColors[app.status].bg, color: statusColors[app.status].text }}>{statusColors[app.status].label}</span>
                </div>
                <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, margin: 0 }}>{app.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "20px 0 30px", color: "#94a3b8", fontSize: 12 }}>AEVION Platform · Астана, Казахстан · {apps.length} проектов</div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}