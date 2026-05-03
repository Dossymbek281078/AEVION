"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import {
  DEMO_MODULE_ORDER,
  ecosystemIntro,
  moduleBenefits,
  planetLayer,
} from "@/data/demoNarrative";
import { ecosystemNodes, launchedModules, networkForces } from "@/data/pitchModel";
import { apiUrl } from "@/lib/apiBase";

type ApiProject = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
};

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

const marqueePhrases = [
  "AEVION · unified trust platform",
  "27 product nodes · one pipeline",
  "QRight · QSign · Bureau · Planet",
  "Auth · registry · signature · compliance",
  "Globus · ecosystem map",
  "From idea to certificate — in one system",
];

const PIPELINE_STEPS = [
  {
    icon: "📝",
    code: "QRIGHT",
    title: "Describe & hash",
    body: "Author fills a 4-field form. SHA-256 of the payload is bound to the JWT identity and geolocation.",
    duration: "~15s",
  },
  {
    icon: "🔏",
    code: "QSIGN",
    title: "HMAC seal",
    body: "Canonical JSON of the registry entry is signed with HMAC-SHA256. Same payload format every time.",
    duration: "~5s",
  },
  {
    icon: "🛡",
    code: "SHIELD + BUREAU",
    title: "Ed25519 + Shamir → certificate",
    body: "High-value records auto-shard via Quantum Shield (2-of-3). Bureau wraps everything in a court-grade PDF.",
    duration: "~30s",
  },
  {
    icon: "🌍",
    code: "PLANET",
    title: "Multi-validator review",
    body: "Validators vote, the certificate gains a public verify URL, and the artifact joins the Planet evidence root.",
    duration: "~10s",
  },
  {
    icon: "💳",
    code: "BANK",
    title: "Royalties settle",
    body: "Awards prizes, verification fees and downstream royalties auto-flow into the AEVION Bank wallet (AEC).",
    duration: "~5s",
  },
];

const FLYWHEEL_PICKS = ["DATA", "ECON", "SCOPE"] as const;

export default function DemoShowcasePage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    qrightObjects: null,
    certifiedArtifacts: null,
    participants: null,
    shieldRecords: null,
    qtradeOps: null,
  });
  const [metricsLive, setMetricsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/globus/projects"));
        if (!r.ok) throw new Error("API");
        const data = await r.json();
        if (!cancelled) setProjects(data.items || []);
      } catch {
        if (!cancelled) {
          setLoadErr("Catalog loading from API; below is a pre-built narrative for all nodes.");
          setProjects([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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

        const next: LiveMetrics = { ...DEMO_METRICS };
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

  const displayRows = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    return DEMO_MODULE_ORDER.map((id) => {
      const n = moduleBenefits[id];
      if (!n) return null;
      const api = byId.get(id);
      if (api) return api;
      return {
        id,
        code: id.replace(/-/g, "").toUpperCase().slice(0, 12),
        name: "",
        description: "",
        kind: "",
        status: "",
        priority: 99,
      } as ApiProject;
    }).filter((x): x is ApiProject => x !== null);
  }, [projects]);

  const marqueeText = useMemo(() => {
    const line = marqueePhrases.join("   ·   ");
    return `${line}   ·   ${line}`;
  }, []);

  const liveMvpCount = launchedModules.filter((m) => m.stage === "live").length;
  const emergingCount = ecosystemNodes.length;

  const flywheelCards = useMemo(
    () => FLYWHEEL_PICKS.map((code) => networkForces.find((f) => f.code === code)).filter((x): x is (typeof networkForces)[number] => Boolean(x)),
    []
  );

  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <section
        style={{
          position: "relative",
          minHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px 64px",
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
              marginBottom: 16,
            }}
          >
            Live demo · just scroll
          </p>
          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 20px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            AEVION Ecosystem
            <br />
            <span style={{ fontSize: "0.55em", fontWeight: 800, letterSpacing: "-0.02em" }}>
              trust, IP, AI and finance on one map
            </span>
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.4vw, 20px)",
              lineHeight: 1.55,
              maxWidth: 720,
              color: "rgba(226,232,240,0.92)",
              margin: 0,
            }}
          >
            What does this <em>do</em>? Below: the live ecosystem pulse, the 90-second pipeline from
            idea to certificate, all 27 product nodes, and the cross-module flywheel that makes the
            sum bigger than its parts. For the <Link href="/pitch" style={{ color: "#fbbf24", fontWeight: 700 }}>$1B+ valuation thesis</Link>, see /pitch.
          </p>

          <div style={{ marginTop: 28 }} className="demo-marquee-wrap">
            <div className="demo-marquee-track" aria-hidden>
              <span style={{ paddingRight: 48, whiteSpace: "nowrap", fontSize: 15, fontWeight: 700, color: "#5eead4" }}>
                {marqueeText}
              </span>
              <span style={{ paddingRight: 48, whiteSpace: "nowrap", fontSize: 15, fontWeight: 700, color: "#5eead4" }}>
                {marqueeText}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
        {loadErr ? (
          <p style={{ color: "#fbbf24", fontSize: 14, marginBottom: 24 }}>{loadErr}</p>
        ) : null}

        <article
          style={{
            marginBottom: 48,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,118,110,0.15))",
          }}
        >
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 12px", color: "#fff" }}>
            {ecosystemIntro.title}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "#cbd5e1", margin: "0 0 20px" }}>{ecosystemIntro.lead}</p>
          <ul style={{ margin: 0, paddingLeft: 22, color: "#e2e8f0", lineHeight: 1.75, fontSize: 15 }}>
            {ecosystemIntro.bullets.map((b) => (
              <li key={b.slice(0, 40)} style={{ marginBottom: 10 }}>
                {b}
              </li>
            ))}
          </ul>
        </article>

        <article
          style={{
            marginBottom: 56,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(52,211,153,0.35)",
            background: "rgba(6,78,59,0.25)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", color: "#6ee7b7", marginBottom: 8 }}>
            CROSS-CUTTING LAYER
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>
            {planetLayer.code} — {planetLayer.name}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#d1fae5", marginBottom: 16 }}>{planetLayer.summary}</p>
          <ul style={{ margin: 0, paddingLeft: 22, color: "#ecfdf5", lineHeight: 1.7, fontSize: 15 }}>
            {planetLayer.benefits.map((b) => (
              <li key={b.slice(0, 40)} style={{ marginBottom: 8 }}>
                {b}
              </li>
            ))}
          </ul>
        </article>

        {/* ───────── LIVE ECOSYSTEM PULSE ───────── */}
        <section
          aria-label="Live ecosystem pulse"
          style={{
            marginBottom: 56,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(94,234,212,0.25)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.85), rgba(8,47,73,0.35))",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#fff" }}>
              Live ecosystem pulse
            </h2>
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
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: metricsLive ? "#34d399" : "#fbbf24",
                }}
                aria-hidden
              />
              {metricsLive ? "LIVE" : "DEMO"}
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 18px" }}>
            Pulled in parallel from QRight, Planet, Quantum Shield and QTrade. Falls back to a fixed
            demo snapshot when the backend is offline — same pattern as /pitch.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <LivePill label="QRight records" value={metrics.qrightObjects} />
            <LivePill label="Bureau certs" value={metrics.certifiedArtifacts} />
            <LivePill label="Planet participants" value={metrics.participants} />
            <LivePill label="Shielded artifacts" value={metrics.shieldRecords} />
            <LivePill label="QTrade ops" value={metrics.qtradeOps} />
          </div>
        </section>

        {/* ───────── 90-SECOND PIPELINE TIMELINE ───────── */}
        <section
          aria-label="Idea to certificate in 90 seconds"
          style={{
            marginBottom: 56,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(167,139,250,0.3)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.85), rgba(67,56,202,0.18))",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#c4b5fd", marginBottom: 8 }}>
            ONE PIPELINE
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>
            From idea to certificate in 90 seconds
          </h2>
          <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 22px" }}>
            QRight → QSign → Quantum Shield + Bureau → Planet → Bank. Five hops, one JWT, one Trust
            Graph edge per hop. The whole chain runs in a typical creator session.
          </p>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {PIPELINE_STEPS.map((step, i) => (
              <li
                key={step.code}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto auto 1fr auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.65)",
                  border: "1px solid rgba(94,234,212,0.18)",
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }} aria-hidden>
                  {step.icon}
                </span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: "#5eead4", marginBottom: 2 }}>
                    {step.code}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{step.body}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#fbbf24",
                    background: "rgba(251,191,36,0.1)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.duration}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ───────── STAT STRIP ABOVE THE 27-NODE GRID ───────── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "center",
            alignItems: "center",
            padding: "14px 20px",
            marginBottom: 24,
            borderRadius: 12,
            background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(94,234,212,0.2)",
            fontSize: 14,
            color: "#cbd5e1",
            fontWeight: 700,
          }}
        >
          <span><strong style={{ color: "#34d399" }}>{liveMvpCount} live MVPs</strong></span>
          <span style={{ color: "#475569" }}>·</span>
          <span><strong style={{ color: "#7dd3fc" }}>{emergingCount} emerging nodes</strong></span>
          <span style={{ color: "#475569" }}>·</span>
          <span><strong style={{ color: "#fbbf24" }}>$340B</strong> addressable market</span>
        </div>

        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.2em",
            color: "#94a3b8",
            margin: "0 0 20px",
            textTransform: "uppercase",
          }}
        >
          27 product nodes — benefits for each
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {displayRows.map((p, idx) => {
              const narrative = moduleBenefits[p.id];
              if (!narrative) return null;
              const title = p.name?.trim() || narrative.tagline;
              return (
                <article
                  key={p.id}
                  className="demo-card-enter"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid rgba(51,65,85,0.6)",
                    background: "rgba(15,23,42,0.65)",
                    animationDelay: `${Math.min(idx * 0.03, 1.2)}s`,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{p.code}</span>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>{title}</h3>
                  </div>
                  {!narrative?.tagline && p.description ? (
                    <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 12px" }}>
                      {p.description}
                    </p>
                  ) : null}
                  {narrative?.tagline ? (
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#5eead4", margin: "0 0 12px" }}>{narrative.tagline}</p>
                  ) : null}
                  <ul style={{ margin: 0, paddingLeft: 20, color: "#e2e8f0", lineHeight: 1.65, fontSize: 14 }}>
                    {narrative.benefits.map((b) => (
                      <li key={b.slice(0, 48)} style={{ marginBottom: 6 }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                  {narrative.investorAngle ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.25)",
                        fontSize: 13,
                        color: "#bfdbfe",
                        lineHeight: 1.55,
                      }}
                    >
                      <strong style={{ color: "#93c5fd" }}>For investors: </strong>
                      {narrative.investorAngle}
                    </div>
                  ) : null}
                </article>
              );
            })}
        </div>

        {/* ───────── CROSS-MODULE FLYWHEEL ───────── */}
        <section
          aria-label="Cross-module flywheel"
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(51,65,85,0.5)",
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.2em",
              color: "#94a3b8",
              margin: "0 0 8px",
              textTransform: "uppercase",
            }}
          >
            Cross-module flywheel
          </h2>
          <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 20px" }}>
            Three of the four network forces that compound across the 27 nodes. The fourth (switching
            costs) is detailed in the /pitch deck.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {flywheelCards.map((f) => (
              <article
                key={f.code}
                style={{
                  padding: 20,
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.7)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    color: "#a78bfa",
                    background: "rgba(167,139,250,0.12)",
                    padding: "3px 8px",
                    borderRadius: 999,
                  }}
                >
                  {f.code}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 850, color: "#fff", margin: "0 0 10px", paddingRight: 56, lineHeight: 1.3 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55, margin: "0 0 12px" }}>{f.body}</p>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#a78bfa",
                    padding: "8px 10px",
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
        </section>

        <footer
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(51,65,85,0.5)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            This is the same product as on the homepage: Globus, registry, signatures, bureau and Planet — in a working MVP.
            <br />
            Next steps: deeper metrics, integrations and go-to-market for selected verticals.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/pitch"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.18))",
                border: "1px solid rgba(251,191,36,0.55)",
                color: "#fef3c7",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(251,191,36,0.25)",
              }}
            >
              Investor pitch · $1B+ →
            </Link>
            <Link
              href="/demo/deep"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              Deep dive demo →
            </Link>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              Home — map and interfaces
            </Link>
          </div>
        </footer>
      </div>
    </div>
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
