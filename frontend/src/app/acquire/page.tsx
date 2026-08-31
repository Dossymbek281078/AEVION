"use client";

import Link from "next/link";
import { MODULE_NODES, REGISTRY_ENTRIES } from "@/data/pitchFacts";
import { useEffect, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";

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
      }
      // No ?ref= in the URL -> neutral page. Deliberately NOT falling back to
      // localStorage: a sticky ref from an earlier visit could greet the wrong
      // addressee on screenshots/demos. The stored value stays write-only for
      // attribution.
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
  // /api/aevion/stats shape: { total, byStatus: { live, mvp }, ... }
  total?: number;
  byStatus?: { live?: number; mvp?: number };
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
    proof: "AEV cap 21M · /api/aev/* 6 endpoints · prod smoke 12/12 (27 Jul) · QPayNet SLA 99.5%",
    tamAnchor: "Digital payments flow → $20T к 2030",
    accent: "#10b981",
  },
  {
    id: "trust",
    title: "Защита и право",
    oneLine:
      "Подпись, секреты, патенты и governance — встроены в один контур, FIPS 204 post-quantum.",
    modules: ["QSign v2", "QShield", "QRight", "QContract", "QChainGov", "QMaskCard", "VeilNetX", "Z-Tide"],
    proof: "ML-DSA-65 (FIPS 204), key-activated · prod smoke 24/24 (27 Jul) · QShield Lagrange-reconstruct · QRight IP-registry live",
    tamAnchor: "IP economy + cybersec ≈ $400B → $700B",
    accent: "#3b82f6",
  },
  {
    id: "dev",
    title: "Dev-слой / Planet DevHub",
    oneLine:
      "15 SaaS-вкладок → один agent-layer под единым AEV-биллингом.",
    modules: ["DevHub (9 интеграций)", "QCoreAI (5+ AI-провайдеров)", "QBuild", "Bureau v2"],
    proof: "9 integrations live · 23 vitest · QCoreAI 230 routes / 364 vitest · QBuild 60+ endpoints",
    tamAnchor: "Dev-tools + IT-ops ≈ $200B → $400B",
    accent: "#8b5cf6",
  },
  {
    id: "consumer",
    title: "Consumer-витрины",
    oneLine:
      "Доказательство, что инфраструктура держит массовых пользователей, а не только слайды.",
    modules: ["CyberChess (AEVION CPI)", "HealthAI v3", "Multichat", "KidsAI", "Smeta Trainer", "MapReality", "LifeBox", "StartupX"],
    proof: "Stockfish 18 в браузере · 500 000 пазлов (10 818 офлайн) · HealthAI 19 commits · Multichat 12 фич",
    tamAnchor: "Proof of execution (не TAM-якорь)",
    accent: "#fbbf24",
  },
  {
    id: "governance",
    title: "Governance / Trust",
    oneLine:
      "Constitution v1 + Planet attestations + публичный health-board.",
    modules: ["Constitution v1", "/planet", "/status", "/launch-status", "AEVION_COORDINATION"],
    proof: "Constitution опубликован через QSign envelope (commit 1cacd5a1) · daily smoke полностью зелёный",
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
  { label: "Предложение", value: "$10M возвратным авансом — возврат из доли основателя по мере роста проекта" },
  { label: "Доход проекта", value: "51% основатель / 49% Anthropic — стартовая рамка, дальше обсуждается" },
  { label: "Что покупает аванс", value: "Освобождает основателя от текущих компаний и работы по найму → фул-тайм на идеях AEVION" },
  { label: "Роль основателя", value: "Chief Idea Officer · автор и двигатель следующих идей (мажоритарная доля, остаётся)" },
  { label: "Риск партнёра", value: "Время + небольшая возвратная сумма; большие деньги — по факту роста, не на старте" },
  { label: "Бренд", value: "AEVION сохраняется (не merge в покупателя)" },
  { label: "AEV token", value: "Вынесен из периметра сделки (ring-fenced)" },
  { label: "Юрисдикция", value: "Делавэр US / DIFC Dubai / Singapore — на выбор партнёра" },
  { label: "Контакт", value: "yahiin1978@gmail.com" },
];

export default function AcquirePage() {
  const [registry, setRegistry] = useState<RegistryStats | null>(null);
  const [planetCount, setPlanetCount] = useState<number | null>(null);
  const [aiSavedPct, setAiSavedPct] = useState<number | null>(null);
  const [devhubLive, setDevhubLive] = useState<{ live: number; total: number } | null>(null);
  const acquireRef = useAcquireRef();

  // Attribution for the most valuable visits on the site: personalized briefs.
  // `source` carries the explicit ?ref= (anthropic/openai/...), full query in path.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    track({
      type: "page_view",
      source: params.get("ref") ?? params.get("utm_source") ?? undefined,
      meta: { page: "acquire", campaign: params.get("utm_campaign") },
    });
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/capabilities"))
      .then(r => r.json())
      .then(d => { if (d?.summary?.total) setDevhubLive({ live: d.summary.live, total: d.summary.total }); })
      .catch(() => {});
    Promise.allSettled([
      fetch(apiUrl("/api/aevion/stats")).then(r => r.json()),
      fetch(apiUrl("/api/planet/stats")).then(r => r.json()),
      fetch(apiUrl("/api/qcoreai/smart/savings")).then(r => r.json()),
    ]).then(([reg, planet, savings]) => {
      if (reg.status === "fulfilled" && reg.value) setRegistry(reg.value as RegistryStats);
      if (planet.status === "fulfilled" && planet.value?.submissions != null) {
        setPlanetCount(planet.value.submissions as number);
      }
      if (savings.status === "fulfilled" && typeof savings.value?.savedPct === "number" && savings.value.runs > 0) {
        setAiSavedPct(Math.round(savings.value.savedPct));
      }
    });
  }, []);

  const totalModules = registry?.total ?? registry?.totalModules ?? REGISTRY_ENTRIES;

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
            {acquireRef.key === "anthropic" ? (
              <>
                <strong style={{ color: "#f8fafc" }}>Every line of AEVION was built on your platform.</strong>{" "}
                A non-engineer — director of several construction-trust companies — shipped 30+ production
                modules solo in six months, with AI as the only engineer. Before it is an investment, AEVION
                may be the most complete living proof of what your platform makes possible. Honest disclosure:
                a short list of strategic addressees received this brief, and each was told so.
              </>
            ) : (
              <>
                <strong style={{ color: "#f8fafc" }}>Every line of AEVION was built by one person with AI as the only engineer.</strong>{" "}
                A non-engineer — director of several construction-trust companies — shipped 30+ production
                modules solo in six months, today running on Anthropic&apos;s Claude. Treat it as a working
                blueprint of what a whole platform on your models could look like. Honest disclosure:
                a short list of strategic addressees received this brief, and each was told so.
              </>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 24 }}>
          Partnership Brief · $10M возвратный аванс · доход 51/49 · одно предложение
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
          <Link href="/status" style={btnGhost}>Live health-board</Link>
          <Link href="/constitution" style={btnGhost}>Constitution v1</Link>
        </div>

        {/* Live counters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24, padding: 28, background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
          <Counter label="Modules tracked" value={totalModules.toString()} sub="/api/aevion/stats" />
          <Counter label="AEV cap supply" value="21 000 000" sub="зафиксирован навсегда" />
          <Counter label="Daily smoke" value="PASS" sub="все проверки зелёные" />
          <Counter
            label="DevHub integrations"
            value={devhubLive ? devhubLive.live.toString() : "9"}
            sub={devhubLive ? `live из ${devhubLive.total} · /studio/capabilities` : "live · +5 в очереди"}
          />
          <Counter label="Planet attestations" value={(planetCount ?? 0).toString()} sub="/api/planet/stats" />
          {aiSavedPct != null && (
            <Counter label="AI-расходы: роутинг" value={`−${aiSavedPct}%`} sub="/api/qcoreai/smart/savings · live" />
          )}
        </div>
      </section>

      {/* WHAT IS A PLANET — core thesis, shown before the deal */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "radial-gradient(circle at 80% 0%, rgba(168,85,247,0.10), transparent 55%), rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#a855f7", textTransform: "uppercase", marginBottom: 16 }}>
            Главная идея · что мы на самом деле строим
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4.4vw, 50px)", fontWeight: 900, lineHeight: 1.08, marginBottom: 24, letterSpacing: "-0.02em", maxWidth: 920 }}>
            Когда ИИ-инструменты становятся товаром, дефицитом становится{" "}
            <span style={{ background: "linear-gradient(135deg, #a855f7, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              место, где живёт пользователь.
            </span>
          </h2>
          <p style={{ fontSize: 19, color: "#cbd5e1", maxWidth: 880, lineHeight: 1.6, marginBottom: 40 }}>
            Несколько компаний уже дают ИИ «для всего». Следующий слой — не сотня вкладок, а
            самодостаточные среды-<strong style={{ color: "#f8fafc" }}>планеты</strong>, внутри которых
            происходит вся работа человека. Кто построит первую связную — владеет всей сессией пользователя.{" "}
            <strong style={{ color: "#f8fafc" }}>AEVION — первая такая планета.</strong>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {[
              { t: "Инструмент → среда", d: "За «ИИ-как-инструмент» приходит «ИИ-как-обиталище». Каждый AI-провайдер либо обрастёт планетами, либо породит их сам.", a: "#a855f7" },
              { t: "Внутри ареала — всё", d: "ИИ-инструменты, игры, банк, платежи, право, идентичность, коммерция — под одним логином и одной расчётной единицей AEV. Уходить никуда не нужно.", a: "#3b82f6" },
              { t: "Открытая по дизайну", d: "Можно подключить Amazon и другие площадки. Пользователи — или сам провайдер — строят свои под-миры поверх, оставаясь в одной экономике и контуре доверия.", a: "#10b981" },
            ].map(c => (
              <div key={c.t} style={{ padding: 24, background: "rgba(255,255,255,0.03)", border: `1px solid ${c.a}33`, borderRadius: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", color: c.a, textTransform: "uppercase", marginBottom: 10 }}>{c.t}</div>
                <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>{c.d}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 15, color: "#94a3b8", maxWidth: 880, lineHeight: 1.6, marginTop: 28 }}>
            Поэтому AEVION — это не «30 приложений». Это <strong style={{ color: "#e2e8f0" }}>первый
            потребительский и экономический слой-планета</strong> поверх модели: то, что превращает голую
            способность ИИ в место, где люди живут и совершают транзакции. Будка сбора пошлины, ОС эпохи ИИ.
            Сегодня — эскиз направления; с настоящей командой — траектория на триллион.
          </p>
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
            { t: "AEV как расчётная единица", d: "Доверие к расчётной единице накапливается транзакциями, не маркетингом." },
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
            <strong style={{ color: "#f1f5f9" }}> Это сравнимые по масштабу рынки</strong> — но я не прошу выкуп: предложение одно — $10M возвратный аванс и партнёрская доля дохода 51/49.
          </p>
        </div>
      </section>

      {/* SOFT DOORS — shown to AI-lab platform partners, above the cash ladder */}
      {(acquireRef.key === "anthropic" || acquireRef.key === "openai" || acquireRef.key === "nvidia") && (
        <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "radial-gradient(circle at 15% 0%, rgba(16,185,129,0.10), transparent 55%), rgba(255,255,255,0.015)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 16 }}>
              Для платформенного партнёра · одно предложение, не выкуп
            </div>
            <h2 style={{ fontSize: "clamp(26px, 3.8vw, 44px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 22, letterSpacing: "-0.02em", maxWidth: 900 }}>
              Партнёрство, а не покупка.
            </h2>
            <p style={{ fontSize: 18, color: "#cbd5e1", maxWidth: 880, lineHeight: 1.6, marginBottom: 36 }}>
              Партнёр платит тем, чего у него в избытке — <strong style={{ color: "#f8fafc" }}>компьют, инженеры,
              дистрибуция, бренд</strong> — плюс $10M возвратным авансом. Основатель сохраняет 51% и остаётся
              двигателем планеты. Риск — это ресурсы и небольшая возвратная сумма,{" "}
              <strong style={{ color: "#f8fafc" }}>не капитал на старте</strong>.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {[
                { tag: "Аванс", t: "$10M возвратный аванс", d: "Освобождает основателя от текущих компаний и работы по найму. Возвращается партнёру из доли основателя по мере роста проекта.", a: "#10b981" },
                { tag: "Доход", t: "Доход 51/49", d: "51% основатель / 49% партнёр — стартовая рамка деления дохода проекта; конкретные доли обсуждаются дальше.", a: "#3b82f6" },
                { tag: "Роль", t: "Основатель остаётся", d: "Chief Idea Officer — автор и двигатель следующих идей AEVION. Никуда не уходит, сохраняет мажоритарную долю.", a: "#a855f7" },
              ].map(c => (
                <div key={c.t} style={{ padding: 24, background: "rgba(255,255,255,0.03)", border: `1px solid ${c.a}40`, borderRadius: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: c.a, textTransform: "uppercase", marginBottom: 10 }}>{c.tag}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", marginBottom: 10 }}>{c.t}</div>
                  <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>{c.d}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: "#94a3b8", maxWidth: 880, lineHeight: 1.6, marginTop: 24 }}>
              <Link href="/acquire/ways" style={{ color: "#10b981", textDecoration: "underline" }}>
                Печатная версия (PDF) →
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* DEAL */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 16 }}>
          Условия · одно предложение
        </div>
        <h2 style={{ fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 16, letterSpacing: "-0.03em" }}>
          <span style={{ background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            $10M
          </span>
          {" "}возвратный аванс.
        </h2>
        <p style={{ fontSize: 20, color: "#cbd5e1", maxWidth: 780, lineHeight: 1.55, marginBottom: 40 }}>
          Партнёрство, а не выкуп: $10M возвратным авансом + доход проекта 51/49 (пока, дальше обсуждается). Условия ниже.
        </p>

        <div style={{ padding: 36, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 24 }}>
          {DEAL_TERMS.map((term, idx) => (
            <div key={term.label} data-stack-mobile="" style={{ display: "grid", gridTemplateColumns: "minmax(200px, 220px) 1fr", gap: 24, padding: "16px 0", borderBottom: idx === DEAL_TERMS.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
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
            Условия — в таблице выше; готовы подписать term sheet в течение 5 рабочих дней.
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
                PROMPT (мета-промт) · MASTER PITCH (60s / 3m / 12m) · MODULES (по всем {MODULE_NODES}) ·
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
              Одно предложение · $10M возвратный аванс · доход 51/49
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>
              Готовы подписать term sheet в 5 рабочих дней. Также — <Link href="/pilot" style={{ color: "#10b981", textDecoration: "underline" }}>90-day pilot</Link> с 100% credit против acquisition.
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
            <Link href="/status" style={{ color: "#94a3b8", textDecoration: "none" }}>Health board</Link>
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
  const [lang, setLang] = useState<"ru" | "en">("en");
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
      // A missing video on Vercel resolves to the SPA HTML fallback with HTTP 200,
      // so `.ok` alone is a false positive — require a real video content-type.
      const vOk =
        v.status === "fulfilled" &&
        v.value.ok &&
        (v.value.headers.get("content-type") || "").toLowerCase().startsWith("video");
      setHasVideo(vOk);
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
