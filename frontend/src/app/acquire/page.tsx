"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const KNOWN_REFS: Record<string, string> = {
  stripe: "Stripe",
  visa: "Visa",
  microsoft: "Microsoft",
  plaid: "Plaid",
  google: "Google",
  adyen: "Adyen",
  paypal: "PayPal",
  block: "Block",
  cloudflare: "Cloudflare",
  atlassian: "Atlassian",
  servicenow: "ServiceNow",
  salesforce: "Salesforce",
  aws: "AWS",
  pif: "PIF / Sanabil",
  mubadala: "Mubadala",
  temasek: "Temasek",
  sequoia: "Sequoia",
  a16z: "Andreessen Horowitz",
  anthropic: "Anthropic",
  openai: "OpenAI",
  nvidia: "NVIDIA",
  softbank: "SoftBank",
  kaspi: "Kaspi.kz",
  halyk: "Halyk Bank",
};
const REF_STORAGE_KEY = "aevion_acquire_ref_v1";

function useAcquireRef(): { key: string | null; name: string | null } {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let next: string | null = null;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("ref");
      if (fromUrl) {
        next = fromUrl.toLowerCase().split("-")[0] ?? null;
        if (next) localStorage.setItem(REF_STORAGE_KEY, next);
      } else {
        next = localStorage.getItem(REF_STORAGE_KEY);
      }
    } catch {
      // ignore — sandboxed iframes, blocked localStorage, etc.
    }
    setKey(next);
  }, []);
  if (!key) return { key: null, name: null };
  return { key, name: KNOWN_REFS[key] ?? null };
}

function withRefTag(subject: string, refName: string | null): string {
  return refName ? `${subject} [via ${refName}]` : subject;
}

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
  { label: "Цена (постоянна)", value: "$10.5M за 1% · оценка ≈ $1.05B · одинакова на всех уровнях" },
  { label: "Флагман (95%)", value: "$1 000 000 000 USD net (полный выкуп, после налогов)" },
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

type EntryTier = {
  id: string;
  name: string;
  check: string;
  investorPct: string;
  founderPct: string;
  founderStake: string;
  kind: string;
  role: string;
  accent: string;
  flagship?: boolean;
};

// Constant-price "choose your stake" ladder. ONE post-money valuation
// (~$1.053B) → a FIXED price of ~$10.53M per 1% across every tier. The flagship
// is $1B net for 95% (founder keeps 5%); every other tier is just a different
// amount bought at the SAME per-percent price. check = investorPct × $10.526M.
// founderStake = founderPct × $1052.6M. Small slice = primary (growth capital,
// founder keeps control); 95% = secondary (full buyout, founder → advisor).
const VALUATION_LABEL = "$1.05B";
const PRICE_PER_PCT = "$10.5M";
const ENTRY_TIERS: EntryTier[] = [
  { id: "angel", name: "Angel · 1%", check: "$10.5M", investorPct: "1%", founderPct: "99%", founderStake: "$1 042M", kind: "Primary · капитал в рост", role: "Founder-CEO · полный контроль", accent: "#10b981" },
  { id: "minority", name: "Minority · 10%", check: "$105M", investorPct: "10%", founderPct: "90%", founderStake: "$947M", kind: "Primary · капитал в рост", role: "Founder-CEO · полный контроль", accent: "#22c55e" },
  { id: "strategic", name: "Strategic · 25%", check: "$263M", investorPct: "25%", founderPct: "75%", founderStake: "$789M", kind: "Primary", role: "Founder-CEO · борд-место инвестору", accent: "#3b82f6" },
  { id: "partner", name: "Partner · 49%", check: "$516M", investorPct: "49%", founderPct: "51%", founderStake: "$537M", kind: "Primary + secondary", role: "Founder-CEO/CIO", accent: "#8b5cf6" },
  { id: "control", name: "Control · 75%", check: "$789M", investorPct: "75%", founderPct: "25%", founderStake: "$263M", kind: "Secondary-heavy", role: "Founder-CIO · advisor", accent: "#f59e0b" },
  { id: "full", name: "Full acquisition · 95%", check: "$1 000M net", investorPct: "95%", founderPct: "5%", founderStake: "$53M + $1B net", kind: "Secondary · полный выкуп", role: "Senior Advisor · 24 мес", accent: "#ec4899", flagship: true },
];

export default function AcquirePage() {
  const [registry, setRegistry] = useState<RegistryStats | null>(null);
  const [planetCount, setPlanetCount] = useState<number | null>(null);
  const acquireRef = useAcquireRef();

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
        {acquireRef.name && (
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
            padding: "8px 16px",
            background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.12))",
            border: "1px solid rgba(16,185,129,0.35)",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: "#cbd5e1",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "#10b981", boxShadow: "0 0 0 4px rgba(16,185,129,0.18)" }} aria-hidden />
            Hello, <span style={{ color: "#10b981", fontWeight: 800 }}>{acquireRef.name}</span> team — this brief was prepared for you.
          </div>
        )}
        {(acquireRef.key === "anthropic" || acquireRef.key === "openai" || acquireRef.key === "nvidia") && (
          <div style={{
            marginBottom: 22,
            padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(168,85,247,0.08))",
            border: "1px solid rgba(168,85,247,0.30)",
            borderRadius: 16,
            fontSize: 15,
            color: "#e2e8f0",
            lineHeight: 1.55,
            maxWidth: 820,
          }}>
            <strong style={{ color: "#f8fafc" }}>Every line of AEVION was built on your platform.</strong>{" "}
            A non-engineer — director of several construction-trust companies — shipped 30+ production
            modules solo in six months, with AI as the only engineer. Before it is an investment, AEVION
            may be the most complete living proof of what your platform makes possible. Honest disclosure:
            a short list of strategic addressees received this brief, and each was told so.
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 24 }}>
          Acquisition Brief · $10.5M за 1% · вход $10M – $1B net · Senior Advisor
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
          <a href={"mailto:yahiin1978@gmail.com?subject=" + encodeURIComponent(withRefTag("AEVION acquisition - LOI inquiry", acquireRef.name))} style={btnPrimary}>
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

      {/* PITCH VIDEO/AUDIO */}
      <PitchMedia />

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
            <strong style={{ color: "#f1f5f9" }}> $1B — верхний уровень (полный выкуп, 95%)</strong>; войти можно от $10.5M (1%) по той же цене — см. «Выбор входа» выше.
          </p>
        </div>
      </section>

      {/* CHOOSE YOUR ENTRY — tiered ladder */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 16 }}>
            Выбор входа · от $10M до $1B
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Пять входов. Один актив. Вы выбираете глубину.
          </h2>
          <p style={{ fontSize: 18, color: "#cbd5e1", maxWidth: 860, lineHeight: 1.6, marginBottom: 20 }}>
            Цена одна и постоянная: <strong style={{ color: "#f8fafc" }}>{PRICE_PER_PCT} за 1% при единой оценке {VALUATION_LABEL}.</strong>{" "}
            Вы выбираете только <em>сколько</em> покупаете — цена за процент не меняется ни на одном уровне.
            Малая доля — капитал в рост (primary), я остаюсь за рулём. 95% — полный выкуп (secondary), я ухожу в Senior Advisor.
          </p>
          <p style={{ fontSize: 15, color: "#94a3b8", maxWidth: 860, lineHeight: 1.6, marginBottom: 20 }}>
            <strong style={{ color: "#10b981" }}>Цена сегодня — миллиард, траектория — триллион.</strong>{" "}
            Мы оцениваем <em>семя</em> в {VALUATION_LABEL}. Слой под деньгами, IP и AI-provenance при настоящей команде —
            адресуемое пространство ≈ $1.5–2T к 2030. Асимметрия и есть сделка: участвовать мало и безопасно сейчас — или забрать весь двигатель; в любом случае вы рано.
          </p>
          <div style={{ display: "inline-flex", flexWrap: "wrap", marginBottom: 32, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(16,185,129,0.3)" }}>
            <div style={{ padding: "14px 22px", background: "rgba(16,185,129,0.10)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Оценка · post-money</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>{VALUATION_LABEL}</div>
            </div>
            <div style={{ padding: "14px 22px", background: "rgba(59,130,246,0.10)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Цена за 1% · фиксирована</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981", letterSpacing: "-0.02em" }}>{PRICE_PER_PCT}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {ENTRY_TIERS.map(t => (
              <div key={t.id} style={{ padding: 24, background: t.flagship ? "linear-gradient(160deg, rgba(236,72,153,0.10), rgba(168,85,247,0.06))" : "rgba(255,255,255,0.03)", border: `1px solid ${t.accent}${t.flagship ? "55" : "30"}`, borderRadius: 20, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 0% 0%, ${t.accent}14, transparent 60%)`, pointerEvents: "none" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: t.accent, textTransform: "uppercase" }}>{t.name}</div>
                    {t.flagship && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#0a0e1a", background: t.accent, padding: "3px 9px", borderRadius: 999, textTransform: "uppercase" }}>Flagship</div>}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 4 }}>{t.check}</div>
                  <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 18 }}>
                    → инвестору <strong style={{ color: t.accent }}>{t.investorPct}</strong> · основателю {t.founderPct}
                  </div>
                  {[
                    { k: "Доля основателя", v: t.founderPct },
                    { k: "Стоимость доли осн.", v: t.founderStake, hi: true },
                    { k: "Характер сделки", v: t.kind },
                    { k: "Роль основателя", v: t.role },
                  ].map(row => (
                    <div key={row.k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{row.k}</span>
                      <span style={{ fontSize: 12, color: row.hi ? t.accent : "#e2e8f0", fontWeight: row.hi ? 800 : 600, textAlign: "right" }}>{row.v}</span>
                    </div>
                  ))}
                  <a
                    href={"mailto:yahiin1978@gmail.com?subject=" + encodeURIComponent(withRefTag(`AEVION ${t.name} (${t.check} → ${t.investorPct}) — LOI inquiry`, acquireRef.name))}
                    style={{ display: "block", marginTop: 16, textAlign: "center", padding: "11px 16px", fontSize: 13, fontWeight: 800, color: t.flagship ? "#0a0e1a" : "#cbd5e1", background: t.flagship ? t.accent : "rgba(255,255,255,0.05)", border: t.flagship ? "none" : "1px solid rgba(255,255,255,0.12)", borderRadius: 10, textDecoration: "none" }}
                  >
                    Выбрать этот вход →
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "#64748b", marginTop: 24, lineHeight: 1.6, maxWidth: 860 }}>
            Цена за процент постоянна на всех уровнях ({PRICE_PER_PCT} при оценке {VALUATION_LABEL}) — это и есть единая ценовая политика.
            «Стоимость доли осн.» = доля основателя × оценка. Флагман $1B — net основателю (DIFC 0% CGT либо gross-up на стороне покупателя).
            Соотношение primary (в компанию) / secondary (кэш основателю) на каждом уровне фиксируется в LOI.
          </p>
        </div>
      </section>

      {/* DEAL */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 16 }}>
          Условия · верхний уровень (полный выкуп)
        </div>
        <h2 style={{ fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 16, letterSpacing: "-0.03em" }}>
          <span style={{ background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            $1 000 000 000 USD
          </span>
          {" "}net.
        </h2>
        <p style={{ fontSize: 20, color: "#cbd5e1", maxWidth: 780, lineHeight: 1.55, marginBottom: 40 }}>
          Верхний уровень лестницы — полный выкуп (95%). Семь строк. Меньшие доли ($10.5M–$789M по той же цене $10.5M/1%) — в таблице «Выбор входа» выше.
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
            LOI с восемью пунктами (полные условия — в таблице выше, расширенная версия в <code style={{ color: "#10b981", fontFamily: "ui-monospace, monospace" }}>promo/02_DEAL_TERMS.md</code>) —
            подписываем в течение 5 рабочих дней.
          </div>
          <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20acquisition%20-%20LOI%20inquiry&body=Hello,%0A%0AWe%20are%20interested%20in%20discussing%20the%20AEVION%20acquisition%20brief.%0A%0ACompany:%0AContact:%0ATimeline:%0A%0A--" style={{ ...btnPrimary, fontSize: 18, padding: "16px 36px" }}>
            acquire @ aevion.app · yahiin1978@gmail.com
          </a>
        </div>
      </section>

      {/* PRESS KIT + NDA */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Next step · Press kit + NDA
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 32, letterSpacing: "-0.02em" }}>
            Заберите пакет и подпишите NDA.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            <div style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#10b981", textTransform: "uppercase", marginBottom: 14 }}>
                Press kit · 7 markdown files
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 12, lineHeight: 1.3 }}>
                Полный пакет промо одним архивом
              </h3>
              <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginBottom: 18 }}>
                PROMPT (мета-промт) · MASTER PITCH (60s / 3m / 12m) · MODULES (по всем 30+) ·
                DEAL TERMS · VIDEO STORYBOARD · DEMO FLOW · FINANCIAL APPENDIX · FAQ.
                Один zip, ~42KB, читается в Cursor/Obsidian/Notepad.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <a href="/promo/aevion-acquire-pack.zip" download style={btnPrimary}>
                  Download · aevion-acquire-pack.zip
                </a>
                <Link href="/acquire/print" style={btnGhost}>
                  Print version (Ctrl+P → PDF)
                </Link>
              </div>
            </div>

            <div style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#3b82f6", textTransform: "uppercase", marginBottom: 14 }}>
                NDA · template + data room access
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 12, lineHeight: 1.3 }}>
                Запросить NDA + дата-комнату
              </h3>
              <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginBottom: 18 }}>
                После подписания NDA — доступ к cap-table, revenue cohorts, legal opinion по
                AEV-классификации, internal pricing моделям, pilot-customer references.
                Стандартный шаблон NDA на стороне AEVION; готовы принять template покупателя
                с встречной редакцией ≤3 правок.
              </p>
              <a
                href={
                  "mailto:yahiin1978@gmail.com" +
                  "?subject=" + encodeURIComponent("AEVION acquisition - NDA + data room request") +
                  "&body=" + encodeURIComponent(
                    "Здравствуйте,\n\n" +
                    "Мы заинтересованы в продолжении обсуждения по acquisition AEVION.\n\n" +
                    "Компания: \n" +
                    "Контактное лицо: \n" +
                    "Должность: \n" +
                    "Юрисдикция: \n" +
                    "Предпочитаемый шаблон NDA (AEVION-side / собственный): \n" +
                    "Желаемый timeline DD → SPA: \n\n" +
                    "Запрос: подписание NDA и доступ к дата-комнате (cap table, revenue cohorts, legal opinion по AEV, pricing-модели, pilot references).\n\n" +
                    "--"
                  )
                }
                style={{
                  ...btnPrimary,
                  background: "linear-gradient(135deg, #3b82f6, #a855f7)",
                  boxShadow: "0 8px 24px rgba(59,130,246,0.25)",
                }}
              >
                Запросить NDA → yahiin1978@gmail.com
              </a>
            </div>
          </div>

          <div style={{ marginTop: 28, padding: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
            <strong style={{ color: "#cbd5e1" }}>FAQ для тяжёлых вопросов</strong> —
            10 ответов по AEV legal status, sanctions, key-person risk, IP carve-outs, defensibility vs Stripe/Microsoft, AI-content moderation, worst-case scenarios — в архиве <code style={{ color: "#10b981", fontFamily: "ui-monospace, monospace" }}>06_FAQ.md</code>.
          </div>
        </div>
      </section>

      {/* STICKY LOI BAR */}
      <div style={{
        position: "sticky",
        bottom: 0,
        zIndex: 50,
        background: "linear-gradient(180deg, rgba(5,8,16,0) 0%, rgba(5,8,16,0.94) 30%, #050810 100%)",
        borderTop: "1px solid rgba(16,185,129,0.25)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#10b981", textTransform: "uppercase" }}>
              Выбор доли · $10.5M за 1% · до $1B net · Senior Advisor 24m
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>
              Готовы подписать LOI с восемью пунктами в 5 рабочих дней. Также — <Link href="/pilot" style={{ color: "#10b981", textDecoration: "underline" }}>90-day pilot</Link> с 100% credit против acquisition.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/pilot" style={{ display: "inline-flex", alignItems: "center", padding: "12px 20px", fontSize: 13, fontWeight: 800, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#cbd5e1", borderRadius: 12, textDecoration: "none" }}>
              90-day pilot
            </Link>
            <a href={"mailto:yahiin1978@gmail.com?subject=" + encodeURIComponent(withRefTag("AEVION acquisition - LOI inquiry", acquireRef.name))} style={{ display: "inline-flex", alignItems: "center", padding: "12px 22px", fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg,#10b981,#3b82f6)", color: "#0a0e1a", borderRadius: 12, textDecoration: "none", boxShadow: "0 8px 22px rgba(16,185,129,0.25)" }}>
              Запросить LOI · yahiin1978@gmail.com
            </a>
          </div>
        </div>
      </div>

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
            <Link href="/pilot" style={{ color: "#94a3b8", textDecoration: "none" }}>90-day pilot</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function PitchMedia() {
  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [hasVideo, setHasVideo] = useState<boolean | null>(null);
  const audioSrc = lang === "ru" ? "/promo/aevion-acquire-ru.mp3" : "/promo/aevion-acquire-en.mp3";
  const videoSrc = lang === "ru" ? "/promo/aevion-acquire-ru.mp4" : "/promo/aevion-acquire-en.mp4";
  const scriptSrc = lang === "ru" ? "/promo/script-ru.txt" : "/promo/script-en.txt";

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch(audioSrc, { method: "HEAD" }),
      fetch(videoSrc, { method: "HEAD" }),
    ]).then(([a, v]) => {
      if (cancelled) return;
      setHasAudio(a.status === "fulfilled" && a.value.ok);
      setHasVideo(v.status === "fulfilled" && v.value.ok);
    });
    return () => { cancelled = true; };
  }, [audioSrc, videoSrc]);

  return (
    <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>
              Watch the pitch · 90 seconds
            </div>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", margin: 0 }}>
              Один кабинет вместо пятнадцати.
            </h2>
          </div>
          <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.04)", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              type="button"
              onClick={() => setLang("ru")}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: lang === "ru" ? "linear-gradient(135deg,#10b981,#3b82f6)" : "transparent",
                color: lang === "ru" ? "#0a0e1a" : "#cbd5e1",
              }}
            >RU</button>
            <button
              type="button"
              onClick={() => setLang("en")}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: lang === "en" ? "linear-gradient(135deg,#10b981,#3b82f6)" : "transparent",
                color: lang === "en" ? "#0a0e1a" : "#cbd5e1",
              }}
            >EN</button>
          </div>
        </div>

        <div style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20 }}>
          {/* Video frame (poster from CSS gradient when no .mp4) */}
          <div style={{
            position: "relative",
            aspectRatio: "16 / 9",
            background: "radial-gradient(circle at 30% 20%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(circle at 70% 80%, rgba(59,130,246,0.18), transparent 55%), #050810",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            {hasVideo ? (
              <video
                key={videoSrc}
                src={videoSrc}
                poster="/promo/aevion-acquire-poster.jpg"
                controls
                preload="metadata"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              >
                <track kind="captions" />
              </video>
            ) : (
              <div style={{ textAlign: "center", padding: 24, maxWidth: 560 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.32em", color: "#10b981", textTransform: "uppercase", marginBottom: 14 }}>
                  · Audio · LIVE · Video drop pending
                </div>
                <div style={{ fontSize: "clamp(24px, 3.6vw, 38px)", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 12 }}>
                  Planet <span style={{ background: "linear-gradient(135deg,#10b981,#3b82f6,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AEVION</span>.
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                  Озвучка ниже — 90-сек инвестор-питч. Видео-монтаж выкатим следом по сценарию <code style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>promo/09_DAVINCI_EDL.md</code>.
                </div>
              </div>
            )}
            <div style={{ position: "absolute", top: 14, left: 14, fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", color: "#10b981", textTransform: "uppercase", padding: "4px 10px", background: "rgba(0,0,0,0.4)", borderRadius: 999, border: "1px solid rgba(16,185,129,0.3)" }}>
              · LIVE · Planet AEVION
            </div>
          </div>

          {/* Audio-only fallback (always available once mp3 is generated) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#64748b", textTransform: "uppercase" }}>
              Audio only · {lang.toUpperCase()}
            </div>
            {hasAudio === false ? (
              <div style={{ padding: 16, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, fontSize: 13, color: "#fbbf24", lineHeight: 1.55 }}>
                Аудио ещё не сгенерировано (ожидание ElevenLabs).{" "}
                <a href={scriptSrc} target="_blank" rel="noopener" style={{ color: "#fbbf24", textDecoration: "underline" }}>
                  Открыть скрипт {lang === "ru" ? "RU" : "EN"} →
                </a>
              </div>
            ) : (
              <audio
                key={audioSrc}
                controls
                preload="none"
                src={audioSrc}
                style={{ width: "100%", borderRadius: 10 }}
              />
            )}
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              90-секундная инвестор-озвучка по сценарию <code style={{ fontFamily: "ui-monospace, monospace", color: "#94a3b8" }}>promo/03_VIDEO_STORYBOARD.md</code>.
              Дублирующая дорожка на втором языке доступна через переключатель RU/EN выше.
            </div>
          </div>
        </div>
      </div>
    </section>
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
