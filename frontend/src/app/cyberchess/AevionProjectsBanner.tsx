"use client";
// AevionProjectsBanner — правая рекламная колонка на /cyberchess.
// Сейчас показывает проекты AEVION в виде карусели с авто-прокруткой.
// В будущем: заменяется рекламными баннерами (IAB 300x600 / 300x250).
// Структура зарезервирована под рекламу — slot-контейнеры уже обозначены.

import React, { useEffect, useRef, useState } from "react";

interface Project {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  desc: string;
  color: string;
  href: string;
  tag: string;
}

const PROJECTS: Project[] = [
  { id: "bureau",   name: "Патентное бюро", shortName: "Бюро",     emoji: "🏛",  desc: "Цифровой реестр патентов и сертификатов IP. Первичная регистрация прав.", color: "#7c3aed", href: "/bureau",          tag: "IP · Право" },
  { id: "qright",   name: "QRight",         shortName: "QRight",   emoji: "©",   desc: "Blockchain-подтверждение авторских прав. SHA-256 + HMAC.", color: "#0891b2", href: "/qright",          tag: "IP · Юрист" },
  { id: "qsign",    name: "QSign",          shortName: "QSign",    emoji: "✍",   desc: "Постквантовые цифровые подписи. PQ-криптография, RFC 8785.", color: "#059669", href: "/qsign",           tag: "Подпись" },
  { id: "build",    name: "QBuild",         shortName: "QBuild",   emoji: "💼",  desc: "HR-платформа: вакансии, проекты, подбор AI-команд.", color: "#d97706", href: "/build",           tag: "HR · Работа" },
  { id: "qcoreai",  name: "QCoreAI",        shortName: "QCoreAI",  emoji: "🧠",  desc: "AI-движок: 5 LLM-провайдеров, мультиагент, rate-limit.", color: "#6366f1", href: "/qcoreai",         tag: "AI · Агент" },
  { id: "qpaynet",  name: "QPayNet",        shortName: "QPayNet",  emoji: "💸",  desc: "P2P-платежи и встроенный эквайринг. AEV-нативная валюта.", color: "#10b981", href: "/qpaynet",         tag: "Финансы" },
  { id: "shield",   name: "QShield",        shortName: "QShield",  emoji: "🛡",  desc: "Shamir Secret Sharing + Ed25519. Пороговые секреты.", color: "#dc2626", href: "/quantum-shield",  tag: "Безопасность" },
  { id: "healthai", name: "HealthAI",       shortName: "Health",   emoji: "🩺",  desc: "AI-ассистент здоровья: анализы, цикл, превентивный план.", color: "#0ea5e9", href: "/healthai",        tag: "Здоровье" },
  { id: "planet",   name: "Planet",         shortName: "Planet",   emoji: "🌍",  desc: "Экосистемный compliance: сертификаты, голосования, снапшоты.", color: "#8b5cf6", href: "/planet",          tag: "ESG · Право" },
  { id: "awards",   name: "Премии",         shortName: "Awards",   emoji: "🏆",  desc: "Музыкальные и кинопремии AEVION. Цифровые медали.", color: "#f59e0b", href: "/awards",          tag: "Медиа" },
  { id: "qtrade",   name: "QTrade",         shortName: "QTrade",   emoji: "📈",  desc: "Биржа AEV: лимитные ордера, стакан, история сделок.", color: "#0f766e", href: "/qtrade",          tag: "Биржа" },
  { id: "devhub",   name: "DevHub",         shortName: "DevHub",   emoji: "⚡",  desc: "AI developer platform. SDK, webhooks, playground.", color: "#7c3aed", href: "/devhub",          tag: "Разработка" },
];

interface Props {
  onHide: () => void;
}

export default function AevionProjectsBanner({ onHide }: Props) {
  const [idx, setIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Авто-прокрутка: каждые 4 сек если не hover
  useEffect(() => {
    if (hovered) return;
    timerRef.current = setTimeout(() => {
      setIdx(i => (i + 1) % PROJECTS.length);
    }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [idx, hovered]);

  const proj = PROJECTS[idx];
  const prev = () => setIdx(i => (i - 1 + PROJECTS.length) % PROJECTS.length);
  const next = () => setIdx(i => (i + 1) % PROJECTS.length);

  return (
    <div
      style={{
        flex: "0 0 240px",
        minWidth: 200,
        maxWidth: 260,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 12,
        userSelect: "none",
      }}
    >
      {/* Заголовок с кнопкой скрыть */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 6px",
        background: "linear-gradient(90deg,rgba(124,58,237,0.08),transparent)",
        borderRadius: 6,
        borderLeft: "2px solid #7c3aed",
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: "#6d28d9", letterSpacing: 0.8, textTransform: "uppercase" }}>
          Проекты АЕВИОН
        </span>
        <button
          onClick={onHide}
          title="Скрыть панель"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
        >
          ×
        </button>
      </div>

      {/* Рекламный слот (top) — 300x100 IAB.
          Сейчас: главная карточка проекта. Потом: внешний рекламный баннер. */}
      <div
        className="aevion-ad-slot-top"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: `linear-gradient(145deg,${proj.color}22,${proj.color}11)`,
          border: `1px solid ${proj.color}44`,
          borderRadius: 12,
          padding: "14px 12px 12px",
          position: "relative",
          overflow: "hidden",
          cursor: "default",
          minHeight: 140,
        }}
      >
        {/* Декор */}
        <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.07, lineHeight: 1 }}>{proj.emoji}</div>

        <div style={{ fontSize: 28, marginBottom: 6 }}>{proj.emoji}</div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 3 }}>{proj.name}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: proj.color, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{proj.tag}</div>
        <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.45, margin: 0, marginBottom: 10 }}>{proj.desc}</p>

        <a
          href={proj.href}
          style={{
            display: "inline-block",
            padding: "5px 12px",
            borderRadius: 999,
            background: proj.color,
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            textDecoration: "none",
            letterSpacing: 0.3,
          }}
        >
          Открыть →
        </a>

        {/* Навигация */}
        <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={prev} style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>{idx + 1}/{PROJECTS.length}</span>
          <button onClick={next} style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
        </div>
      </div>

      {/* Dots индикатор */}
      <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
        {PROJECTS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setIdx(i)}
            title={p.shortName}
            style={{
              width: i === idx ? 18 : 6,
              height: 6,
              borderRadius: 3,
              border: "none",
              background: i === idx ? proj.color : "#cbd5e1",
              cursor: "pointer",
              padding: 0,
              transition: "all 200ms",
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Рекламный слот (mini list) — 4 быстрые ссылки */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 10px 6px" }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
          Популярное
        </div>
        {PROJECTS.filter(p => ["bureau", "qright", "build", "qcoreai"].includes(p.id)).map(p => (
          <a
            key={p.id}
            href={p.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 0",
              borderBottom: "1px solid #f1f5f9",
              textDecoration: "none",
              color: "#334155",
            }}
          >
            <span style={{ fontSize: 14 }}>{p.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>{p.tag}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Слот под рекламу (300x250 / ad-native) — placeholder */}
      <div
        className="aevion-ad-slot-native"
        style={{
          border: "1px dashed #e2e8f0",
          borderRadius: 8,
          padding: "10px 8px",
          background: "#f8fafc",
          textAlign: "center",
          color: "#94a3b8",
          fontSize: 10,
          minHeight: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 16 }}>📢</span>
        <span>Рекламный блок</span>
        <span style={{ fontSize: 9, color: "#cbd5e1" }}>300×250 · скоро</span>
      </div>
    </div>
  );
}
