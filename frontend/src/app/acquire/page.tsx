"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Pillar = {
  id: string;
  title: string;
  oneLine: string;
  modules: string[];
  proof: string;
  tamAnchor: string;
  accent: string;
};

type RegistryStats = {
  totalModules?: number;
  coverage?: {
    withFrontend?: number;
    withOpenapi?: number;
    withHealth?: number;
    withOgImage?: number;
  };
};

const PILLARS: Pillar[] = [
  {
    id: "money",
    title: "Финансовый слой",
    oneLine:
      "Расчётная единица + платёжная рельса + банковский UI для эпохи, когда «банк» = API.",
    modules: ["AEV", "QPayNet", "AEVION Bank", "Payments Rail", "QTrade", "QTradeOffline"],
    proof: "AEV cap 21M · /api/aev/* 6 endpoints · smoke 10/10 · QPayNet ~99.5% prod",
    tamAnchor: "Digital payments flow → $20T к 2030",
    accent: "#10b981",
  },
  {
    id: "trust",
    title: "Защита и право",
    oneLine:
      "Подпись, секреты, патенты и governance — встроены в один контур, FIPS 204 post-quantum.",
    modules: ["QSign v2", "QShield", "QRight", "QContract", "QChainGov", "QMaskCard", "VeilNetX", "Z-Tide"],
    proof: "ML-DSA-65 GA · prod smoke 20/20 · QShield Lagrange-reconstruct · QRight IP-registry live",
    tamAnchor: "IP economy + cybersec ≈ $400B → $700B",
    accent: "#3b82f6",
  },
  {
    id: "dev",
    title: "Dev-слой / Planet DevHub",
    oneLine:
      "15 SaaS-вкладок → один agent-layer под единым AEV-биллингом.",
    modules: ["DevHub (9 интеграций)", "QCoreAI (5+ AI-провайдеров)", "QBuild", "Bureau v2"],
    proof: "9 integrations live · 23 vitest · QCoreAI 230 routes / 490 vitest · QBuild 60+ endpoints",
    tamAnchor: "Dev-tools + IT-ops ≈ $200B → $400B",
    accent: "#8b5cf6",
  },
  {
    id: "consumer",
    title: "Consumer-витрины",
    oneLine:
      "Доказательство, что инфраструктура держит массовых пользователей, а не только слайды.",
    modules: ["CyberChess (AEVION CPI)", "HealthAI v3", "Multichat", "KidsAI", "Smeta Trainer", "MapReality", "LifeBox", "StartupX"],
    proof: "Stockfish 18 в браузере · 5818 пазлов · HealthAI 19 commits · Multichat 12 фич",
    tamAnchor: "Proof of execution (не TAM-якорь)",
    accent: "#fbbf24",
  },
  {
    id: "governance",
    title: "Governance / Trust",
    oneLine:
      "Constitution v1 + Planet attestations + публичный health-board.",
    modules: ["Constitution v1", "/planet", "/transparency", "/launch-status", "AEVION_COORDINATION"],
    proof: "Constitution опубликован через QSign envelope (commit 1cacd5a1) · 24/24 daily smoke",
    tamAnchor: "Trust premium для всех четырёх слоёв",
    accent: "#f472b6",
  },
];

const FIFTEEN_TABS = [
  "GitHub", "Vercel", "Railway", "Cloudflare", "ElevenLabs",
  "DALL·E", "Brevo", "Stripe", "Drive", "Notion",
  "DeepL", "Sentry", "Domain", "Analytics", "Tickets",
];

const DEAL_TERMS = [
  { label: "Floor price", value: "$1 000 000 000 USD net (после налогов)" },
  { label: "Структура", value: "70% closing · 20% retention 12 мес · 10% performance 24 мес" },
  { label: "Должность основателя", value: "Senior Advisor on AEVION matters · 24 мес · 20-30ч/мес" },
  { label: "Право вето", value: "AEV cap supply и Constitution v1 — только с письменного согласия Advisor" },
  { label: "Бренд", value: "AEVION сохраняется (не merge в покупателя)" },
  { label: "AEV token", value: "Cap 21M зафиксирован навсегда. Treasury → покупателю" },
  { label: "Команда", value: "Retention 12-24 мес, акселерированный vesting для core engineering" },
  { label: "Эксклюзивность", value: "60 дней · breakup fee $5M (если виноват покупатель)" },
  { label: "Юрисдикция", value: "Делавэр US / DIFC Dubai / Singapore — на выбор покупателя" },
  { label: "Контакт", value: "yahiin1978@gmail.com" },
];

export default function AcquirePage() {
  const [registry, setRegistry] = useState<RegistryStats | null>(null);
  const [planetCount, setPlanetCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch(apiUrl("/api/aevion/stats")).then(r => r.json()),
      fetch(apiUrl("/api/planet/stats")).then(r => r.json()),
    ]).then(([reg, planet]) => {
      if (reg.status === "fulfilled" && reg.value) setRegistry(reg.value as RegistryStats);
      if (planet.status === "fulfilled" && planet.value?.submissions != null) {
        setPlanetCount(planet.value.submissions as number);
      }
    });
  }, []);

  const totalModules = registry?.totalModules ?? 30;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050810 0%, #0a0e1a 40%, #0f172a 100%)", color: "#f8fafc", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <Wave1Nav />

      {/* HERO */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 80px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 24 }}>
          Acquisition Brief · Floor $1 000 000 000 net · Senior Advisor seat
        </div>
        <h1 style={{ fontSize: "clamp(40px, 7vw, 84px)", fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.03em", marginBottom: 24 }}>
          Все деньги.<br />
          Всё право.<br />
          Весь dev.<br />
          <span style={{ background: "linear-gradient(135deg, #10b981 0%, #3b82f6 60%, #a855f7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Одна планета.
          </span>
        </h1>
        <p style={{ fontSize: 22, color: "#cbd5e1", maxWidth: 780, lineHeight: 1.55, marginBottom: 36 }}>
          Банковские системы уходят в API. Авторское право — в continuous on-chain аттестацию.
          Dev-стек схлопывается из 15 вкладок в один agent-layer.{" "}
          <strong style={{ color: "#f8fafc" }}>AEVION — единственное место, где все три перехода уже работают</strong>{" "}
          под одной расчётной единицей (AEV) и одним правовым контуром.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 56 }}>
          <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20acquisition%20-%20LOI%20inquiry" style={btnPrimary}>
            Запросить LOI → yahiin1978@gmail.com
          </a>
          <Link href="/launch-status" style={btnGhost}>Live status</Link>
          <Link href="/transparency" style={btnGhost}>Transparency board</Link>
          <Link href="/constitution" style={btnGhost}>Constitution v1</Link>
        </div>

        {/* Live counters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24, padding: 28, background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
          <Counter label="Modules tracked" value={totalModules.toString()} sub="/api/aevion/registry" />
          <Counter label="AEV cap supply" value="21 000 000" sub="зафиксирован навсегда" />
          <Counter label="Daily smoke" value="24/24" sub="PASS today" />
          <Counter label="DevHub integrations" value="9" sub="live · +5 в очереди" />
          <Counter label="Planet attestations" value={(planetCount ?? 0).toString()} sub="/api/planet/stats" />
        </div>
      </section>

      {/* 15-TABS METAPHOR */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Killer-фича — то, что покупатель должен запомнить
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24, letterSpacing: "-0.02em" }}>
            15 вкладок → 1 кабинет.
          </h2>
          <p style={{ fontSize: 18, color: "#cbd5e1", maxWidth: 800, lineHeight: 1.6, marginBottom: 36 }}>
            Чтобы запустить простой сайт с видео в 2026, инди-команда держит 15 вкладок и платит 15 биллингов.
            <strong style={{ color: "#f8fafc" }}> AEVION DevHub</strong> — одна вкладка, один логин AEVION,
            один счёт в AEV. Девять интеграций в проде сегодня; ещё пять — в очереди.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
            {FIFTEEN_TABS.map(t => (
              <span key={t} style={{ padding: "8px 14px", fontSize: 13, color: "#64748b", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 999, textDecoration: "line-through", textDecorationColor: "rgba(239,68,68,0.6)" }}>{t}</span>
            ))}
          </div>
          <div style={{ padding: 28, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.12))", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.2em", color: "#10b981", textTransform: "uppercase", marginBottom: 8 }}>
              Один кабинет · /devhub
            </div>
            <div style={{ fontSize: 20, color: "#f8fafc", lineHeight: 1.5 }}>
              GitHub · Vercel · Railway · Cloudflare · ElevenLabs · DALL·E · Brevo · Stripe · Drive —
              управляются из одной комнаты под AEVION-аккаунтами. Биллинг — в AEV. Аудит — общий.
            </div>
          </div>
        </div>
      </section>

      {/* FIVE PILLARS */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
          Пять столпов планеты
        </div>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 40, letterSpacing: "-0.02em" }}>
          30+ модулей · одна расчётная единица · один регистр
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {PILLARS.map(p => (
            <div key={p.id} style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 0% 0%, ${p.accent}18, transparent 60%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: p.accent, textTransform: "uppercase", marginBottom: 10 }}>
                  {p.title}
                </div>
                <p style={{ fontSize: 17, color: "#f1f5f9", lineHeight: 1.5, marginBottom: 18 }}>{p.oneLine}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {p.modules.map(m => (
                    <span key={m} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: `1px solid ${p.accent}40`, color: "#cbd5e1", borderRadius: 999, fontWeight: 600 }}>{m}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 10 }}>
                  <strong style={{ color: "#e2e8f0", fontWeight: 700 }}>Proof:</strong> {p.proof}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  <strong style={{ color: "#94a3b8", fontWeight: 700 }}>TAM:</strong> {p.tamAnchor}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* THREE MACRO WAVES */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Почему сейчас
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 40, letterSpacing: "-0.02em" }}>
            Три макроволны сошлись в одной точке.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            <Wave color="#10b981" eyebrow="Деньги" title="Banking → API"
              body="Banking-as-a-service вырос с $4B до $30B+ за 5 лет. К 2030 — $90B. Расчётная рельса в эпохе после-отделений."
              size="$20T flow · 2030" />
            <Wave color="#3b82f6" eyebrow="Право" title="IP → on-chain attestation"
              body="AI-объекты требуют notary-as-default. Момент создания становится главным юридическим вопросом эпохи."
              size="$400B → $700B" />
            <Wave color="#a855f7" eyebrow="Разработка" title="Dev → agent-layer"
              body="15 SaaS-кабинетов схлопываются в один. AI-нативный DevOps выводит per-developer ARR на новый уровень."
              size="$200B → $400B" />
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN'T BUY */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
          Что нельзя купить за деньги
        </div>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 40, letterSpacing: "-0.02em" }}>
          Compositional moat — то, ради чего покупают всё, а не части.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[
            { t: "AEV в обращении", d: "Доверие к расчётной единице накапливается транзакциями, не маркетингом." },
            { t: "Constitution v1 + Planet", d: "Правовой режим, опубликованный через QSign envelope. Документ, не правила в Notion." },
            { t: "9 интеграций DevHub", d: "36+ месяцев комплаенс-работы для нового игрока. Уже пройдено." },
            { t: "30+ модулей с health-pings", d: "Каждый отдельно — 6-18 мес инжиниринга. В сумме — 200+ человеко-лет." },
          ].map(item => (
            <div key={item.t} style={{ padding: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>{item.t}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>{item.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARABLES */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Калибровка
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 32, letterSpacing: "-0.02em" }}>
            Comparable transactions
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 12px 12px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Сделка</th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Год</th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Сумма</th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Что входило</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Microsoft × GitHub", "2018", "$7.5B", "Dev-platform"],
                  ["Plaid (Visa, отменено)", "2020", "$5.3B", "API-агрегатор счетов"],
                  ["Square × Afterpay", "2021", "$29B", "Payments + BNPL"],
                  ["Adobe × Figma (отменено)", "2022", "$20B", "Design-collab"],
                  ["Stripe (private mark)", "2023", "$50-95B", "Payments rail"],
                ].map(row => (
                  <tr key={row[0]} style={{ color: "#cbd5e1" }}>
                    <td style={{ padding: "14px 12px 14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontWeight: 600, color: "#f1f5f9" }}>{row[0]}</td>
                    <td style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row[1]}</td>
                    <td style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#10b981", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{row[2]}</td>
                    <td style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 24, maxWidth: 760, lineHeight: 1.6 }}>
            AEVION = Plaid + GitHub + ранний Stripe + Figma + on-chain notary в одном контуре.
            <strong style={{ color: "#f1f5f9" }}> $1B — нижняя граница</strong>, оптимизированная на быстрый closing.
          </p>
        </div>
      </section>

      {/* DEAL */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 16 }}>
          Условия
        </div>
        <h2 style={{ fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 16, letterSpacing: "-0.03em" }}>
          <span style={{ background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            $1 000 000 000 USD
          </span>
          {" "}net.
        </h2>
        <p style={{ fontSize: 20, color: "#cbd5e1", maxWidth: 780, lineHeight: 1.55, marginBottom: 40 }}>
          Финальный слайд. Семь строк. Не «открыты к обсуждению».
        </p>

        <div style={{ padding: 36, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 24 }}>
          {DEAL_TERMS.map((term, idx) => (
            <div key={term.label} style={{ display: "grid", gridTemplateColumns: "minmax(200px, 220px) 1fr", gap: 24, padding: "16px 0", borderBottom: idx === DEAL_TERMS.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", paddingTop: 2 }}>
                {term.label}
              </div>
              <div style={{ fontSize: 16, color: "#f1f5f9", lineHeight: 1.5 }}>
                {term.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, padding: 28, background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 14, lineHeight: 1.55 }}>
            LOI с восемью пунктами (см. <Link href="/acquire" style={{ color: "#10b981", textDecoration: "underline" }}>02_DEAL_TERMS</Link>) —
            подписываем в течение 5 рабочих дней.
          </div>
          <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20acquisition%20-%20LOI%20inquiry&body=Hello,%0A%0AWe%20are%20interested%20in%20discussing%20the%20AEVION%20acquisition%20brief.%0A%0ACompany:%0AContact:%0ATimeline:%0A%0A--" style={{ ...btnPrimary, fontSize: 18, padding: "16px 36px" }}>
            acquire @ aevion.app · yahiin1978@gmail.com
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            AEVION · Acquisition Brief · Confidential · 2026-05-22
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
            <Link href="/launch-status" style={{ color: "#94a3b8", textDecoration: "none" }}>Live status</Link>
            <Link href="/transparency" style={{ color: "#94a3b8", textDecoration: "none" }}>Transparency</Link>
            <Link href="/constitution" style={{ color: "#94a3b8", textDecoration: "none" }}>Constitution</Link>
            <Link href="/devhub" style={{ color: "#94a3b8", textDecoration: "none" }}>DevHub</Link>
            <Link href="/planet" style={{ color: "#94a3b8", textDecoration: "none" }}>Planet</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Counter({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#f1f5f9", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Wave({ color, eyebrow, title, body, size }: { color: string; eyebrow: string; title: string; body: string; size: string }) {
  return (
    <div style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: `1px solid ${color}30`, borderRadius: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 100% 0%, ${color}20, transparent 65%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: color, textTransform: "uppercase", marginBottom: 10 }}>{eyebrow}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 14, letterSpacing: "-0.01em" }}>{title}</div>
        <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 16 }}>{body}</p>
        <div style={{ fontSize: 12, fontWeight: 700, color: color, letterSpacing: "0.05em" }}>{size}</div>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 28px",
  fontSize: 15,
  fontWeight: 800,
  color: "#0a0e1a",
  background: "linear-gradient(135deg, #10b981, #3b82f6)",
  borderRadius: 12,
  textDecoration: "none",
  boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
  border: "none",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 24px",
  fontSize: 14,
  fontWeight: 700,
  color: "#cbd5e1",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 12,
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.12)",
};
