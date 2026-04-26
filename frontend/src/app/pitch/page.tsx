"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import {
  ask,
  billionDefense,
  competitive,
  ecosystemNodes,
  financials,
  gtm,
  launchedModules,
  market,
  networkForces,
  risks,
  team,
  thesis,
  useCases,
  type LaunchStage,
  type ValueBucket,
} from "@/data/pitchModel";

type LiveMetrics = {
  qrightObjects: number | null;
  certifiedArtifacts: number | null;
  participants: number | null;
  shieldRecords: number | null;
  qtradeOps: number | null;
};

const DEMO_METRICS: LiveMetrics = {
  qrightObjects: 184,
  certifiedArtifacts: 27,
  participants: 312,
  shieldRecords: 96,
  qtradeOps: 1450,
};

const stageLabel: Record<LaunchStage, string> = {
  live: "Live",
  beta: "Beta",
  alpha: "Alpha",
  vision: "Vision",
};

const stageColor: Record<LaunchStage, string> = {
  live: "#34d399",
  beta: "#7dd3fc",
  alpha: "#fbbf24",
  vision: "#94a3b8",
};

const bucketColor: Record<ValueBucket, string> = {
  infrastructure: "#94a3b8",
  "ip-and-trust": "#5eead4",
  money: "#fbbf24",
  engagement: "#f472b6",
  intelligence: "#a78bfa",
  compliance: "#86efac",
};

const bucketLabel: Record<ValueBucket, string> = {
  infrastructure: "Infrastructure",
  "ip-and-trust": "IP & trust",
  money: "Money",
  engagement: "Engagement",
  intelligence: "Intelligence",
  compliance: "Compliance",
};

const TOC = [
  { id: "pillars", label: "Pillars" },
  { id: "market", label: "Market" },
  { id: "network", label: "Network effects" },
  { id: "modules", label: "Modules" },
  { id: "use-cases", label: "Use cases" },
  { id: "ecosystem", label: "Roadmap" },
  { id: "competitive", label: "Competition" },
  { id: "why-1b", label: "Why $1B+" },
  { id: "risks", label: "Risks" },
  { id: "gtm", label: "GTM" },
  { id: "financials", label: "Financials" },
  { id: "team", label: "Team" },
];

export default function PitchPage() {
  const [scrolled, setScrolled] = useState(0);
  const [activeSection, setActiveSection] = useState<string>(TOC[0].id);
  const [isMobile, setIsMobile] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    qrightObjects: null,
    certifiedArtifacts: null,
    participants: null,
    shieldRecords: null,
    qtradeOps: null,
  });
  const [metricsLive, setMetricsLive] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      setScrolled(Math.min(1, Math.max(0, pct)));
      const offsetLine = window.innerHeight * 0.4;
      let current = TOC[0].id;
      for (const t of TOC) {
        const el = document.getElementById(t.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= offsetLine) current = t.id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [qr, ps, qs, qt] = await Promise.all([
          fetch(apiUrl("/api/qright/objects")).catch(() => null),
          fetch(apiUrl("/api/planet/stats")).catch(() => null),
          fetch(apiUrl("/api/quantum-shield/records")).catch(() => null),
          fetch(apiUrl("/api/qtrade/summary")).catch(() => null),
        ]);
        if (cancelled) return;

        let next: LiveMetrics = { ...DEMO_METRICS };
        let anyOk = false;

        if (qr && qr.ok) {
          const j = await qr.json().catch(() => null);
          if (Array.isArray(j?.items)) { next.qrightObjects = j.items.length; anyOk = true; }
        }
        if (ps && ps.ok) {
          const j = await ps.json().catch(() => null);
          if (j) {
            next.certifiedArtifacts = j.certifiedArtifactVersions ?? next.certifiedArtifacts;
            next.participants = j.eligibleParticipants ?? next.participants;
            anyOk = true;
          }
        }
        if (qs && qs.ok) {
          const j = await qs.json().catch(() => null);
          if (Array.isArray(j?.items)) { next.shieldRecords = j.items.length; anyOk = true; }
        }
        if (qt && qt.ok) {
          const j = await qt.json().catch(() => null);
          if (j?.operationCount != null) { next.qtradeOps = j.operationCount; anyOk = true; }
        }

        if (!cancelled) {
          setMetrics(next);
          setMetricsLive(anyOk);
        }
      } catch {
        if (!cancelled) {
          setMetrics(DEMO_METRICS);
          setMetricsLive(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const liveCount = launchedModules.filter((m) => m.stage === "live").length;
  const totalNodes = launchedModules.length + ecosystemNodes.length;

  const groupedLaunched = useMemo(() => {
    const buckets: Record<ValueBucket, typeof launchedModules> = {
      infrastructure: [],
      "ip-and-trust": [],
      money: [],
      engagement: [],
      intelligence: [],
      compliance: [],
    };
    for (const m of launchedModules) buckets[m.bucket].push(m);
    return buckets;
  }, []);

  return (
    <div className="pitch-root" style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <style>{`
        @media print {
          .pitch-no-print { display: none !important; }
          .pitch-root { background: #ffffff !important; color: #0f172a !important; }
          .pitch-root * { color: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pitch-root section, .pitch-root article { background: #ffffff !important; border-color: #cbd5e1 !important; page-break-inside: avoid; }
          .pitch-root h1, .pitch-root h2, .pitch-root h3, .pitch-root h4 { color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; }
          .pitch-root a { color: #0d9488 !important; }
          .demo-aurora { display: none !important; }
        }
      `}</style>
      {/* Scroll progress bar */}
      <div
        className="pitch-no-print"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: 3,
          width: `${scrolled * 100}%`,
          background: "linear-gradient(90deg, #0d9488, #0ea5e9, #a78bfa)",
          zIndex: 100,
          transition: "width 80ms ease-out",
        }}
      />

      {/* Sticky TOC — desktop: side panel, mobile: bottom collapsible */}
      {scrolled > 0.04 && !isMobile ? (
        <div
          className="pitch-no-print"
          aria-label="Pitch sections"
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 80,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(2,6,23,0.85)",
            border: "1px solid rgba(94,234,212,0.2)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            maxWidth: 180,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: "#5eead4", marginBottom: 2 }}>
            PITCH MAP
          </div>
          {TOC.map((t) => {
            const isActive = activeSection === t.id;
            return (
              <a
                key={t.id}
                href={`#${t.id}`}
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? "#fbbf24" : "#94a3b8",
                  textDecoration: "none",
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: isActive ? "rgba(251,191,36,0.1)" : "transparent",
                  borderLeft: isActive ? "2px solid #fbbf24" : "2px solid transparent",
                  transition: "all 120ms",
                }}
              >
                {t.label}
              </a>
            );
          })}
        </div>
      ) : null}

      {/* Mobile TOC — bottom-pinned chip that expands on tap */}
      {scrolled > 0.04 && isMobile ? (
        <div
          className="pitch-no-print"
          aria-label="Pitch sections (mobile)"
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            right: 12,
            zIndex: 80,
            background: "rgba(2,6,23,0.95)",
            border: "1px solid rgba(94,234,212,0.3)",
            borderRadius: 12,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setTocOpen((v) => !v)}
            aria-expanded={tocOpen}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <span>
              <span style={{ color: "#5eead4", letterSpacing: "0.15em", fontSize: 10, marginRight: 8 }}>PITCH MAP</span>
              <span style={{ color: "#fbbf24" }}>{TOC.find((t) => t.id === activeSection)?.label ?? "—"}</span>
            </span>
            <span style={{ color: "#94a3b8", fontSize: 16 }}>{tocOpen ? "▾" : "▴"}</span>
          </button>
          {tocOpen ? (
            <div style={{ padding: "0 8px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
              {TOC.map((t) => {
                const isActive = activeSection === t.id;
                return (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    onClick={() => setTocOpen(false)}
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 800 : 600,
                      color: isActive ? "#fbbf24" : "#cbd5e1",
                      textDecoration: "none",
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: isActive ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.1)",
                    }}
                  >
                    {t.label}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ───────── HERO ───────── */}
      <section
        style={{
          position: "relative",
          minHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px 80px",
          overflow: "hidden",
        }}
      >
        <div className="demo-aurora" aria-hidden />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", width: "100%" }}>
          <Wave1Nav variant="dark" />
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,0.95)",
              margin: "0 0 16px",
            }}
          >
            {thesis.badge}
          </p>
          <h1
            style={{
              fontSize: "clamp(36px, 6.5vw, 64px)",
              fontWeight: 900,
              lineHeight: 1.04,
              margin: "0 0 24px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              maxWidth: 920,
            }}
          >
            {thesis.title}
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.2vw, 20px)",
              lineHeight: 1.6,
              maxWidth: 780,
              color: "rgba(226,232,240,0.92)",
              margin: "0 0 32px",
            }}
          >
            {thesis.lead}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <HeroStat value={`${liveCount}`} unit="live MVPs" hint={`of ${totalNodes} planned nodes`} />
            <HeroStat value="$340B" unit="addressable market" hint="IP + creators + payments" />
            <HeroStat value="$2B+" unit="modelled ARR" hint="by year 5" />
            <HeroStat value="$1B+" unit="defensible valuation" hint="five-axis defense" />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 28,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.15em",
                color: metricsLive ? "#34d399" : "#fbbf24",
                background: metricsLive ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)",
                padding: "4px 10px",
                borderRadius: 999,
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: metricsLive ? "#34d399" : "#fbbf24" }} aria-hidden />
              {metricsLive ? "Live data from API" : "Demo snapshot (backend offline)"}
            </span>
            <LivePill label="QRight records" value={metrics.qrightObjects} />
            <LivePill label="Bureau certs" value={metrics.certifiedArtifacts} />
            <LivePill label="Planet participants" value={metrics.participants} />
            <LivePill label="Shielded artifacts" value={metrics.shieldRecords} />
            <LivePill label="QTrade ops" value={metrics.qtradeOps} />
          </div>

          <div className="pitch-no-print" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <a
              href="#why-1b"
              style={{
                padding: "14px 26px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              Why $1B+ ↓
            </a>
            <a
              href="#modules"
              style={{
                padding: "14px 26px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              See the 27 modules
            </a>
            <a
              href={ask.ctaPrimary.href}
              style={{
                padding: "14px 26px",
                borderRadius: 12,
                background: "transparent",
                border: "1px solid rgba(125,211,252,0.5)",
                color: "#7dd3fc",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              {ask.ctaPrimary.label} →
            </a>
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.print(); }}
              style={{
                padding: "14px 24px",
                borderRadius: 12,
                background: "transparent",
                border: "1px solid rgba(251,191,36,0.55)",
                color: "#fbbf24",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              title="Print to PDF — opens browser print dialog with print-optimised layout"
            >
              <span aria-hidden>⤓</span> Save as PDF
            </button>
          </div>

          <p style={{ marginTop: 32, fontSize: 13, color: "#64748b", letterSpacing: "0.05em" }}>
            Scroll — every section is live data, not slides.
          </p>
        </div>
      </section>

      {/* ───────── PILLARS ───────── */}
      <Section anchor="pillars" eyebrow="Three architectural pillars" title="Why this is one product, not 27">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {thesis.pillars.map((p) => (
            <article
              key={p.kicker}
              style={{
                padding: 26,
                borderRadius: 18,
                background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,118,110,0.18))",
                border: "1px solid rgba(94,234,212,0.25)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#5eead4", marginBottom: 8 }}>
                {p.kicker}
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 850, color: "#fff", margin: "0 0 10px", lineHeight: 1.25 }}>{p.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "#cbd5e1", margin: 0 }}>{p.body}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── MARKET ───────── */}
      <Section anchor="market" eyebrow="Total addressable market" title={market.title}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {market.buckets.map((b) => (
            <article
              key={b.name}
              style={{
                padding: 24,
                borderRadius: 16,
                background: "rgba(15,23,42,0.65)",
                border: "1px solid rgba(51,65,85,0.6)",
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#fbbf24",
                  letterSpacing: "-0.03em",
                  marginBottom: 6,
                }}
              >
                {b.tam}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{b.name}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>{b.note}</div>
            </article>
          ))}
        </div>
        <p
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.25)",
            fontSize: 14,
            color: "#bfdbfe",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {market.closing}
        </p>
      </Section>

      {/* ───────── NETWORK EFFECTS ───────── */}
      <Section anchor="network" eyebrow="Compounding moats" title="Four network effects, not one">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {networkForces.map((f) => (
            <article
              key={f.code}
              style={{
                padding: 24,
                borderRadius: 16,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(167,139,250,0.3)",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  color: "#a78bfa",
                  background: "rgba(167,139,250,0.12)",
                  padding: "4px 8px",
                  borderRadius: 999,
                }}
              >
                {f.code}
              </span>
              <h3 style={{ fontSize: 17, fontWeight: 850, color: "#fff", margin: "0 0 10px 0", paddingRight: 60, lineHeight: 1.3 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "#cbd5e1", margin: "0 0 12px" }}>{f.body}</p>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#a78bfa",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(167,139,250,0.08)",
                  borderLeft: "2px solid #a78bfa",
                  lineHeight: 1.5,
                }}
              >
                ↻ {f.flywheel}
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── LAUNCHED MODULES ───────── */}
      <Section
        anchor="modules"
        eyebrow={`${liveCount} live MVPs · ${totalNodes - liveCount} more on roadmap`}
        title="Every module sells separately. The bundle sells the company."
      >
        {(Object.keys(groupedLaunched) as ValueBucket[]).map((bucket) => {
          const list = groupedLaunched[bucket];
          if (list.length === 0) return null;
          return (
            <div key={bucket} style={{ marginBottom: 32 }}>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  color: bucketColor[bucket],
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                }}
              >
                {bucketLabel[bucket]}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {list.map((m) => (
                  <article
                    key={m.id}
                    style={{
                      padding: 24,
                      borderRadius: 16,
                      background: "rgba(15,23,42,0.7)",
                      border: `1px solid ${bucketColor[bucket]}35`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        alignItems: "baseline",
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          color: bucketColor[bucket],
                        }}
                      >
                        {m.code}
                      </span>
                      <h4 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#fff" }}>{m.name}</h4>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          color: stageColor[m.stage],
                          background: `${stageColor[m.stage]}18`,
                          padding: "3px 8px",
                          borderRadius: 999,
                          textTransform: "uppercase",
                        }}
                      >
                        {stageLabel[m.stage]}
                      </span>
                      {m.href ? (
                        <Link
                          href={m.href}
                          style={{
                            marginLeft: "auto",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#7dd3fc",
                            textDecoration: "none",
                          }}
                        >
                          Open {m.name} →
                        </Link>
                      ) : null}
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#5eead4", margin: "0 0 14px", lineHeight: 1.45 }}>
                      {m.tagline}
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <PitchPanel label="Problem" body={m.problem} accent="#fb7185" />
                      <PitchPanel label="Killer feature" body={m.killerFeature} accent="#5eead4" />
                      <PitchPanel label="Network role" body={m.networkRole} accent="#a78bfa" />
                    </div>
                    {m.proof.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {m.proof.map((p) => (
                          <span
                            key={p}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#cbd5e1",
                              background: "rgba(148,163,184,0.1)",
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(148,163,184,0.25)",
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "rgba(251,191,36,0.08)",
                        border: "1px solid rgba(251,191,36,0.25)",
                        fontSize: 13,
                        color: "#fde68a",
                        lineHeight: 1.55,
                      }}
                    >
                      <strong style={{ color: "#fbbf24" }}>$$$ contribution: </strong>
                      {m.valueLine}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      {/* ───────── USE CASES ───────── */}
      <Section anchor="use-cases" eyebrow="One stack, four buyers" title={useCases.title}>
        <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 28px" }}>{useCases.intro}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {useCases.rows.map((u) => (
            <article
              key={u.persona}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 20,
                padding: 24,
                borderRadius: 16,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(125,211,252,0.25)",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "rgba(125,211,252,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {u.avatar}
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 850, color: "#7dd3fc", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
                  {u.persona}
                </h3>
                <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.65, margin: "0 0 14px" }}>{u.story}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {u.modulesUsed.map((mod) => (
                    <span
                      key={mod}
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        color: "#5eead4",
                        background: "rgba(94,234,212,0.1)",
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(94,234,212,0.25)",
                      }}
                    >
                      {mod}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#fde68a",
                    background: "rgba(251,191,36,0.08)",
                    border: "1px solid rgba(251,191,36,0.25)",
                    padding: "10px 12px",
                    borderRadius: 8,
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ color: "#fbbf24" }}>Revenue line: </strong>
                  {u.revenueLine}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── ECOSYSTEM NODES ───────── */}
      <Section
        anchor="ecosystem"
        eyebrow={`${ecosystemNodes.length} more nodes on the roadmap`}
        title="Every future module ships on the same trust rails — near-zero marginal cost."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {ecosystemNodes.map((n) => (
            <article
              key={n.id}
              style={{
                padding: 16,
                borderRadius: 12,
                background: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(51,65,85,0.5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: bucketColor[n.bucket],
                  }}
                >
                  {n.code}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: stageColor[n.stage],
                    textTransform: "uppercase",
                  }}
                >
                  {stageLabel[n.stage]}
                </span>
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: "#fff" }}>{n.name}</h4>
              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 8px" }}>{n.tagline}</p>
              <p style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
                {n.valueLine}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── COMPETITIVE ───────── */}
      <Section anchor="competitive" eyebrow="Competitive landscape" title={competitive.title}>
        <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 28px" }}>{competitive.intro}</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {competitive.alternatives.map((c) => (
            <article
              key={c.name}
              style={{
                padding: 22,
                borderRadius: 16,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(244,114,182,0.25)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: "#f472b6", marginBottom: 4, textTransform: "uppercase" }}>
                {c.category}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 850, color: "#fff", margin: "0 0 12px", lineHeight: 1.3 }}>{c.name}</h3>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: "#fb7185", marginBottom: 4, textTransform: "uppercase" }}>
                  Their gap
                </div>
                <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55, margin: 0 }}>{c.weakness}</p>
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(94,234,212,0.08)",
                  borderLeft: "2px solid #5eead4",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: "#5eead4", marginBottom: 4, textTransform: "uppercase" }}>
                  AEVION wins because
                </div>
                <p style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55, margin: 0 }}>{c.aevionWin}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── WHY $1B+ ───────── */}
      <Section anchor="why-1b" eyebrow="Defensibility stack" title={billionDefense.title}>
        <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 28px" }}>{billionDefense.intro}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {billionDefense.axes.map((a) => (
            <article
              key={a.number}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 24,
                padding: 24,
                borderRadius: 16,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(251,191,36,0.25)",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: "#fbbf24",
                  letterSpacing: "-0.05em",
                  lineHeight: 1,
                  minWidth: 60,
                }}
              >
                {a.number}
              </div>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 850, color: "#fff", margin: "0 0 8px", lineHeight: 1.3 }}>{a.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "#cbd5e1", margin: 0 }}>{a.body}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── RISKS ───────── */}
      <Section anchor="risks" eyebrow="Honest answers" title={risks.title}>
        <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 28px" }}>{risks.intro}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {risks.rows.map((r) => {
            const sevColor =
              r.severity === "high" ? "#fb7185" : r.severity === "medium" ? "#fbbf24" : "#86efac";
            return (
              <article
                key={r.risk}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 18,
                  padding: 20,
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.7)",
                  border: `1px solid ${sevColor}33`,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.15em",
                    color: sevColor,
                    background: `${sevColor}18`,
                    padding: "6px 10px",
                    borderRadius: 999,
                    textTransform: "uppercase",
                    height: "fit-content",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.severity}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 850, color: "#fff", margin: "0 0 8px", lineHeight: 1.35 }}>
                    {r.risk}
                  </h3>
                  <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
                    <strong style={{ color: "#5eead4" }}>Mitigation: </strong>
                    {r.mitigation}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* ───────── GTM ───────── */}
      <Section anchor="gtm" eyebrow="Go-to-market" title={gtm.title}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {gtm.steps.map((s, i) => (
            <article
              key={s.phase}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 20,
                padding: 20,
                borderRadius: 14,
                background: "rgba(15,23,42,0.65)",
                border: "1px solid rgba(94,234,212,0.2)",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#fff",
                }}
              >
                {i + 1}
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#5eead4", margin: "0 0 6px" }}>{s.phase}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#cbd5e1", margin: 0 }}>{s.body}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── FINANCIALS ───────── */}
      <Section anchor="financials" eyebrow="Trajectory" title={financials.title}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {financials.rows.map((r, i) => {
            const isPeak = i === financials.rows.length - 1;
            return (
              <article
                key={r.year}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: isPeak
                    ? "linear-gradient(165deg, rgba(251,191,36,0.18), rgba(15,23,42,0.7))"
                    : "rgba(15,23,42,0.6)",
                  border: isPeak ? "1px solid rgba(251,191,36,0.5)" : "1px solid rgba(51,65,85,0.5)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    color: isPeak ? "#fbbf24" : "#94a3b8",
                    marginBottom: 6,
                  }}
                >
                  {r.year}
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: isPeak ? "#fbbf24" : "#fff",
                    letterSpacing: "-0.03em",
                    marginBottom: 8,
                  }}
                >
                  {r.arr}
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>{r.drivers}</div>
              </article>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>
          {financials.disclaimer}
        </p>
      </Section>

      {/* ───────── TEAM ───────── */}
      <Section anchor="team" eyebrow="The people executing" title={team.title}>
        <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 28px" }}>{team.intro}</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {team.slots.map((s) => (
            <article
              key={s.role}
              style={{
                padding: 20,
                borderRadius: 14,
                background: "rgba(15,23,42,0.7)",
                border: "1px dashed rgba(148,163,184,0.4)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  background: "rgba(94,234,212,0.12)",
                  border: "1px solid rgba(94,234,212,0.3)",
                  margin: "0 auto 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  color: "#5eead4",
                }}
                aria-hidden
              >
                ●
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 6, lineHeight: 1.3 }}>{s.role}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{s.note}</div>
            </article>
          ))}
        </div>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            background: "rgba(94,234,212,0.08)",
            border: "1px solid rgba(94,234,212,0.25)",
            fontSize: 14,
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "#5eead4" }}>Velocity proof: </strong>
          {team.proof}
        </div>
      </Section>

      {/* ───────── ASK ───────── */}
      <section
        style={{
          padding: "80px 24px 100px",
          background: "linear-gradient(165deg, rgba(15,118,110,0.18), rgba(2,6,23,1))",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 900,
              color: "#fff",
              margin: "0 0 20px",
              letterSpacing: "-0.03em",
            }}
          >
            {ask.title}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "#cbd5e1", margin: "0 0 32px" }}>{ask.body}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <a
              href={ask.ctaPrimary.href}
              style={{
                padding: "16px 32px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 17,
                boxShadow: "0 12px 40px rgba(13,148,136,0.45)",
              }}
            >
              {ask.ctaPrimary.label}
            </a>
            <Link
              href={ask.ctaSecondary.href}
              style={{
                padding: "16px 32px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 17,
              }}
            >
              {ask.ctaSecondary.label} →
            </Link>
          </div>
          <p style={{ marginTop: 40, fontSize: 12, color: "#475569" }}>
            AEVION · 27 nodes · 12 live MVPs · one Trust Graph · {new Date().getFullYear()}
          </p>
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Reusable building blocks                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function Section({
  anchor,
  eyebrow,
  title,
  children,
}: {
  anchor: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={anchor}
      style={{
        padding: "72px 24px",
        scrollMarginTop: 24,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.2em",
            color: "#94a3b8",
            textTransform: "uppercase",
            margin: "0 0 10px",
          }}
        >
          {eyebrow}
        </p>
        <h2
          style={{
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 900,
            color: "#fff",
            margin: "0 0 36px",
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function LivePill({ label, value }: { label: string; value: number | null }) {
  const display = value == null ? "…" : value.toLocaleString("en-US");
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "#cbd5e1",
        background: "rgba(15,23,42,0.65)",
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid rgba(94,234,212,0.2)",
        whiteSpace: "nowrap",
      }}
    >
      <strong style={{ color: "#5eead4", marginRight: 6 }}>{display}</strong>
      <span style={{ color: "#94a3b8" }}>{label}</span>
    </span>
  );
}

function HeroStat({ value, unit, hint }: { value: string; unit: string; hint: string }) {
  return (
    <div
      style={{
        padding: "12px 18px",
        borderRadius: 12,
        background: "rgba(15,23,42,0.6)",
        border: "1px solid rgba(94,234,212,0.25)",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#5eead4", fontWeight: 700, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {unit}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function PitchPanel({ label, body, accent }: { label: string; body: string; accent: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(15,23,42,0.5)",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.15em",
          color: accent,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
