"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl, getClientApiBase } from "@/lib/apiBase";
import { fetchPlanetStats, fetchRecentArtifacts } from "@/lib/planetData";
import dynamic from "next/dynamic";
import Globus3DPlaceholder from "./components/Globus3DPlaceholder";

// three.js is 748 KB, and it was reaching pages that show no globe at all:
// measured 28.07.2026, /devhub and /compare both carried the chunk in their own
// <script> tags — the bundler had folded it into a group they share with this
// page. Loading it on demand keeps it out of that group, and the globe is below
// the fold on the one page that does use it. The placeholder already holds the
// exact slot, so nothing shifts while it arrives.
const Globus3D = dynamic(() => import("./components/Globus3D"), {
  ssr: false,
  loading: () => <Globus3DPlaceholder />,
});
import { PlanetPulse } from "./components/PlanetPulse";
import { ConstitutionEmbed } from "@/components/ConstitutionEmbed";
import { WaitlistCapture } from "@/components/WaitlistCapture";
import { PageTracking } from "@/components/PageTracking";
import { countryByGlobusName } from "@/lib/constitution";
import { MODULE_NODES, TAM, BOTTOM_UP_REGIONAL_ARR, BOTTOM_UP_BEACHHEAD_ARR } from "@/data/pitchFacts";

type ModuleRuntime = {
  tier: "mvp_live" | "platform_api" | "portal_only";
  primaryPath: string | null;
  apiHints: string[];
  hint: string;
};

type GlobusProject = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
  tags: string[];
  runtime?: ModuleRuntime;
};

const btnPrimary: CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  borderRadius: 12,
  background: "#0d9488",
  color: "#fff",
  fontWeight: 800,
  textDecoration: "none",
  fontSize: 15,
  border: "none",
  boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
};

const btnGhost: CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: 15,
  border: "1px solid rgba(255,255,255,0.35)",
};

export default function HomePage() {
  /** Только после mount: избегаем гонок ref/layout и проблем с отдельным async-чанком `dynamic()`. */
  const [globeClient, setGlobeClient] = useState(false);
  useEffect(() => {
    setGlobeClient(true);
  }, []);

  const [projects, setProjects] = useState<GlobusProject[]>([]);
  const [qrightObjects, setQRightObjects] = useState<
    Array<{ id: string; title: string; country?: string; city?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [qrightError, setQrightError] = useState<string | null>(null);
  const [planetStats, setPlanetStats] = useState<{
    eligibleParticipants: number;
    distinctVotersAllTime: number;
    certifiedArtifactVersions: number;
    submissions: number;
  } | null>(null);
  const [recentArtifacts, setRecentArtifacts] = useState<
    Array<{ id: string; submissionTitle?: string; artifactType?: string; voteCount?: number; voteAverage?: number | null }>
  >([]);

  const [selectedGeo, setSelectedGeo] = useState<{
    country?: string;
    city?: string;
  }>({});

  const navigate = useCallback((href: string) => {
    window.location.href = href;
  }, []);

  const onSelectLocation = useCallback((geo: { country?: string; city?: string }) => {
    setSelectedGeo(geo);
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setProjectsError(null);
      setQrightError(null);

      try {
        // Planet-данные идут через общий загрузчик: те же две ручки просит
        // PlanetPulse, смонтированный на этой же странице (issue #1028).
        const [pr, qr, ps] = await Promise.all([
          fetch(apiUrl("/api/globus/projects")),
          fetch(apiUrl("/api/qright/objects")),
          fetchPlanetStats(),
        ]);

        // Non-blocking: fetch recent artifacts
        fetchRecentArtifacts(5)
          .then((items) => { if (items) setRecentArtifacts(items); })
          .catch(() => null);

        if (pr.ok) {
          const projectsData = await pr.json().catch(() => ({}));
          setProjects(projectsData.items || []);
        } else {
          setProjects([]);
        }

        if (qr.ok) {
          const objectsData = await qr.json().catch(() => ({}));
          setQRightObjects(objectsData.items || []);
        } else {
          setQRightObjects([]);
        }

        if (ps) {
          setPlanetStats({
            eligibleParticipants: (ps.eligibleParticipants as number) ?? 0,
            distinctVotersAllTime: (ps.distinctVotersAllTime as number) ?? 0,
            certifiedArtifactVersions: (ps.certifiedArtifactVersions as number) ?? 0,
            submissions: (ps.submissions as number) ?? 0,
          });
        }
      } catch {
        // Backend unavailable — show demo data for investor presentation
        setProjects([
          {id:"qright",code:"QR",name:"QRight",description:"IP Registry with content hash",kind:"product",status:"live",priority:1,tags:["ip","core"],runtime:{tier:"mvp_live",primaryPath:"/qright",apiHints:[],hint:"IP registration"}},
          {id:"qsign",code:"QS",name:"QSign",description:"Cryptographic signatures",kind:"product",status:"live",priority:2,tags:["crypto","core"],runtime:{tier:"mvp_live",primaryPath:"/qsign",apiHints:[],hint:"HMAC signing"}},
          {id:"aevion-ip-bureau",code:"BUR",name:"IP Bureau",description:"Authorship & prior-art bureau",kind:"product",status:"live",priority:3,tags:["ip","legal"],runtime:{tier:"mvp_live",primaryPath:"/bureau",apiHints:[],hint:"Certificate-ready"}},
          {id:"planet",code:"PL",name:"Planet",description:"Compliance & certification",kind:"product",status:"live",priority:4,tags:["compliance"],runtime:{tier:"mvp_live",primaryPath:"/planet",apiHints:[],hint:"Evidence root"}},
          {id:"aevion-bank",code:"BNK",name:"AEVION Bank",description:"Digital wallet & royalties",kind:"product",status:"live",priority:5,tags:["finance"],runtime:{tier:"mvp_live",primaryPath:"/bank",apiHints:[],hint:"AEC economy"}},
          {id:"cyberchess",code:"CH",name:"CyberChess",description:"Next-gen chess platform",kind:"product",status:"live",priority:6,tags:["gaming"],runtime:{tier:"mvp_live",primaryPath:"/cyberchess",apiHints:[],hint:"Play AI"}},
          {id:"aevion-awards-music",code:"AWM",name:"Music Awards",description:"AEVION Music Awards",kind:"product",status:"live",priority:7,tags:["awards"],runtime:{tier:"mvp_live",primaryPath:"/awards/music",apiHints:[],hint:"Awards showcase"}},
          {id:"aevion-awards-film",code:"AWF",name:"Film Awards",description:"AEVION Film Awards",kind:"product",status:"live",priority:8,tags:["awards"],runtime:{tier:"mvp_live",primaryPath:"/awards/film",apiHints:[],hint:"Awards showcase"}},
          {id:"qcoreai",code:"AI",name:"QCoreAI",description:"Multi-model AI engine",kind:"product",status:"live",priority:9,tags:["ai"],runtime:{tier:"mvp_live",primaryPath:"/qcoreai",apiHints:[],hint:"AI chat"}},
          {id:"qtradeoffline",code:"QTO",name:"QTradeOffline",description:"Offline-first AEV payments",kind:"product",status:"live",priority:9,tags:["payments","offline"],runtime:{tier:"mvp_live",primaryPath:"/qtradeoffline",apiHints:[],hint:"Sign offline, sync later"}},
          {id:"auth",code:"AU",name:"Auth",description:"Identity & JWT",kind:"infra",status:"live",priority:10,tags:["auth"],runtime:{tier:"mvp_live",primaryPath:"/auth",apiHints:[],hint:"Identity"}},
        ]);
        setQRightObjects([{id:"d1",title:"AI Music Generator"},{id:"d2",title:"Quantum Shield Protocol"},{id:"d3",title:"CyberChess Engine"},{id:"d4",title:"Smart Contract"},{id:"d5",title:"Planet Validator"}]);
        setPlanetStats({eligibleParticipants:12,distinctVotersAllTime:8,certifiedArtifactVersions:3,submissions:15});
        setProjectsError(null);
        setQrightError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const sortedProjects = useMemo(() => {
    const priority: Record<string, number> = {
      qright: -10,
      qsign: -9,
      "aevion-ip-bureau": -8,
      globus: -7,
      qcoreai: -6,
      "multichat-engine": -5,
    };

    return [...projects].sort((a, b) => {
      const ap = priority[a.id] ?? 0;
      const bp = priority[b.id] ?? 0;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
  }, [projects]);

  const globeProjectsForMap = useMemo(() => {
    const awardIds = new Set(["aevion-awards-music", "aevion-awards-film"]);
    const pins: GlobusProject[] = [
      {
        id: "aevion-awards-music",
        code: "AWM",
        name: "Music Awards",
        description: "AEVION Music Awards (Planet, type music)",
        kind: "product",
        status: "in_progress",
        priority: 2,
        tags: ["awards", "music", "planet"],
        runtime: {
          tier: "mvp_live",
          primaryPath: "/awards/music",
          apiHints: [],
          hint: "Awards showcase",
        },
      },
      {
        id: "aevion-awards-film",
        code: "AWF",
        name: "Film Awards",
        description: "AEVION Film Awards (Planet, type movie)",
        kind: "product",
        status: "in_progress",
        priority: 2,
        tags: ["awards", "film", "planet"],
        runtime: {
          tier: "mvp_live",
          primaryPath: "/awards/film",
          apiHints: [],
          hint: "Awards showcase",
        },
      },
    ];
    const rest = sortedProjects.filter((p) => !awardIds.has(p.id));
    return [...pins, ...rest];
  }, [sortedProjects]);

  const focusCount = 3;
  const focusIds = useMemo(
    () => sortedProjects.slice(0, focusCount).map((p) => p.id),
    [sortedProjects]
  );

  const directLinks: Record<string, string> = useMemo(
    () => ({
      qright: "/qright",
      qsign: "/qsign",
      "aevion-ip-bureau": "/bureau",
      qtradeoffline: "/qtradeoffline",
      qcoreai: "/qcoreai",
      "multichat-engine": "/multichat-engine",
      healthai: "/healthai",
    }),
    []
  );

  const tierStyle = (tier: ModuleRuntime["tier"] | undefined) => {
    if (tier === "mvp_live")
      return { bg: "rgba(10,120,60,0.12)", fg: "#064", label: "LIVE" };
    if (tier === "platform_api")
      return { bg: "rgba(0,80,180,0.12)", fg: "#024", label: "API" };
    return { bg: "rgba(100,100,100,0.1)", fg: "#444", label: "HUB" };
  };

  const backendOrigin = getClientApiBase();

  return (
    <main style={{ padding: 0 }}>
      {/* Заходы сюда не считались до 28.08.2026: страница собирает адреса, но
          события page_view не слала. Воронка считает переходы ОТ page_view,
          поэтому её посетители не попадали в знаменатель — конверсия выглядела
          лучше, чем есть. Компонент сам читает ?c= из ссылки. */}
      <PageTracking page="home" />
      <section
        style={{
          background: "linear-gradient(145deg, #0f172a 0%, #115e59 48%, #0d9488 100%)",
          color: "#fff",
          padding: "44px 24px 52px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Link
            href="/qventure"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "#fff",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            <span style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "3px 8px", borderRadius: 999, background: "#7c3aed", color: "#fff",
            }}>
              New planet
            </span>
            <span>QVenture — AI Investment Analyst: fund-grade due diligence in seconds</span>
            <span aria-hidden style={{ opacity: 0.8 }}>→</span>
          </Link>
          <div
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              width: "fit-content",
            }}
          >
            Product MVP · ready for demo
          </div>
          <h1
            style={{
              fontSize: "clamp(26px, 4.5vw, 42px)",
              fontWeight: 800,
              lineHeight: 1.12,
              margin: "18px 0 14px",
              maxWidth: 920,
              letterSpacing: "-0.03em",
            }}
          >
            Trust infrastructure for digital assets and intellectual property
          </h1>
          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              opacity: 0.93,
              maxWidth: 760,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            A unified platform for identity, IP registration, cryptographic signatures, authorship & prior-art bureau, and compliance — on an interactive ecosystem map with{" "}
            <strong>{MODULE_NODES} product nodes</strong>, digital banking, chess, and open APIs.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/auth" style={btnPrimary}>
              Start with identity (Auth)
            </Link>
            <Link href="/qright" style={btnGhost}>
              QRight Registry
            </Link>
            <Link
              href="/multichat-engine"
              style={{
                ...btnGhost,
                border: "1px solid rgba(196,181,253,0.7)",
                background: "rgba(124,58,237,0.18)",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              QCoreAI · Multi-agent
            </Link>
            <Link href="/awards/music" style={btnGhost}>
              Music Awards
            </Link>
            <Link href="/awards/film" style={btnGhost}>
              Film Awards
            </Link>
            <Link
              href="/demo"
              style={{
                ...btnGhost,
                border: "2px solid rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.18)",
              }}
            >
              Full demo →
            </Link>
            <Link
              href="/pitch"
              style={{
                ...btnGhost,
                border: "2px solid rgba(251,191,36,0.7)",
                background: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.18))",
                color: "#fff",
                fontWeight: 800,
                boxShadow: "0 8px 24px rgba(251,191,36,0.25)",
              }}
            >
              Investor pitch →
            </Link>
          </div>

          <div
            className="aevion-hero-stats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 12,
              marginTop: 40,
            }}
          >
            {[
              { k: "Nodes on map", v: loading ? "…" : String(projects.length) },
              { k: "QRight records", v: loading ? "…" : String(qrightObjects.length) },
              { k: "Planet participants", v: planetStats ? String(planetStats.eligibleParticipants) : "…" },
              { k: "Certified", v: planetStats ? String(planetStats.certifiedArtifactVersions) : "…" },
              { k: "Planet submissions", v: planetStats ? String(planetStats.submissions) : "…" },
              { k: "Stack", v: "Next + Node + PG" },
            ].map((row) => (
              <div
                key={row.k}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75, textTransform: "uppercase" }}>
                  {row.k}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <section
          className="aevion-quick-cards"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {[
            {
              t: "QRight",
              d: "Forever-verifiable IP. SHA-256, Ed25519, distributed Shamir shards, Bitcoin-anchored timestamps — works offline if AEVION goes dark.",
              href: "/qright",
            },
            {
              t: "QSign",
              d: "Cryptographic data integrity via HMAC — same payload format as Bureau.",
              href: "/qsign",
            },
            {
              t: "IP Bureau",
              d: "Sign and verify registry records — certificate-ready compliance.",
              href: "/bureau",
            },
            {
              t: "Planet",
              d: "Compliance layer, evidence root, and transparency for regulatory reporting.",
              href: "/planet",
            },
            {
              t: "AEVION Bank",
              d: "Digital wallet, P2P transfers, auto-royalties, and AEC credits economy.",
              href: "/bank",
            },
            {
              t: "CyberChess",
              d: "Next-gen chess platform — play AI, solve puzzles, earn ratings and titles.",
              href: "/cyberchess",
            },
            {
              t: "Music Awards",
              d: "AEVION Music Awards showcase — submit via Planet and earn community votes.",
              href: "/awards/music",
            },
            {
              t: "Film Awards",
              d: "AEVION Film Awards showcase — submit via Planet and earn community votes.",
              href: "/awards/film",
            },
          ].map((c) => (
            <Link
              key={c.t}
              href={c.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                padding: 18,
                borderRadius: 16,
                border: "1px solid rgba(15,23,42,0.1)",
                background: "#fff",
                boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
                display: "block",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a", marginBottom: 8 }}>{c.t}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{c.d}</div>
            </Link>
          ))}
        </section>

        {/* How it works — 4-step pipeline */}
        <section style={{ marginBottom: 28, padding: "28px 24px", borderRadius: 20, background: "linear-gradient(135deg, #0f172a, #1e293b)", color: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#5eead4", marginBottom: 8 }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 20px", letterSpacing: "-0.02em" }}>From idea to monetization in 4 steps</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { step: "1", title: "Register", desc: "Describe your work in QRight — walk away with a SHA-256 fingerprint, Ed25519 signature, and Bitcoin-anchored timestamp.", icon: "📝", color: "#0d9488" },
              { step: "2", title: "Sign", desc: "AEVION + your browser key co-sign the work; the private key is Shamir-split across 3 locations so we never hold enough to forge it.", icon: "🔐", color: "#2563eb" },
              { step: "3", title: "Certify", desc: "IP Bureau generates a certificate-ready document. Planet validators verify and community votes.", icon: "📜", color: "#7c3aed" },
              { step: "4", title: "Earn", desc: "AEVION Bank distributes royalties automatically when someone uses your content. Instant, transparent.", icon: "💰", color: "#059669" },
            ].map((s) => (
              <div key={s.step} style={{ padding: "18px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: s.color, marginBottom: 4 }}>STEP {s.step}</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/qright" style={{ padding: "10px 18px", borderRadius: 10, background: "#0d9488", color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
              Try it now — register your first IP →
            </Link>
          </div>
        </section>

        {/* Why invest */}
        <section style={{ marginBottom: 28, padding: "24px", borderRadius: 20, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#7c3aed", marginBottom: 8 }}>FOR INVESTORS</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 16px", letterSpacing: "-0.02em", color: "#0f172a" }}>Why partner with AEVION</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {[
              { title: "First-mover lead", desc: "A first-mover, fully integrated proof-of-authorship bureau. The moat is the integrated Trust Graph and network effects — a competitor must rebuild all five layers as one system, not just copy the idea.", metric: "5-in-1", sub: "integrated pipeline" },
              { title: `${TAM} addressable market`, desc: "IP licensing ($180B) + Creator economy ($104B) + Digital payments ($56B). AEVION sits at the intersection of all three.", metric: TAM, sub: "TAM" },
              { title: "4 network effects", desc: "Trust Graph (data), Creator Economy (economic), Financial (switching costs), Cross-module (scope) — each one alone justifies investment.", metric: "4x", sub: "compounding moats" },
              { title: `${MODULE_NODES} product nodes`, desc: "Not slides. Working code deployed at aevion.app. Full pipeline: register → sign → certify → earn. Try it yourself.", metric: `${MODULE_NODES}`, sub: "nodes on the map" },
              { title: "Quantum-resistant", desc: "Ed25519 + Shamir's Secret Sharing + HMAC-SHA256. Ready for post-quantum migration. No other IP platform has this.", metric: "3-layer", sub: "crypto shield" },
              { title: "Bottom-up revenue model", desc: `Conservative bottom-up from real published prices on 3 of the modules: ${BOTTOM_UP_BEACHHEAD_ARR} beachhead → ${BOTTOM_UP_REGIONAL_ARR} regional modelled ARR. The rest is upside. Company is pre-revenue today.`, metric: BOTTOM_UP_REGIONAL_ARR, sub: "modelled ARR · 3 flagships" },
            ].map((card) => (
              <div key={card.title} style={{ padding: "18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{card.title}</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: 20, color: "#7c3aed" }}>{card.metric}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{card.sub}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{card.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/demo" style={{ padding: "10px 18px", borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", fontWeight: 800, fontSize: 13, textDecoration: "none", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
              Full investor demo →
            </Link>
            <Link href="/qright" style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.2)", color: "#0f172a", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Try the pipeline yourself →
            </Link>
          </div>
        </section>

        {planetStats ? (
          <section
            style={{
              marginBottom: 20,
              padding: "18px 20px",
              borderRadius: 16,
              border: "1px solid rgba(15,118,110,0.2)",
              background: "linear-gradient(135deg, rgba(15,118,110,0.06), rgba(99,102,241,0.04))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>🌍</span>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#0f766e" }}>
                Planet Ecosystem — live
              </div>
            </div>
            <div
              className="aevion-planet-dash"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                { label: "Participants (Y)", value: planetStats.eligibleParticipants },
                { label: "Voters", value: planetStats.distinctVotersAllTime },
                { label: "Submissions", value: planetStats.submissions },
                { label: "Certificates", value: planetStats.certifiedArtifactVersions },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,118,110,0.15)",
                    background: "rgba(255,255,255,0.7)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#0f766e", marginTop: 4 }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/planet"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "#0f766e",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Planet Lab →
              </Link>
              <Link
                href="/awards"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,118,110,0.3)",
                  color: "#0f766e",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Awards hub →
              </Link>
              <Link
                href="/awards/music"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(124,58,237,0.3)",
                  color: "#4c1d95",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Music
              </Link>
              <Link
                href="/awards/film"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(180,83,9,0.3)",
                  color: "#92400e",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Film
              </Link>
            </div>
          </section>
        ) : null}

        {recentArtifacts.length > 0 ? (
          <section
            style={{
              marginBottom: 20,
              padding: "16px 18px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 12 }}>
              Recent Planet artifacts
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {recentArtifacts.map((a) => (
                <Link
                  key={a.id}
                  href={`/planet/artifact/${a.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.06)",
                    background: "rgba(15,23,42,0.02)",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", minWidth: 48, textTransform: "uppercase" }}>
                    {a.artifactType || "—"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", flex: 1 }}>
                    {a.submissionTitle || "Untitled"}
                  </span>
                  {a.voteCount != null && a.voteCount > 0 ? (
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {a.voteAverage != null ? `${Number(a.voteAverage).toFixed(1)} ★` : ""}{" "}
                      ({a.voteCount})
                    </span>
                  ) : null}
                  <span style={{ fontSize: 12, color: "#0d9488", fontWeight: 700 }}>→</span>
                </Link>
              ))}
            </div>
            <Link
              href="/planet"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 13,
                fontWeight: 700,
                color: "#0f766e",
                textDecoration: "none",
              }}
            >
              All Planet artifacts →
            </Link>
          </section>
        ) : null}

        <PlanetPulse />

        {projectsError ? (
          <div
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(180,40,40,0.08)",
              border: "1px solid rgba(180,40,40,0.25)",
              color: "#611",
              lineHeight: 1.5,
            }}
          >
            <b>Node list:</b> {projectsError}
            <div style={{ marginTop: 6, fontSize: 13, color: "#722" }}>
              Globus still renders. Start backend on 4001; if needed set{" "}
              <code>BACKEND_PROXY_TARGET</code> in build and <code>NEXT_PUBLIC_API_BASE_URL</code> for direct URL.
            </div>
          </div>
        ) : null}

        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "linear-gradient(135deg, rgba(10,90,60,0.06), rgba(0,60,120,0.05))",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8, color: "#111" }}>
            Demo pipeline — Wave 1
          </div>
          <div style={{ fontSize: 14, color: "#444", marginBottom: 10 }}>
            Auth → QRight → QSign → Bureau. Left: node catalog, right: Globus (sticky column).
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { href: "/auth", label: "1 · Auth" },
              { href: "/qright", label: "2 · QRight" },
              { href: "/qsign", label: "3 · QSign" },
              { href: "/bureau", label: "4 · Bureau" },
            ].map((x) => (
              <Link
                key={x.href}
                href={x.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  textDecoration: "none",
                  color: "#111",
                  fontWeight: 700,
                  fontSize: 13,
                  background: "#fff",
                }}
              >
                {x.label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18, color: "#475569", fontSize: 15 }}>
          Interactive 3D Globus: nodes are clickable. Any module opens the same product pipeline on
          the node page.
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <section style={{ flex: "1 1 420px", minWidth: 0, order: 1 }}>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
              Ecosystem catalog:{" "}
              <b style={{ color: "#0f172a" }}>{loading ? "…" : projects.length}</b>
              {loading ? (
                <span style={{ marginLeft: 8, color: "#94a3b8" }}>loading...</span>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/qright"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                QRight
              </Link>
              <Link
                href="/qsign"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                QSign
              </Link>
              <Link
                href="/bureau"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                IP Bureau
              </Link>
              <Link
                href="/planet"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                Planet
              </Link>
              <Link
                href="/multichat-engine"
                style={{
                  border: "1px solid rgba(124,58,237,0.4)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#6d28d9",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(124,58,237,0.06)",
                }}
              >
                QCoreAI
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "rgba(124,58,237,0.15)",
                    color: "#6d28d9",
                  }}
                >
                  Multi-agent
                </span>
              </Link>
              <Link
                href="/auth"
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 650,
                }}
              >
                Auth
              </Link>
              <a
                href={`${backendOrigin}/api/openapi.json`}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#475569",
                  fontWeight: 650,
                }}
              >
                OpenAPI
              </a>
              <a
                href={`${backendOrigin}/api/modules/status`}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "#475569",
                  fontWeight: 650,
                }}
              >
                Modules
              </a>
            </div>

            <div style={{ marginTop: 14, color: "#64748b", lineHeight: 1.5, fontSize: 13 }}>
              Data from API; <code>runtime</code> field is for monitoring and integrations.
            </div>

            <div
              style={{
                marginTop: 18,
                maxHeight: 340,
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
              {sortedProjects.map((p) => {
                const ts = tierStyle(p.runtime?.tier);
                const hasPlanet = p.tags?.includes("planet") || p.tags?.includes("awards") ||
                  ["qright", "qsign", "aevion-ip-bureau"].includes(p.id);
                return (
                  <div key={p.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Link
                        href={directLinks[p.id] ?? `/${p.id}`}
                        style={{ color: "#0f172a", textDecoration: "none", fontWeight: 600 }}
                      >
                        {p.code}: {p.name}
                      </Link>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: ts.bg,
                          color: ts.fg,
                        }}
                      >
                        {ts.label}
                      </span>
                      {hasPlanet ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "rgba(15,118,110,0.12)",
                            color: "#0f766e",
                          }}
                        >
                          🌍 PLANET
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {p.kind} • {p.status}
                      {p.runtime?.hint ? ` — ${p.runtime.hint}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            style={{
              flex: "0 1 420px",
              width: "100%",
              maxWidth: 560,
              minWidth: 280,
              order: 2,
              position: "sticky",
              top: "calc(var(--aevion-header-h, 0px) + 72px)",
              alignSelf: "flex-start",
            }}
          >
            {qrightError ? (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  color: "#844",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "rgba(180,120,0,0.08)",
                  border: "1px solid rgba(180,120,0,0.2)",
                }}
              >
                {qrightError}
              </div>
            ) : null}
            {globeClient ? (
              <Globus3D
                projects={globeProjectsForMap}
                qrightObjects={qrightObjects}
                focusProjectIds={focusIds}
                onNavigate={navigate}
                onSelectLocation={onSelectLocation}
              />
            ) : (
              <Globus3DPlaceholder />
            )}

            <div style={{ marginTop: 12, color: "#64748b", lineHeight: 1.6, fontSize: 14 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Globus · right panel</div>
              <div>
                Location:{" "}
                <b style={{ color: "#0f172a" }}>
                  {(selectedGeo.city || "—") + (selectedGeo.country ? `, ${selectedGeo.country}` : "")}
                </b>
              </div>
              <button
                type="button"
                onClick={() => {
                  const c = selectedGeo.country || "";
                  const ci = selectedGeo.city || "";
                  const qs = new URLSearchParams();
                  if (c) qs.set("country", c);
                  if (ci) qs.set("city", ci);
                  const href = `/qright${qs.toString() ? `?${qs.toString()}` : ""}`;
                  navigate(href);
                }}
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0f172a",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                Register object in QRight here
              </button>
              {selectedGeo.country && (() => {
                const cc = countryByGlobusName(selectedGeo.country);
                if (!cc) return null;
                return (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      background: "rgba(11,23,54,0.06)",
                      border: "1px solid rgba(212,175,55,0.3)",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Constitution отпечаток
                    </div>
                    <ConstitutionEmbed sliders={cc.sliders} label={`${cc.flag} ${cc.name}`} size="sm" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      <a
                        href={`/constitution?country=${cc.code}`}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "#d4af37",
                          color: "#0b1736",
                          fontWeight: 700,
                          fontSize: 12,
                          textDecoration: "none",
                          textAlign: "center",
                        }}
                      >
                        ▸ Применить ползунки {cc.flag}
                      </a>
                      <a
                        href={`/constitution?country=${cc.code}#scatter`}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "transparent",
                          border: "1px solid rgba(34,211,238,0.5)",
                          color: "#0891b2",
                          fontWeight: 700,
                          fontSize: 12,
                          textDecoration: "none",
                          textAlign: "center",
                        }}
                      >
                        ⊙ Сравнить со своим
                      </a>
                      <a
                        href={`/constitution/leaderboard`}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "transparent",
                          border: "1px solid rgba(16,185,129,0.4)",
                          color: "#059669",
                          fontWeight: 700,
                          fontSize: 12,
                          textDecoration: "none",
                          textAlign: "center",
                        }}
                      >
                        🪞 Похожие сценарии
                      </a>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        </div>

        <div style={{ maxWidth: 1200, margin: "32px auto 8px" }}>
          <WaitlistCapture source="home" />
        </div>

        <section
          style={{
            maxWidth: 1200,
            margin: "32px auto 24px",
            padding: 16,
            border: "1px solid rgba(212,175,55,0.25)",
            borderRadius: 12,
            background: "rgba(248,250,252,0.6)",
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <ConstitutionEmbed
            sliders={{ floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80, multiStatus: 75, skinInGame: 70, polycentricity: 65, positiveSum: 80 }}
            label="Отпечаток AEVION"
            size="md"
          />
          <div style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              Какой социальный контракт строит AEVION
            </h2>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.55, marginBottom: 10 }}>
              Open Access как философия экосистемы: высокий пол снизу, закон
              над верхом, ротация, прозрачность, полицентричность. Это не
              маркетинг — это конкретные 8 ползунков, заложенных в дизайн
              каждого модуля платформы.
            </p>
            <a
              href="/constitution"
              style={{
                display: "inline-block",
                padding: "10px 16px",
                borderRadius: 8,
                background: "#0f172a",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Построить свою конституцию →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
