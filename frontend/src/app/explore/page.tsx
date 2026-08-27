"use client";

import { useEffect, useRef, useState } from "react";
import { TrustScoreBadge } from "@/components/TrustScoreBadge";
import { track } from "@/lib/track";
import { apiUrl } from "@/lib/apiBase";
import { LIVE_MODULES } from "@/data/pitchFacts";

type Status = "live" | "new" | "soon";
// noAuth — модуль показывает суть БЕЗ регистрации. Пометка нужна там, где
// иначе человек упрётся в форму входа и уйдёт, так и не увидев продукт.
type Item = { name: string; slug: string; desc: string; status: Status; noAuth?: string };
type Region = { name: string; code: string; items: Item[] };

const REGIONS: Region[] = [
  {
    name: "Trust & Ownership",
    code: "CORE",
    items: [
      { name: "QRight", slug: "qright", desc: "Register a work, get a content-hashed receipt (HMAC + Ed25519) and route royalties.", status: "live" },
      { name: "QSign", slug: "qsign", desc: "Sign any JSON over an RFC 8785 canonical form — verifiable anywhere.", status: "live" },
      { name: "QContract", slug: "qcontract", desc: "Self-destruct smart documents: burn-after-N-reads, expiry, password gate.", status: "live" },
      { name: "Bureau", slug: "bureau", desc: "The public registry of verified authors, orgs and notarized certificates.", status: "live" },
    ],
  },
  {
    name: "Artificial Intelligence",
    code: "AI",
    items: [
      { name: "Multichat Engine", slug: "multichat-engine", desc: "Консилиум ИИ: агенты отвечают независимо, карта разногласий показывает, где им нельзя верить, и каждый ответ идёт с проверяемым чеком.", status: "live", noAuth: "Пример разногласий — без входа" },
      { name: "QReal Studio", slug: "qreal", desc: "Fully-alive AI video from a text brief — no actor, one face across every shot, scored realism QC, built-in provenance.", status: "live", noAuth: "Готовый проект-пример — без входа" },
      { name: "QVenture", slug: "qventure", desc: "AI investment analyst: quant score, four-role council, entry strategy.", status: "live" },
      { name: "QCoreAI", slug: "qcoreai", desc: "Multi-agent pipeline — Analyst → Writer → Critic, eval harness, batch runs.", status: "live" },
      { name: "QFusionAI", slug: "qfusionai", desc: "Hybrid router across OpenAI, Anthropic, Gemini, DeepSeek and Grok.", status: "live" },
      { name: "QPersona", slug: "qpersona", desc: "An AI twin built from your texts, voice and decisions.", status: "live" },
      { name: "DeepSan", slug: "deepsan", desc: "Anti-chaos productivity: tasks as states, an AI inbox parser, enforced focus.", status: "live" },
    ],
  },
  {
    name: "Money & Payments",
    code: "FIN",
    items: [
      { name: "AEVION Bank", slug: "bank", desc: "Unified wallet for credits, automatic royalties and trust-gated credit.", status: "live" },
      { name: "QPayNet", slug: "qpaynet", desc: "Embedded payments: wallets, transfers and merchant rails.", status: "live" },
      { name: "QMaskCard", slug: "qmaskcard", desc: "Disposable virtual cards for safe online purchases.", status: "live" },
      { name: "QTrade", slug: "qtrade", desc: "Pro trading terminal: live markets, OHLC, SL/TP brackets, alerts.", status: "live" },
      { name: "QTradeOffline", slug: "qtradeoffline", desc: "P2P AEV transfers without internet — ECDSA-signed, claim later.", status: "live" },
    ],
  },
  {
    name: "Health & Life",
    code: "LIFE",
    items: [
      { name: "Longevity", slug: "longevity", desc: "Measure → act → re-measure: a standard lab + functional panel, an evidence-graded 12-week stack, then a delta score.", status: "new" },
      { name: "QRenew", slug: "qrenew", desc: "Cellular-renewal program: biological age (PhenoAge) and an evidence-tiered intervention stack.", status: "live" },
      { name: "QMelanin", slug: "qmelanin", desc: "Anti-graying engine: Zn:Cu ratio, deficiency flags and a food protocol against pigment loss.", status: "live" },
      { name: "HealthAI", slug: "healthai", desc: "Symptom triage, wellness log and PHQ-9 / GAD-7 screening. Not medical advice.", status: "live" },
      { name: "QGood", slug: "qgood", desc: "AI support for psychological wellbeing. Wellness, not therapy.", status: "live" },
      { name: "QLife", slug: "qlife", desc: "A personal OS: finance, health and tasks in one interface.", status: "live" },
      { name: "LifeBox", slug: "lifebox", desc: "A 100-year digital vault for documents, knowledge and inheritance.", status: "live" },
    ],
  },
  {
    name: "Privacy & Networks",
    code: "NET",
    items: [
      // Tor помечен планом, а не возможностью: реестр (/api/aevion/catalog) про этот
      // модуль пишет «Tor-proxy roadmap Q4 2026», а карточка обещала «Tor-routed
      // traffic» со статусом live и без единой оговорки. Замер 27.08.2026.
      { name: "VeilNetX", slug: "veilnetx", desc: "Privacy check: what your request reveals (IP/geo/UA + exposure score) and browser leaks (WebRTC/canvas). Tor proxy — roadmap Q4 2026.", status: "live" },
      { name: "ShadowNet", slug: "shadownet", desc: "An anonymous mesh network layered over VeilNetX.", status: "live" },
      { name: "QChainGov", slug: "qchaingov", desc: "DAO governance with identity-bound voting via AEVION Auth + QSign.", status: "live" },
    ],
  },
  {
    name: "Build & World",
    code: "WORLD",
    items: [
      { name: "DevHub", slug: "devhub", desc: "Build and deploy apps with AI — no GitHub or cloud accounts needed.", status: "live" },
      { name: "QBuild", slug: "qbuild", desc: "A hiring platform for the construction vertical.", status: "live" },
      { name: "Constitution", slug: "constitution", desc: "World-system design lab: eight sliders, ten historical regimes.", status: "live" },
      { name: "MapReality", slug: "mapreality", desc: "A map of real needs — geo-pinned citizen signals.", status: "new" },
    ],
  },
];

const STATUS_LABEL: Record<Status, string> = { live: "Live", new: "New", soon: "Soon" };

export default function ExplorePlanet() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fromBig6, setFromBig6] = useState(false);
  const [liveModules, setLiveModules] = useState<number | null>(null);

  // Same live registry counter /acquire shows - the two landing pages used to
  // disagree (static "25+" here vs live "30+" there), which reads as sloppy
  // to exactly the visitors outreach brings.
  useEffect(() => {
    fetch(apiUrl("/api/aevion/stats"))
      .then((r) => r.json())
      .then((d) => {
        // /api/aevion/stats shape: { total, byStatus: { live, mvp }, ... }
        const live = d?.byStatus?.live ?? d?.total;
        if (typeof live === "number" && live > 0) setLiveModules(live);
      })
      .catch(() => {});
  }, []);

  // Outreach attribution: full query lands in `path`; utm_source is lifted
  // into `source` so /admin/events aggregates by campaign without parsing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    track({
      type: "page_view",
      source: params.get("utm_source") ?? undefined,
      meta: { campaign: params.get("utm_campaign") },
    });
    if (params.get("utm_campaign") === "big6") setFromBig6(true);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const x = c.getContext("2d");
    if (!x) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, stars: { x: number; y: number; r: number; a: number; s: number }[] = [];
    let raf = 0;
    const init = () => {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
      const n = Math.min(140, Math.floor((w * h) / 14000));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2, a: Math.random() * 0.5 + 0.15, s: Math.random() * 0.06 + 0.01,
      }));
    };
    const draw = () => {
      x.clearRect(0, 0, w, h);
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches ||
        document.documentElement.getAttribute("data-theme") === "dark";
      for (const st of stars) {
        x.beginPath();
        x.arc(st.x, st.y, st.r, 0, 6.283);
        x.fillStyle = `rgba(${dark ? "180,200,195" : "90,110,105"},${st.a})`;
        x.fill();
        if (!reduce) { st.y -= st.s; if (st.y < -2) { st.y = h + 2; st.x = Math.random() * w; } }
      }
      x.save();
      const darkStroke = dark ? "230,178,74" : "169,118,31";
      x.strokeStyle = `rgba(${darkStroke},.10)`;
      x.lineWidth = 1;
      x.beginPath();
      x.ellipse(w * 0.82, h * 0.2, Math.min(w, h) * 0.55, Math.min(w, h) * 0.2, -0.5, 0, 6.283);
      x.stroke();
      x.restore();
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    init();
    draw();
    const onResize = () => { init(); if (reduce) draw(); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="aevx-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <canvas ref={canvasRef} className="aevx-stars" aria-hidden="true" />
      {fromBig6 && (
        <div style={{ position: "relative", zIndex: 5, textAlign: "center", padding: "10px 16px", fontSize: 13, background: "#0E766E", borderBottom: "1px solid #0B5D57", color: "#FFFFFF" }}>
          Came from the benchmark invitation? The partnership brief is here →{" "}
          <a href="/acquire" style={{ color: "#A7F3D0", fontWeight: 700, textDecoration: "underline" }}>aevion.app/acquire</a>
        </div>
      )}
      <div className="aevx-wrap">
        <div className="aevx-top">
          <div className="aevx-brand"><span className="aevx-dot" />AEVION</div>
          <nav className="aevx-nav">
            <a href="/qventure">QVenture</a>
            <a href="/pricing">Pricing</a>
            <a href="/">Enter →</a>
          </nav>
        </div>

        <section className="aevx-hero">
          <p className="aevx-eyebrow">A planet, live on Anthropic</p>
          <h1 className="aevx-h1">One platform. <span className="aevx-accent">An entire planet</span> of tools you own.</h1>
          <p className="aevx-lede">
            AEVION is a working world of AI, ownership and money — built on a single trust core. Register what you create, prove it cryptographically, get paid for it, and run your business, health and life from one place. <b>Start with QVenture; the rest of the planet opens from there.</b>
          </p>
          <div className="aevx-cta-row">
            <a className="aevx-btn aevx-btn-primary" href="/qventure">Explore QVenture →</a>
            <a className="aevx-btn aevx-btn-ghost" href="/pricing">Start free</a>
          </div>
          <div className="aevx-stats">
            {/* Fallback is the build-time count, not a frozen string: if the
                stats call fails the visitor still sees a number that was true
                when the page shipped, instead of a "25+" that stopped being
                true four months ago. */}
            <div className="aevx-stat"><b>{liveModules ? `${liveModules}` : `${LIVE_MODULES}`}</b><span>Live modules</span></div>
            <div className="aevx-stat"><b>1</b><span>Trust core (IP · signing)</span></div>
            <div className="aevx-stat"><b>0→100</b><span>QVenture quant score</span></div>
            <div className="aevx-stat"><b>Ed25519</b><span>Signed authorship</span></div>
          </div>
          <TrustScoreBadge />
        </section>

        <section className="aevx-flag">
          <div>
            <p className="aevx-tag">Flagship · start here</p>
            <h2 className="aevx-flag-h2">QVenture — AI Investment Analyst</h2>
            <p className="aevx-flag-p">
              Fund-grade due diligence in seconds: a transparent 0–100 quant score across eight factors, a four-role expert council — scientist, data analyst, economist, lawyer — and a concrete entry strategy. Upload a pitch deck or describe a deal; get an investment memo you can act on.
            </p>
            <a className="aevx-btn aevx-btn-primary" href="/qventure">Run an analysis →</a>
          </div>
          <div className="aevx-demo">
            <span>From a live memo</span>
            “A staged, conviction-scaled WATCH-to-invest — we lead a partial ticket now rather than pass or go all-in. The strongest reason: a regulatory moat paired with genuine execution signal.”
          </div>
        </section>

        <div className="aevx-atlas-head">
          <h2>Explore the planet</h2>
          <p>Every region shares one trust core — your work is signed, owned and paid the same way across all of it.</p>
        </div>

        {REGIONS.map((r) => (
          <section className="aevx-region" key={r.code}>
            <div className="aevx-region-label">
              <span className="aevx-code">{r.code}</span>
              <h3>{r.name}</h3>
              <span className="aevx-rule" />
            </div>
            <div className="aevx-grid">
              {r.items.map((it) => (
                <a className="aevx-card" href={`/${it.slug}`} key={it.slug}>
                  <span className="aevx-callsign">{it.slug}</span>
                  <h4>{it.name}</h4>
                  <p>{it.desc}</p>
                  {it.noAuth && <p className="aevx-noauth">{it.noAuth}</p>}
                  <div className="aevx-foot">
                    <span className={`aevx-pill aevx-${it.status}`}>{STATUS_LABEL[it.status]}</span>
                    <span className="aevx-arrow">→</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}

        <section className="aevx-honest">
          <p className="aevx-honest-mono">Straight talk</p>
          <h3>What&apos;s live, and what&apos;s still forming</h3>
          <p>The modules marked <b>Live</b> are deployed and working today. A few regions are still forming and are marked <b>Soon</b> — we&apos;d rather show you the map honestly than pretend the whole planet is finished.</p>
          <p>Health tools (HealthAI, QGood and related) are <b>wellness and education, not medical advice</b>, and don&apos;t replace a doctor.</p>
        </section>

        <section className="aevx-close">
          <p className="aevx-manifesto">One system. Infinite possibilities.</p>
          <a className="aevx-btn aevx-btn-primary" href="/pricing">Start free on the planet →</a>
        </section>

        <footer className="aevx-footer">
          <div className="aevx-copy">© AEVION — Досымбек Жақия. Authorship signed (Ed25519). All rights reserved.</div>
          <div className="aevx-links">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/">aevion.app</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

const CSS = `
.aevx-root{
  --aevx-ground:#eef1ef; --aevx-surface:#ffffff; --aevx-surface-2:#f5f7f4;
  --aevx-text:#111a1b; --aevx-muted:#54615f; --aevx-line:#d5ddd8;
  --aevx-gold:#a9761f; --aevx-gold-soft:#c79236; --aevx-cyan:#256b60;
  --aevx-live:#2f8f5b; --aevx-new:#a9761f; --aevx-soon:#8a938f;
  --aevx-shadow:0 1px 2px rgba(10,25,22,.06),0 8px 24px rgba(10,25,22,.06);
  --aevx-mono:"Cascadia Code","SF Mono",ui-monospace,Consolas,monospace;
  --aevx-sans:-apple-system,"Segoe UI",system-ui,Roboto,sans-serif;
  --aevx-serif:Georgia,"Times New Roman",serif;
  background:var(--aevx-ground); color:var(--aevx-text);
  font-family:var(--aevx-sans); line-height:1.5; position:relative; overflow-x:hidden;
  min-height:100vh; -webkit-font-smoothing:antialiased;
}
@media (prefers-color-scheme:dark){ .aevx-root{
  --aevx-ground:#0a1315; --aevx-surface:#0f1c1f; --aevx-surface-2:#0c1719;
  --aevx-text:#e9efec; --aevx-muted:#8ea09c; --aevx-line:#1c2b2d;
  --aevx-gold:#e6b24a; --aevx-gold-soft:#f0c877; --aevx-cyan:#6cb6a9;
  --aevx-live:#57bd85; --aevx-new:#e6b24a; --aevx-soon:#7d8a86;
  --aevx-shadow:0 1px 2px rgba(0,0,0,.4),0 12px 32px rgba(0,0,0,.35);
}}
:root[data-theme="dark"] .aevx-root{
  --aevx-ground:#0a1315; --aevx-surface:#0f1c1f; --aevx-surface-2:#0c1719;
  --aevx-text:#e9efec; --aevx-muted:#8ea09c; --aevx-line:#1c2b2d;
  --aevx-gold:#e6b24a; --aevx-gold-soft:#f0c877; --aevx-cyan:#6cb6a9;
  --aevx-live:#57bd85; --aevx-new:#e6b24a; --aevx-soon:#7d8a86;
}
:root[data-theme="light"] .aevx-root{
  --aevx-ground:#eef1ef; --aevx-surface:#ffffff; --aevx-surface-2:#f5f7f4;
  --aevx-text:#111a1b; --aevx-muted:#54615f; --aevx-line:#d5ddd8;
  --aevx-gold:#a9761f; --aevx-gold-soft:#c79236; --aevx-cyan:#256b60;
  --aevx-live:#2f8f5b; --aevx-new:#a9761f; --aevx-soon:#8a938f;
}
.aevx-stars{position:fixed; inset:0; width:100%; height:100%; z-index:0; pointer-events:none;}
.aevx-wrap{position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:0 24px;}
.aevx-top{display:flex; align-items:center; justify-content:space-between; padding:22px 0; gap:16px;}
.aevx-brand{display:flex; align-items:baseline; gap:10px; letter-spacing:.14em; font-weight:700; font-size:15px;}
.aevx-dot{width:9px;height:9px;border-radius:50%;background:var(--aevx-gold);display:inline-block;box-shadow:0 0 12px var(--aevx-gold-soft);}
.aevx-nav{display:flex; gap:22px; font-size:13px; font-family:var(--aevx-mono); text-transform:uppercase; letter-spacing:.08em;}
.aevx-nav a{color:var(--aevx-muted); text-decoration:none;}
.aevx-nav a:hover{color:var(--aevx-gold);}
.aevx-hero{padding:64px 0 40px; max-width:820px;}
.aevx-eyebrow{font-family:var(--aevx-mono); font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:var(--aevx-cyan); margin:0 0 20px;}
.aevx-h1{font-size:clamp(40px,6.2vw,68px); line-height:1.03; letter-spacing:-.025em; font-weight:700; margin:0 0 22px; text-wrap:balance;}
.aevx-accent{color:var(--aevx-gold);}
.aevx-lede{font-size:clamp(17px,2vw,20px); color:var(--aevx-muted); max-width:60ch; margin:0 0 30px;}
.aevx-lede b{color:var(--aevx-text); font-weight:600;}
.aevx-cta-row{display:flex; flex-wrap:wrap; gap:12px; align-items:center;}
.aevx-btn{display:inline-flex; align-items:center; gap:8px; font-size:15px; font-weight:600; text-decoration:none; padding:13px 22px; border-radius:10px; transition:transform .15s ease, background .15s ease;}
.aevx-btn-primary{background:var(--aevx-gold); color:#1a1205;}
.aevx-btn-primary:hover{transform:translateY(-1px); background:var(--aevx-gold-soft);}
.aevx-btn-ghost{color:var(--aevx-text); border:1px solid var(--aevx-line);}
.aevx-btn-ghost:hover{border-color:var(--aevx-gold); color:var(--aevx-gold);}
.aevx-stats{display:flex; flex-wrap:wrap; gap:14px 40px; margin-top:44px; padding-top:26px; border-top:1px solid var(--aevx-line);}
.aevx-stat b{display:block; font-size:26px; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-.02em;}
.aevx-stat span{font-family:var(--aevx-mono); font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--aevx-muted);}
.aevx-flag{margin:60px 0; background:var(--aevx-surface); border:1px solid var(--aevx-line); border-radius:16px; padding:34px; box-shadow:var(--aevx-shadow); display:grid; grid-template-columns:1.4fr 1fr; gap:30px; align-items:center;}
.aevx-tag{font-family:var(--aevx-mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--aevx-gold); margin:0 0 12px;}
.aevx-flag-h2{font-size:30px; letter-spacing:-.02em; margin:0 0 12px; font-weight:700;}
.aevx-flag-p{color:var(--aevx-muted); margin:0 0 20px; font-size:16px;}
.aevx-demo{font-family:var(--aevx-serif); font-style:italic; font-size:15px; line-height:1.55; color:var(--aevx-text); background:var(--aevx-surface-2); border-left:3px solid var(--aevx-gold); padding:16px 18px; border-radius:0 10px 10px 0;}
.aevx-demo span{color:var(--aevx-muted); font-style:normal; font-family:var(--aevx-mono); font-size:11px; display:block; letter-spacing:.08em; text-transform:uppercase; margin-bottom:8px;}
.aevx-atlas-head{margin:72px 0 8px; display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap;}
.aevx-atlas-head h2{font-size:15px; font-family:var(--aevx-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--aevx-text); font-weight:600; margin:0;}
.aevx-atlas-head p{margin:0; color:var(--aevx-muted); font-size:13px; max-width:46ch;}
.aevx-region{margin:40px 0;}
.aevx-region-label{display:flex; align-items:center; gap:14px; margin-bottom:18px;}
.aevx-region-label h3{font-size:20px; letter-spacing:-.01em; margin:0; font-weight:700;}
.aevx-code{font-family:var(--aevx-mono); font-size:11px; color:var(--aevx-cyan); letter-spacing:.12em;}
.aevx-rule{flex:1; height:1px; background:var(--aevx-line);}
.aevx-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:14px;}
.aevx-card{position:relative; background:var(--aevx-surface); border:1px solid var(--aevx-line); border-radius:13px; padding:20px; text-decoration:none; color:inherit; display:flex; flex-direction:column; min-height:150px; transition:transform .15s ease, border-color .15s ease;}
.aevx-card:hover{transform:translateY(-2px); border-color:var(--aevx-gold);}
.aevx-callsign{font-family:var(--aevx-mono); font-size:10.5px; letter-spacing:.1em; color:var(--aevx-muted); text-transform:uppercase;}
.aevx-card h4{font-size:17px; margin:8px 0 7px; font-weight:700; letter-spacing:-.01em;}
.aevx-card p{margin:0; font-size:13.5px; color:var(--aevx-muted); line-height:1.45; flex:1;}
/* Пометка «без входа» не должна тянуть на себя внимание сильнее описания —
   это подсказка, снимающая страх регистрации, а не второй заголовок. */
.aevx-card p.aevx-noauth{flex:0; font-size:12px; font-weight:600; letter-spacing:.01em;
  color:var(--aevx-gold); margin-top:2px;}
.aevx-foot{display:flex; align-items:center; justify-content:space-between; margin-top:14px;}
.aevx-pill{font-family:var(--aevx-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; padding:3px 8px; border-radius:20px; border:1px solid;}
.aevx-pill.aevx-live{color:var(--aevx-live); border-color:color-mix(in srgb,var(--aevx-live) 40%,transparent);}
.aevx-pill.aevx-new{color:var(--aevx-new); border-color:color-mix(in srgb,var(--aevx-new) 45%,transparent);}
.aevx-pill.aevx-soon{color:var(--aevx-soon); border-color:color-mix(in srgb,var(--aevx-soon) 40%,transparent);}
.aevx-arrow{color:var(--aevx-muted); font-family:var(--aevx-mono); font-size:15px; transition:color .15s, transform .15s;}
.aevx-card:hover .aevx-arrow{color:var(--aevx-gold); transform:translateX(3px);}
.aevx-honest{margin:64px 0; background:var(--aevx-surface-2); border:1px solid var(--aevx-line); border-radius:14px; padding:26px 28px;}
.aevx-honest h3{margin:0 0 8px; font-size:16px; font-weight:700;}
.aevx-honest p{margin:0 0 6px; color:var(--aevx-muted); font-size:14px; max-width:75ch;}
.aevx-honest-mono{font-family:var(--aevx-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--aevx-cyan) !important;}
.aevx-honest b{color:var(--aevx-text);}
.aevx-close{text-align:center; padding:80px 0 40px;}
.aevx-manifesto{font-family:var(--aevx-serif); font-style:italic; font-size:clamp(22px,3.4vw,32px); line-height:1.3; letter-spacing:-.01em; max-width:20ch; margin:0 auto 30px; text-wrap:balance;}
.aevx-close .aevx-btn-primary{font-size:16px; padding:15px 30px;}
.aevx-footer{border-top:1px solid var(--aevx-line); margin-top:60px; padding:28px 0 50px; display:flex; flex-wrap:wrap; gap:14px 26px; align-items:center; justify-content:space-between;}
.aevx-links{display:flex; gap:20px; font-family:var(--aevx-mono); font-size:12px; text-transform:uppercase; letter-spacing:.08em;}
.aevx-footer a{color:var(--aevx-muted); text-decoration:none;} .aevx-footer a:hover{color:var(--aevx-gold);}
.aevx-copy{font-size:12px; color:var(--aevx-muted);}
@media(max-width:820px){ .aevx-flag{grid-template-columns:1fr;} .aevx-grid{grid-template-columns:1fr 1fr;} .aevx-nav{display:none;} }
@media(max-width:540px){ .aevx-grid{grid-template-columns:1fr;} }
@media (prefers-reduced-motion:reduce){ .aevx-btn,.aevx-card,.aevx-arrow{transition:none;} }
`;
