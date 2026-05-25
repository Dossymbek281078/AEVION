"use client";

import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

const IDEAS = [
  {
    title: "QSign — государственная e-подпись",
    desc: "Post-quantum FIPS 204 — единственный коммерческий продукт в регионе. Потенциал: нацинфраструктура KZ / UAE / SA.",
    arr: "$20-100M/год",
    accent: "#10b981",
    ready: "В проде",
  },
  {
    title: "AEVION Bank — лицензированный цифровой банк",
    desc: "DIFC-лицензия + QSign-аттестация всех операций. Shariah-совместимая структура возможна.",
    arr: "$200M+/год к году 5",
    accent: "#3b82f6",
    ready: "Фундамент готов",
  },
  {
    title: "Patent Bureau (QRight v2)",
    desc: "Первый IP-реестр с on-chain аттестацией для AI-контента. Партнёрство с национальным патентным ведомством.",
    arr: "$10-50M/год",
    accent: "#8b5cf6",
    ready: "MVP в проде",
  },
  {
    title: "DevHub — Zapier для MENA/CIS",
    desc: "15 SaaS-подписок → 1 кабинет. 9 интеграций live. Zapier и Make не работают нормально в этих рынках.",
    arr: "$50-150M/год",
    accent: "#f59e0b",
    ready: "9 интеграций live",
  },
  {
    title: "QCoreAI — AI API для госсектора MENA/CIS",
    desc: "Anthropic/OpenAI не имеют compliance-дружественного присутствия в KZ/UZ/AZ. QCoreAI = «последняя миля» AI.",
    arr: "$30-80M/год",
    accent: "#ec4899",
    ready: "490 vitest, 5+ провайдеров",
  },
];

const DEAL = [
  { label: "Общий чек инвестора", value: "~$170M" },
  { label: "Secondary (основателю)", value: "$110M gross → $100M net (DIFC 0% CGT)" },
  { label: "Primary (в компанию)", value: "$60M — найм, операции, масштаб" },
  { label: "Доля инвестора", value: "70%" },
  { label: "Доля основателя", value: "30% + Chief Innovation Officer" },
  { label: "Implied pre-money valuation", value: "~$275M" },
  { label: "Команда от инвестора", value: "50-100 инженеров в течение 18 мес" },
  { label: "Advisor fee основателя", value: "$2M/год" },
  { label: "Вето основателя", value: "Изменение core IP и продуктовых направлений" },
  { label: "Юрисдикция", value: "DIFC Dubai (0% CGT, английское право)" },
  { label: "Эксклюзивность", value: "60 дней + breakup fee $5M" },
  { label: "Контакт", value: "yahiin1978@gmail.com" },
];

const SCENARIO = [
  { year: "Год 1", arr: "$15-30M", val: "$120-240M", color: "#10b981" },
  { year: "Год 3", arr: "$130M", val: "$1.0-1.6B", color: "#3b82f6" },
  { year: "Год 5", arr: "$490M", val: "$3.9-5.9B", color: "#a855f7" },
];

export default function PartnerPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #050810 0%, #0a0e1a 40%, #0f172a 100%)",
      color: "#f8fafc",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }}>
      <Wave1Nav />

      {/* HERO */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 80px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.28em", color: "#10b981", textTransform: "uppercase", marginBottom: 20 }}>
          Innovation Partnership · Not Acquisition · $100M Net to Founder
        </div>
        <h1 style={{ fontSize: "clamp(38px, 6.5vw, 76px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.03em", marginBottom: 24 }}>
          Идеи — у нас.<br />
          Команда и капитал — у вас.<br />
          <span style={{ background: "linear-gradient(135deg, #10b981, #3b82f6, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Результат — общий.
          </span>
        </h1>
        <p style={{ fontSize: 20, color: "#cbd5e1", maxWidth: 800, lineHeight: 1.6, marginBottom: 16 }}>
          AEVION — инновационная лаборатория с готовой технической базой (30+ модулей, post-quantum подписи, AI-маршрутизатор, цифровой банк, IP-реестр).
          Один основатель. Ноль выручки. <strong style={{ color: "#f8fafc" }}>Идеи, которые ни у кого больше нет.</strong>
        </p>
        <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 780, lineHeight: 1.6, marginBottom: 36 }}>
          Предложение: вы вкладываете $170M и приводите команду 50-100 инженеров.
          Получаете 70% компании. Основатель остаётся Chief Innovation Officer с 30% —
          и продолжает генерировать следующую волну идей.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20Innovation%20Partnership%20-%20LOI%20inquiry" style={btnPrimary}>
            Запросить LOI · yahiin1978@gmail.com
          </a>
          <Link href="/partner#deal" style={btnGhost}>Условия сделки</Link>
          <Link href="/transparency" style={btnGhost}>Live health-board</Link>
        </div>
      </section>

      {/* WHY PARTNERSHIP MODEL */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Почему эта модель лучше acquisition
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 36 }}>
            Идеи — дефицитный ресурс. Инженеров — можно нанять.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {[
              {
                t: "Что вы получаете", d: "70% компании + непрерывный поток идей от основателя. Не разовая покупка — живой CIO, который думает иначе.",
                accent: "#10b981",
              },
              {
                t: "Что вы экономите", d: "18 месяцев разработки и $15-30M на создание технической базы — уже сделано. QSign FIPS 204 в проде, единственный в регионе.",
                accent: "#3b82f6",
              },
              {
                t: "Почему основатель остаётся", d: "30% доли + CIO-роль + $2M advisor fee/год. При оценке $4B в год 5 — его 30% = $1.2B. Это сильная мотивация.",
                accent: "#a855f7",
              },
              {
                t: "Финансовая безопасность", d: "DIFC Dubai: 0% capital gains, английское право, DIFC Courts. $100M net — через эскроу, независимый банк, при закрытии сделки.",
                accent: "#f59e0b",
              },
            ].map(c => (
              <div key={c.t} style={{ padding: 24, background: "rgba(255,255,255,0.03)", border: `1px solid ${c.accent}30`, borderRadius: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: c.accent, marginBottom: 10 }}>{c.t}</div>
                <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IDEAS PIPELINE */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
          Innovation pipeline — что строим с командой
        </div>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 12 }}>
          5 продуктов с $490M ARR потенциалом к году 5.
        </h2>
        <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 36, lineHeight: 1.5 }}>
          Каждый из них сегодня — либо в проде, либо с готовой базой. Без команды — прототипы.
          С командой 80-100 человек — рыночные продукты.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {IDEAS.map(idea => (
            <div key={idea.title} style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: `1px solid ${idea.accent}35`, borderRadius: 20, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 0% 0%, ${idea.accent}12, transparent 60%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: idea.accent, textTransform: "uppercase" }}>{idea.ready}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc", padding: "4px 10px", background: `${idea.accent}20`, borderRadius: 999 }}>{idea.arr}</div>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.3, marginBottom: 10 }}>{idea.title}</h3>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.55, margin: 0 }}>{idea.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, padding: 20, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 14, fontSize: 14, color: "#c4b5fd" }}>
          <strong style={{ color: "#e9d5ff" }}>+ 5 незапущенных концепций</strong> — раскрываются под NDA при подписании LOI. Это следующая волна идей, которую основатель уже проработал.
        </div>
      </section>

      {/* FINANCIAL SCENARIO */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Финансовый сценарий
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 36 }}>
            При команде 80-100 человек и $60M в операции.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
            {SCENARIO.map(s => (
              <div key={s.year} style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}30`, borderRadius: 18, textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", color: s.color, textTransform: "uppercase", marginBottom: 12 }}>{s.year}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", marginBottom: 4 }}>{s.arr}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>ARR</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>company valuation</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
            При оценке $4B в год 5: <strong style={{ color: "#10b981" }}>ваши 70% = $2.8B</strong> · <strong style={{ color: "#3b82f6" }}>доля основателя 30% = $1.2B</strong> (сверх $100M уже полученных).
            Мультипликатор 8x для SaaS+fintech консервативен — Stripe торгуется на 15-20x.
          </div>
        </div>
      </section>

      {/* DEAL TERMS */}
      <section id="deal" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 16 }}>
          Условия
        </div>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 36 }}>
          8 строк. Без воды.
        </h2>
        <div style={{ padding: 36, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 24 }}>
          {DEAL.map((d, i) => (
            <div key={d.label} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: 24, padding: "15px 0", borderBottom: i === DEAL.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", paddingTop: 2 }}>
                {d.label}
              </div>
              <div style={{ fontSize: 16, color: "#f1f5f9", lineHeight: 1.5, fontWeight: d.label === "Доля инвестора" || d.label === "Secondary (основателю)" ? 800 : 400 }}>
                {d.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, padding: 28, background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, textAlign: "center" }}>
          <div style={{ fontSize: 15, color: "#cbd5e1", marginBottom: 18, lineHeight: 1.6 }}>
            LOI с 8 пунктами — подписываем в течение 5 рабочих дней. Funds через эскроу при закрытии. DIFC courts.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20Innovation%20Partnership%20-%20LOI%20request&body=Hello,%0A%0AWe%20are%20interested%20in%20the%20AEVION%20Innovation%20Partnership.%0A%0AOrganisation:%0AContact:%0AInvestment%20capacity:%0ATeam%20we%20can%20bring:%0APreferred%20jurisdiction:%0ATimeline:%0A%0A--" style={btnPrimary}>
              Запросить LOI · yahiin1978@gmail.com
            </a>
            <Link href="/partner#deal" style={btnGhost}>Скачать PDF brief</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>AEVION · Innovation Partnership · Confidential · 2026</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
            <Link href="/transparency" style={{ color: "#94a3b8", textDecoration: "none" }}>Live health-board</Link>
            <Link href="/acquire" style={{ color: "#94a3b8", textDecoration: "none" }}>Acquisition brief</Link>
            <Link href="/pilot" style={{ color: "#94a3b8", textDecoration: "none" }}>90-day pilot</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "14px 28px",
  fontSize: 15,
  fontWeight: 800,
  color: "#0a0e1a",
  background: "linear-gradient(135deg, #10b981, #3b82f6)",
  borderRadius: 12,
  textDecoration: "none",
  boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "14px 24px",
  fontSize: 14,
  fontWeight: 700,
  color: "#cbd5e1",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 12,
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.12)",
};
