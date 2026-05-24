"use client";

import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

type Pilot = {
  id: string;
  badge: string;
  title: string;
  price: string;
  duration: string;
  modules: string[];
  included: string[];
  successCriteria: string[];
  accent: string;
  bg: string;
};

const PILOTS: Pilot[] = [
  {
    id: "trust",
    badge: "Trust pilot",
    title: "Подпись · секреты · IP-аттестация",
    price: "$50 000",
    duration: "90 дней",
    modules: ["QSign v2 (ML-DSA-65 FIPS 204)", "QShield (threshold)", "QRight (IP registry)"],
    included: [
      "Onboarding-call с founder + technical lead",
      "5 SDK seats (TS + Python) с приоритетным каналом в Slack",
      "10K подписей / месяц + неограниченные attestation requests",
      "Branded landing-страница `pilot.<your-company>.aevion.app` для команды",
      "Еженедельный success-review",
    ],
    successCriteria: [
      "Подпишите 1+ production document через QSign v2 за 30 дней",
      "Зарегистрируйте 1+ IP-объект в QRight за 60 дней",
      "Custom integration на вашей стороне с готовой документацией к 90 дням",
    ],
    accent: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
  },
  {
    id: "dev",
    badge: "Dev pilot",
    title: "DevHub · QCoreAI · agent-layer",
    price: "$75 000",
    duration: "90 дней",
    modules: ["DevHub (9 integrations)", "QCoreAI (5+ AI providers)", "QBuild (опционально)"],
    included: [
      "5 developer seats в DevHub под единым AEV-биллингом",
      "$10K AI-credits в QCoreAI (per-token across all providers)",
      "Подключение к вашим existing GitHub / Vercel / Cloudflare / Brevo через AEVION proxy",
      "Custom routing rules между AI-провайдерами под ваши latency/cost SLAs",
      "Migration assistance — портирование одного существующего workflow в DevHub",
    ],
    successCriteria: [
      "Минимум 3 интеграции активны (GitHub + Vercel + 1 на выбор) к концу недели 2",
      "100+ API-вызовов через QCoreAI на каждом из 3 провайдеров за 60 дней",
      "Один production-сервис вашей команды деплоится через DevHub к 90 дням",
    ],
    accent: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
  },
  {
    id: "financial",
    badge: "Financial pilot",
    title: "QPayNet · AEV · Bank · Payments Rail",
    price: "$100 000",
    duration: "90 дней",
    modules: ["QPayNet", "AEVION Bank (white-label)", "Payments Rail v1.1", "AEV ledger access"],
    included: [
      "White-label setup: ваш домен поверх AEVION Bank UI",
      "KYC pipeline через Stripe-rails с прохождением AML",
      "Sandbox AEV wallet + 100K test-AEV для интеграционного тестирования",
      "Webhook delivery с retry + HMAC signing к вашему backend",
      "Юридическое сопровождение на стороне AEVION для регулятора в вашей юрисдикции",
    ],
    successCriteria: [
      "Первый успешный sandbox-перевод AEV между двумя счетами за 14 дней",
      "Один реальный payment flow в production (даже на 1 USD) за 60 дней",
      "OpenAPI 3.1 интеграционный документ ваших endpoints готов к 90 дням",
    ],
    accent: "#10b981",
    bg: "rgba(16,185,129,0.08)",
  },
];

export default function PilotPage() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050810 0%, #0a0e1a 40%, #0f172a 100%)", color: "#f8fafc", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <Wave1Nav />

      {/* HERO */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 24 }}>
          90-day pilots · pre-priced · credited 100% against acquisition
        </div>
        <h1 style={{ fontSize: "clamp(40px, 6.5vw, 76px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.03em", marginBottom: 24 }}>
          Запустите AEVION у себя.<br />
          <span style={{ background: "linear-gradient(135deg, #10b981 0%, #3b82f6 60%, #a855f7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            90 дней. Фиксированная цена.
          </span>
        </h1>
        <p style={{ fontSize: 20, color: "#cbd5e1", maxWidth: 780, lineHeight: 1.55, marginBottom: 24 }}>
          Три пилотных контракта по фиксированной цене. Каждый включает onboarding, SDK seats, выделенный канал коммуникации, недельный success-review.{" "}
          <strong style={{ color: "#f8fafc" }}>Pilot-fee засчитывается 100% против будущей цены приобретения</strong>, если ваша компания решит купить AEVION.
        </p>
        <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, padding: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 16 }}>
          <strong style={{ color: "#10b981" }}>Acquisition optionality:</strong> любой пилот включает право первого отказа на acquisition по floor-цене <strong>$1B USD net</strong>{" "}(см. <Link href="/acquire" style={{ color: "#10b981" }}>/acquire</Link>) на 24 месяца после старта пилота. Стандартная exclusivity-конструкция в M&A.
        </div>
      </section>

      {/* PILOTS GRID */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
          {PILOTS.map(p => (
            <article key={p.id} style={{ padding: 32, background: p.bg, border: `1px solid ${p.accent}40`, borderRadius: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: p.accent, textTransform: "uppercase" }}>{p.badge}</div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.2, margin: 0 }}>{p.title}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 44, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>{p.price}</span>
                <span style={{ fontSize: 14, color: "#94a3b8" }}>· {p.duration}</span>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Modules</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.modules.map(m => (
                    <span key={m} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${p.accent}40`, color: "#cbd5e1", borderRadius: 999, fontWeight: 600 }}>{m}</span>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Что входит</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.included.map(item => (
                    <li key={item} style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55, paddingLeft: 16, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: p.accent }}>·</span>{item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Success criteria</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.successCriteria.map(c => (
                    <li key={c} style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55, paddingLeft: 16, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: p.accent }}>✓</span>{c}
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={
                  "mailto:yahiin1978@gmail.com" +
                  "?subject=" + encodeURIComponent(`AEVION ${p.badge} — start request`) +
                  "&body=" + encodeURIComponent(
                    `Здравствуйте,\n\nИнтересует запуск ${p.badge} (${p.price} / ${p.duration}).\n\nКомпания:\nКонтактное лицо:\nДолжность:\nТехническая команда (роли):\nЖелаемая дата старта:\n\nГотов(а) подписать pilot SOW в течение 5 рабочих дней после первого звонка.\n\n--`
                  )
                }
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 24px",
                  fontSize: 14,
                  fontWeight: 800,
                  background: p.accent,
                  color: "#0a0e1a",
                  borderRadius: 12,
                  textDecoration: "none",
                  border: "none",
                  textAlign: "center",
                  justifyContent: "center",
                }}
              >
                Start {p.badge} →
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 20 }}>
            Why pre-priced pilots
          </div>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 24 }}>
            Pilot — это не «попробуй и посмотрим». Это первая страница SPA.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
            {[
              { t: "Fixed price", d: "Никаких «time-and-materials». Цена зафиксирована до старта." },
              { t: "100% credit", d: "Если ваша компания решит купить AEVION в течение 24 мес — pilot-fee засчитывается против $1B floor." },
              { t: "Right of first refusal", d: "Pilot включает право первого отказа на acquisition по floor-цене $1B." },
              { t: "No black-box", d: "Public health-board, public Constitution, open registry. Покупатель не делает ставку вслепую." },
            ].map(item => (
              <div key={item.t} style={{ padding: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>{item.t}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>{item.d}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link href="/acquire" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", fontSize: 14, fontWeight: 800, background: "linear-gradient(135deg,#10b981,#3b82f6)", color: "#0a0e1a", borderRadius: 12, textDecoration: "none" }}>
              See full acquisition brief →
            </Link>
            <Link href="/transparency" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", fontSize: 14, fontWeight: 700, color: "#cbd5e1", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, textDecoration: "none" }}>
              Live transparency board
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
