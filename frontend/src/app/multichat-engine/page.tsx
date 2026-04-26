import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { getBackendOrigin } from "@/lib/apiBase";

export default function MultichatEnginePage() {
  const origin = getBackendOrigin();

  return (
    <main>
      <ProductPageShell maxWidth={860}>
        <Wave1Nav />

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 20,
            background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)",
            padding: "28px 28px 24px",
            color: "#fff",
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
            AEVION Multichat Engine
          </h1>
          <p style={{ margin: "8px 0 0", color: "rgba(226,232,240,0.82)", fontSize: 14, lineHeight: 1.55 }}>
            One backend, five LLM providers, two modes. Pick a single-model chat for quick answers,
            or a multi-agent pipeline when you need a second (and third) pair of eyes on the answer.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {/* Single chat card */}
          <Link
            href="/qcoreai"
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: 14,
              padding: 20,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
              transition: "transform 0.12s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: "0.03em",
                }}
              >
                S
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Single chat</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>One provider · one model · fastest path</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
              Classic chat experience. Pick Claude, GPT, Gemini, DeepSeek or Grok, ask a question, get an answer.
              Best for quick lookups and informal conversation.
            </p>
            <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 700, color: "#0e7490" }}>
              Open single chat →
            </span>
          </Link>

          {/* Multi-agent card */}
          <Link
            href="/qcoreai/multi"
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid rgba(124,58,237,0.35)",
              borderRadius: 14,
              padding: 20,
              background: "linear-gradient(180deg, #fff 0%, rgba(124,58,237,0.04) 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: "0 1px 4px rgba(124,58,237,0.08)",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 999,
                background: "rgba(124,58,237,0.12)",
                color: "#6d28d9",
                border: "1px solid rgba(124,58,237,0.3)",
              }}
            >
              New
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #7c3aed, #4338ca)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 13,
                  letterSpacing: "0.03em",
                }}
              >
                MA
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Multi-agent</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Analyst → Writer → Critic · inspectable</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
              Three specialized agents coordinate on every answer. Pick <b>Sequential</b> for a classic reflection loop,
              <b> Parallel</b> for two writers on different models merged by a Judge, or <b>Debate</b> where a Pro and a Con
              advocate argue and a Moderator synthesizes a balanced recommendation.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {[
                { t: "3 strategies", c: "#7c3aed" },
                { t: "Live streaming", c: "#0369a1" },
                { t: "Live cost + tokens", c: "#15803d" },
                { t: "Mixed models per role", c: "#4338ca" },
                { t: "Saveable presets", c: "#0d9488" },
                { t: "Edit & resend", c: "#0891b2" },
                { t: "Webhook on done", c: "#0284c7" },
                { t: "Public share + OG preview", c: "#9333ea" },
                { t: "Export JSON + Markdown", c: "#b45309" },
              ].map((b) => (
                <span
                  key={b.t}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: `${b.c}14`,
                    color: b.c,
                    border: `1px solid ${b.c}33`,
                  }}
                >
                  {b.t}
                </span>
              ))}
            </div>
            <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 700, color: "#6d28d9" }}>
              Open multi-agent →
            </span>
          </Link>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
          <Link
            href="/qcoreai/analytics"
            style={{
              border: "1px solid #7c3aed55",
              background: "rgba(124,58,237,0.06)",
              borderRadius: 8,
              padding: "6px 10px",
              textDecoration: "none",
              color: "#6d28d9",
              fontWeight: 700,
            }}
          >
            📊 Analytics
          </Link>
          <a
            href={`${origin}/api/qcoreai/health`}
            target="_blank"
            rel="noreferrer"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              textDecoration: "none",
              color: "#334155",
              fontWeight: 650,
            }}
          >
            Backend health
          </a>
          <a
            href={`${origin}/api/qcoreai/providers`}
            target="_blank"
            rel="noreferrer"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              textDecoration: "none",
              color: "#334155",
              fontWeight: 650,
            }}
          >
            Configured providers
          </a>
          <a
            href={`${origin}/api/qcoreai/agents`}
            target="_blank"
            rel="noreferrer"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 10px",
              textDecoration: "none",
              color: "#334155",
              fontWeight: 650,
            }}
          >
            Role defaults
          </a>
        </div>
      </ProductPageShell>
    </main>
  );
}
