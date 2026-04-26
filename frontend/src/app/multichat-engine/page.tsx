import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { getBackendOrigin } from "@/lib/apiBase";
import { launchedModules } from "@/data/pitchModel";

export const metadata = {
  title: "AEVION Multichat Engine — parallel agents on QCoreAI",
  description:
    "Beta MVP of the AEVION Multichat Engine: a single chat backend over QCoreAI, with a roadmap to parallel agent sessions and white-label B2B agents.",
};

const HERO_STATS: Array<{ label: string; value: string; hint: string }> = [
  { label: "Backend", value: "/api/qcoreai/chat", hint: "Single endpoint live" },
  { label: "Stage", value: "Beta MVP", hint: "Roadmap to parallel agents" },
  { label: "Providers", value: "5", hint: "via QCoreAI router" },
  { label: "B2B angle", value: "White-label", hint: "AEVION inside SaaS line" },
];

const ROADMAP: Array<{ phase: string; title: string; body: string }> = [
  {
    phase: "Now",
    title: "Single chat surface over QCoreAI",
    body:
      "Working POST /api/qcoreai/chat with model switching across Claude, GPT-4o, Gemini, DeepSeek, Grok. Health endpoint live for ops.",
  },
  {
    phase: "Next",
    title: "Parallel sessions with role isolation",
    body:
      "Multiple agent tabs in one window — code, finance, IP, content — each holding its own context, system prompt and tool scope. Shared identity, isolated memory.",
  },
  {
    phase: "Then",
    title: "White-label B2B agents",
    body:
      "Brandable agent surfaces sold as 'AEVION inside' for enterprise. Per-seat pricing, central LLM cost accounting, SSO via AEVION Auth.",
  },
];

const VISION_BULLETS = [
  "One window, many agents — no more juggling 4 browser tabs for 4 different AIs.",
  "Each session inherits AEVION context: your IP portfolio (QRight), your wallet (Bank), your tier (Trust Score), your awards.",
  "Agents can cross-call each other through QCoreAI routing — Code agent hands off to Finance agent without losing context.",
  "Centralised model spend across the platform: predictable per-token economics, single biggest OPEX win in the company.",
];

export default function MultichatEnginePage() {
  const origin = getBackendOrigin();
  const m = launchedModules.find((x) => x.id === "multichat-engine");

  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <section
        style={{
          position: "relative",
          minHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px 56px",
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
            Multichat Engine · beta MVP
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
            Parallel agents,
            <br />
            <span style={{ fontSize: "0.62em", fontWeight: 800, letterSpacing: "-0.02em" }}>
              one identity, one window
            </span>
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.4vw, 20px)",
              lineHeight: 1.55,
              maxWidth: 760,
              color: "rgba(226,232,240,0.92)",
              margin: 0,
            }}
          >
            {m?.tagline ??
              "Parallel agent sessions over QCoreAI — code, finance, IP, content in one window."}
          </p>

          <div
            style={{
              marginTop: 32,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
            }}
          >
            {HERO_STATS.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(94,234,212,0.25)",
                  background: "rgba(15,23,42,0.65)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#5eead4", textTransform: "uppercase" }}>
                  {s.label}
                </div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.01em" }}>
                  {s.value}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{s.hint}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/qcoreai"
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
              Open chat (QCoreAI) →
            </Link>
            <a
              href={`${origin}/api/qcoreai/health`}
              target="_blank"
              rel="noreferrer"
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
              QCoreAI health
            </a>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
        <PitchValueCallout moduleId="multichat-engine" variant="dark" />

        <section
          style={{
            marginTop: 24,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,118,110,0.15))",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#5eead4", marginBottom: 10, textTransform: "uppercase" }}>
            The vision
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 14px", color: "#fff", letterSpacing: "-0.02em" }}>
            From a chat box to an agent operating system
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#cbd5e1", margin: "0 0 20px" }}>
            {m?.problem ??
              "Users open four tabs to work with four different AI assistants. Multichat Engine collapses that into a single window — and then layers parallel agents on top, each with its own role, memory and tool scope."}
          </p>
          <ul style={{ margin: 0, paddingLeft: 22, color: "#e2e8f0", lineHeight: 1.75, fontSize: 15 }}>
            {VISION_BULLETS.map((b) => (
              <li key={b.slice(0, 40)} style={{ marginBottom: 10 }}>
                {b}
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.2em",
              color: "#94a3b8",
              margin: "0 0 16px",
              textTransform: "uppercase",
            }}
          >
            What we will ship next
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ROADMAP.map((r, idx) => (
              <article
                key={r.title}
                style={{
                  padding: 22,
                  borderRadius: 16,
                  border: "1px solid rgba(51,65,85,0.6)",
                  background: "rgba(15,23,42,0.65)",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 18,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    minWidth: 64,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: idx === 0 ? "rgba(94,234,212,0.18)" : "rgba(125,211,252,0.12)",
                    border: `1px solid ${idx === 0 ? "rgba(94,234,212,0.4)" : "rgba(125,211,252,0.3)"}`,
                    color: idx === 0 ? "#5eead4" : "#7dd3fc",
                    fontWeight: 900,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {r.phase}
                </div>
                <div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>{r.title}</h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#cbd5e1" }}>{r.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {m ? (
          <section
            style={{
              marginTop: 40,
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(59,130,246,0.25)",
              background: "rgba(30,58,138,0.18)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#93c5fd", marginBottom: 10, textTransform: "uppercase" }}>
              Killer feature
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#dbeafe" }}>{m.killerFeature}</p>
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#93c5fd", textTransform: "uppercase" }}>
              Network role
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.65, color: "#cbd5e1" }}>{m.networkRole}</p>
          </section>
        ) : null}

        <footer
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(51,65,85,0.5)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            Multichat Engine is the social and agent glue for the rest of AEVION — Planet voting, Bank Advisor, Awards judging, customer service.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/pitch"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Investor pitch →
            </Link>
            <Link
              href="/demo"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Live demo →
            </Link>
            <Link
              href="/qcoreai"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 15,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              Open QCoreAI →
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
